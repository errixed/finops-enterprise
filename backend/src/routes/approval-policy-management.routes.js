
import express from "express";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../config/mongodb.js";

const router = express.Router();

const LEVELS = ["Low", "Medium", "High", "Critical"];
const STATUSES = [
    "Active",
    "Draft",
    "Pending",
    "PendingApproval",
    "Archived",
    "Superseded",
    "Inactive"
];

const DEFAULT_NAMES = {
    Low: "Low-Risk Transaction Approval",
    Medium: "Medium-Risk Transaction Approval",
    High: "High-Risk Transaction Approval",
    Critical: "Critical-Risk Transaction Approval"
};

function collection() {
    return getDatabase().collection("approval_policies");
}

function fail(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
}

function displayStatus(status) {
    return status === "PendingApproval" ? "Pending" : status;
}

function formatVersion(version) {
    if (version === undefined || version === null) return "v1";
    const value = String(version);
    return value.startsWith("v") ? value : `v${value}`;
}

function normalize(policy) {
    const levels = Array.isArray(policy.riskLevels)
        ? policy.riskLevels.filter(level => LEVELS.includes(level))
        : LEVELS.includes(policy.riskLevel)
            ? [policy.riskLevel]
            : [];

    const roles = Array.isArray(policy.requiredRoles)
        ? policy.requiredRoles
        : [];

    return {
        policyId: policy.policyId,
        name: policy.name ||
            DEFAULT_NAMES[policy.riskLevel] ||
            policy.policyId,
        description: policy.description ||
            (levels.length
                ? `Approval rules for ${levels.join(", ")} risk transactions.`
                : "Policy configuration draft."),
        version: policy.version ?? 1,
        versionLabel: formatVersion(policy.version),
        status: displayStatus(policy.status),
        riskLevels: levels,
        requiredRoles: roles,
        owner: policy.owner || "Operations",
        effectiveDate: policy.effectiveDate ||
            (policy.status === "Active" ? policy.createdAt : null),
        createdAt: policy.createdAt || null,
        updatedAt: policy.updatedAt || policy.createdAt || null,
        changedBy: policy.changedBy || policy.createdBy || "System",
        changeSummary: policy.changeSummary || "",
        workflowMappings: Array.isArray(policy.workflowMappings)
            ? policy.workflowMappings
            : null,
        wizardCompleted: policy.wizardCompleted === true,
        hasWizardConfig: policy.wizardConfig != null,
    };
}

function versionSort(a, b) {
    const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();

    return bDate - aDate ||
        String(b.version).localeCompare(
            String(a.version),
            undefined,
            { numeric: true }
        );
}

function latestOf(versions) {
    return [...versions].sort((a, b) => {
        const aCurrent = a.status === "Active" ? 1 : 0;
        const bCurrent = b.status === "Active" ? 1 : 0;

        return bCurrent - aCurrent || versionSort(a, b);
    })[0];
}

async function listAll() {
    return (await collection()
        .find({})
        .project({ _id: 0 })
        .toArray())
        .filter(item => item.policyId)
        .map(normalize);
}

function groupPolicies(rows) {
    const groups = new Map();

    for (const row of rows) {
        const versions = groups.get(row.policyId) || [];
        versions.push(row);
        groups.set(row.policyId, versions);
    }

    return [...groups.entries()].map(([policyId, versions]) => ({
        ...latestOf(versions),
        policyId,
        versionCount: versions.length,
        versions: [...versions].sort(versionSort)
    })).sort((a, b) => a.name.localeCompare(b.name));
}

router.get("/", async (req, res, next) => {
    try {
        const search = String(req.query.search || "")
            .trim()
            .toLowerCase();
        const status = String(req.query.status || "All");

        if (
            search.length > 150 ||
            !["All", ...STATUSES].includes(status)
        ) {
            fail("Invalid policy filters");
        }

        const all = await listAll();
        const groups = groupPolicies(all);

        const filtered = groups.filter(policy => {
            const matchingSearch = !search ||
                [
                    policy.name,
                    policy.description,
                    policy.policyId,
                    ...policy.versions.map(item => item.versionLabel)
                ].some(value => String(value).toLowerCase().includes(search));

            const matchingStatus = status === "All" ||
                policy.status === displayStatus(status);

            return matchingSearch && matchingStatus;
        });

        const counts = {
            total: groups.length,
            active: groups.filter(item => item.status === "Active").length,
            draft: groups.filter(item => item.status === "Draft").length,
            pending: groups.filter(item => item.status === "Pending").length,
            archived: groups.filter(item => item.status === "Archived").length
        };

        res.json({
            policies: filtered.map(({ versions, ...policy }) => policy),
            summary: counts,
            totalMatching: filtered.length
        });
    } catch (error) {
        next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const id = req.params.id;
        const versions = (await listAll())
            .filter(item => item.policyId === id)
            .sort(versionSort);

        if (!versions.length) {
            fail("Approval policy not found", 404);
        }

        const current = latestOf(versions);

        const definitions = await getDatabase()
            .collection("approval_workflow_definitions")
            .find({
                status: "Active",
                isDraft: { $ne: true }
            })
            .project({
                _id: 0,
                definitionId: 1,
                name: 1,
                riskLevels: 1,
                stages: 1,
                origin: 1,
                protected: 1
            })
            .toArray();

        const mappings = current.workflowMappings ??
            current.riskLevels.map(level => {
                const required = JSON.stringify(current.requiredRoles);

                const matching = definitions.find(item =>
                    item.origin === "Assignment3" &&
                    item.protected === true &&
                    item.riskLevels?.includes(level) &&
                    JSON.stringify(item.stages ?? []) === required
                );

                return {
                    riskLevel: level,
                    workflowId: matching?.definitionId ?? null,
                    workflowName: matching?.name ?? null,
                    stages: [...current.requiredRoles]
                };
            });

        res.json({
            policy: current,
            versions,
            mappings
        });
    } catch (error) {
        next(error);
    }
});

router.post("/drafts", async (req, res, next) => {
    try {
        const name = String(req.body?.name ?? "").trim();
        const description = String(req.body?.description ?? "").trim();
        const owner = String(req.body?.owner ?? "Operations").trim();

        if (
            name.length < 3 || name.length > 150 ||
            description.length > 1000 ||
            !owner || owner.length > 100
        ) {
            fail("Invalid policy draft information");
        }

        const now = new Date();
        const draft = {
            policyId: `APD-${randomUUID()}`,
            version: 1,
            name,
            description,
            owner,
            status: "Draft",
            riskLevels: [],
            requiredRoles: [],
            effectiveDate: null,
            createdAt: now,
            updatedAt: now,
            createdBy: String(
                req.get("X-Actor-Id") || "DEMO-POLICY-ADMIN"
            ).slice(0, 100),
            changeSummary: "Initial draft created"
        };

        await collection().insertOne(draft);

        await getDatabase()
            .collection("approval_policy_management_events")
            .insertOne({
                eventId: randomUUID(),
                policyId: draft.policyId,
                version: draft.version,
                action: "Draft Created",
                actorId: draft.createdBy,
                details: { name, description, owner },
                createdAt: now
            });

        res.status(201).json(normalize(draft));
    } catch (error) {
        next(error);
    }
});

export default router;
