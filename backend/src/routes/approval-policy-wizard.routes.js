
import express from "express";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../config/mongodb.js";

const router = express.Router();

const LEVELS = ["Low", "Medium", "High", "Critical"];
const ROLES = [
    "OperationsReviewer",
    "SeniorReviewer",
    "ComplianceReviewer"
];
const TYPES = [
    "TransactionApproval",
    "AccountChange",
    "Exception"
];
const FIELDS = [
    "transactionAmount",
    "transactionType",
    "clientRiskRating"
];
const OPERATORS = ["eq", "ne", "gte", "gt", "lte", "lt", "in"];
const TRANSACTION_TYPES = [
    "InternalTransfer",
    "ExternalTransfer",
    "CrossBorder",
    "LargeTransfer"
];
const EVENTS = [
    "ApprovalRequestCreated",
    "ApprovalAssigned",
    "ApprovalDecision",
    "SlaWarning",
    "SlaBreach",
    "PolicyStatusChanged"
];

function policies() {
    return getDatabase().collection("approval_policies");
}

function events() {
    return getDatabase().collection("approval_policy_management_events");
}

function fail(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
}

function actor(req) {
    return String(req.get("X-Actor-Id") || "DEMO-POLICY-ADMIN")
        .slice(0, 100);
}

function string(value, max = 150) {
    return typeof value === "string"
        ? value.trim().slice(0, max)
        : "";
}

function verify(condition, message) {
    if (!condition) fail(message);
}

function validateConfig(input, complete) {
    verify(
        input && typeof input === "object" && !Array.isArray(input),
        "Invalid policy configuration"
    );

    const details = input.details ?? {};
    const ranges = input.riskRanges ?? [];
    const rules = input.rules ?? [];
    const mappings = input.mappings ?? [];
    const slas = input.stageSlas ?? [];
    const escalation = input.escalation ?? {};
    const monitoring = input.monitoring ?? {};
    const notifications = input.notifications ?? [];
    const review = input.review ?? {};

    const normalizedDetails = {
        name: string(details.name),
        version: string(details.version, 30) || "v1.0",
        description: string(details.description, 1000),
        policyType: string(details.policyType, 40) ||
            "TransactionApproval",
        effectiveDate: string(details.effectiveDate, 10),
        owner: string(details.owner, 100) || "Operations"
    };

    verify(TYPES.includes(normalizedDetails.policyType), "Invalid policy type");
    verify(
        /^\d+(?:\.\d+)*$/.test(
            normalizedDetails.version.replace(/^v/i, "")
        ),
        "Invalid version"
    );

    verify(Array.isArray(ranges) && ranges.length <= 10, "Invalid risk ranges");

    const normalizedRanges = ranges.map((range, index) => {
        verify(
            LEVELS.includes(range.level) &&
            Number.isInteger(range.min) &&
            Number.isInteger(range.max) &&
            range.min >= 0 &&
            range.max <= 100 &&
            range.min <= range.max,
            `Invalid risk range ${index + 1}`
        );

        return {
            level: range.level,
            min: range.min,
            max: range.max,
            description: string(range.description, 250)
        };
    });

    verify(
        new Set(normalizedRanges.map(range => range.level)).size ===
            normalizedRanges.length,
        "Risk level names must be unique"
    );

    const ordered = [...normalizedRanges].sort((a, b) => a.min - b.min);

    for (let index = 1; index < ordered.length; index++) {
        verify(
            ordered[index].min > ordered[index - 1].max,
            "Risk ranges cannot overlap"
        );
    }

    verify(Array.isArray(rules) && rules.length <= 30, "Invalid approval rules");

    const normalizedRules = rules.map((rule, index) => {
        verify(
            FIELDS.includes(rule.field) &&
            OPERATORS.includes(rule.operator),
            `Invalid rule ${index + 1}`
        );

        const value = rule.value;

        if (rule.field === "transactionAmount") {
            verify(
                typeof value === "number" &&
                Number.isFinite(value) &&
                value >= 0 &&
                rule.operator !== "in",
                `Invalid transaction amount rule ${index + 1}`
            );
        } else if (rule.field === "transactionType") {
            verify(
                ["eq", "ne", "in"].includes(rule.operator),
                "Invalid transaction-type operator"
            );
            const values = rule.operator === "in" ? value : [value];
            verify(
                Array.isArray(values) &&
                values.length > 0 &&
                values.every(v => TRANSACTION_TYPES.includes(v)),
                "Invalid transaction type"
            );
        } else {
            verify(
                ["eq", "ne", "in"].includes(rule.operator),
                "Invalid client risk-rating operator"
            );
            const values = rule.operator === "in" ? value : [value];
            verify(
                Array.isArray(values) &&
                values.length > 0 &&
                values.every(v => LEVELS.includes(v)),
                "Invalid client risk-rating value"
            );
        }

        return {
            ruleId: string(rule.ruleId, 100) || randomUUID(),
            field: rule.field,
            operator: rule.operator,
            value
        };
    });

    verify(
        ["AND", "OR"].includes(input.ruleLogic ?? "AND"),
        "Invalid rule logic"
    );

    verify(Array.isArray(mappings) && mappings.length <= 10, "Invalid mappings");

    const normalizedMappings = mappings.map((mapping, index) => {
        verify(LEVELS.includes(mapping.riskLevel), "Invalid mapping risk level");
        verify(
            Array.isArray(mapping.stages) &&
            mapping.stages.length <= 5 &&
            mapping.stages.every(role => ROLES.includes(role)),
            `Invalid reviewer sequence ${index + 1}`
        );

        return {
            riskLevel: mapping.riskLevel,
            workflowId: string(mapping.workflowId, 100),
            workflowType: ["Sequential", "Parallel"].includes(mapping.workflowType)
                ? mapping.workflowType
                : "Sequential",
            stages: [...mapping.stages]
        };
    });

    verify(
        new Set(normalizedMappings.map(item => item.riskLevel)).size ===
            normalizedMappings.length,
        "Only one mapping per risk level is permitted"
    );

    verify(
        typeof input.segregationOfDuties === "boolean",
        "Invalid segregation-of-duties configuration"
    );

    verify(Array.isArray(slas) && slas.length <= 25, "Invalid stage SLAs");

    const normalizedSlas = slas.map((sla, index) => {
        verify(
            LEVELS.includes(sla.riskLevel) &&
            ROLES.includes(sla.role) &&
            Number.isInteger(sla.stageNumber) &&
            sla.stageNumber >= 1 &&
            Number.isFinite(sla.target) &&
            sla.target > 0 &&
            sla.target <= 720 &&
            ["Hours", "Days"].includes(sla.unit) &&
            ["Business", "Calendar"].includes(sla.hoursMode),
            `Invalid stage SLA ${index + 1}`
        );

        return {
            riskLevel: sla.riskLevel,
            stageNumber: sla.stageNumber,
            role: sla.role,
            target: sla.target,
            unit: sla.unit,
            hoursMode: sla.hoursMode
        };
    });

    const normalizedEscalation = {
        trigger: ["SlaNotMet", "AtRisk"].includes(escalation.trigger)
            ? escalation.trigger : "SlaNotMet",
        escalateTo: ["NextLevel", ...ROLES].includes(escalation.escalateTo)
            ? escalation.escalateTo : "NextLevel",
        delay: Number(escalation.delay ?? 2),
        unit: escalation.unit === "Days" ? "Days" : "Hours",
        notifyPrevious: escalation.notifyPrevious === true,
        autoAssignAlternate: escalation.autoAssignAlternate === true
    };

    verify(
        Number.isFinite(normalizedEscalation.delay) &&
        normalizedEscalation.delay >= 0 &&
        normalizedEscalation.delay <= 720,
        "Invalid escalation delay"
    );

    const normalizedMonitoring = {
        trackKpis: monitoring.trackKpis === true,
        includeReports: monitoring.includeReports === true,
        alertOnBreach: monitoring.alertOnBreach === true
    };

    verify(
        Array.isArray(notifications) &&
        notifications.length <= EVENTS.length,
        "Invalid notifications"
    );

    const normalizedNotifications = notifications.map(item => {
        verify(EVENTS.includes(item.event), "Invalid notification event");
        verify(
            Array.isArray(item.recipients) &&
            item.recipients.length <= 10 &&
            item.recipients.every(value =>
                typeof value === "string" && value.length <= 60
            ),
            "Invalid notification recipients"
        );
        return {
            event: item.event,
            inApp: item.inApp === true,
            email: item.email === true,
            recipients: [...item.recipients]
        };
    });

    verify(
        new Set(normalizedNotifications.map(item => item.event)).size ===
            normalizedNotifications.length,
        "Duplicate notification events"
    );

    const normalizedReview = {
        requireApproval: review.requireApproval === true,
        notifyOnChange: review.notifyOnChange === true,
        complianceReview: review.complianceReview === true
    };

    if (complete) {
        verify(
            normalizedDetails.name.length >= 3 &&
            normalizedDetails.description.length > 0 &&
            /^\d{4}-\d{2}-\d{2}$/.test(normalizedDetails.effectiveDate),
            "Complete the mandatory Policy Details fields"
        );

        verify(
            ordered.length === 4 &&
            ordered[0].min === 0 &&
            ordered[ordered.length - 1].max === 100 &&
            ordered.every((range, index) =>
                index === 0 || range.min === ordered[index - 1].max + 1
            ),
            "Risk ranges must cover the entire 0–100 score without gaps"
        );

        verify(
            normalizedMappings.length === 4 &&
            LEVELS.every(level =>
                normalizedMappings.some(mapping => mapping.riskLevel === level)
            ),
            "Assign workflows to all four risk levels"
        );

        const byRisk = new Map(
            normalizedMappings.map(mapping => [mapping.riskLevel, mapping])
        );

        verify(
            (byRisk.get("Low")?.stages.length ?? -1) === 0 &&
            JSON.stringify(byRisk.get("Medium")?.stages) ===
                JSON.stringify(["OperationsReviewer"]) &&
            JSON.stringify(byRisk.get("High")?.stages) ===
                JSON.stringify(["OperationsReviewer", "SeniorReviewer"]) &&
            JSON.stringify(byRisk.get("Critical")?.stages) ===
                JSON.stringify(["SeniorReviewer", "ComplianceReviewer"]),
            "Reviewer sequences must follow Assignment 3 approval requirements"
        );

        for (const mapping of normalizedMappings) {
            if (mapping.riskLevel === "Low") continue;

            const assigned = normalizedSlas.filter(
                sla => sla.riskLevel === mapping.riskLevel
            );

            verify(
                assigned.length === mapping.stages.length &&
                assigned.every((sla, index) =>
                    sla.stageNumber === index + 1 &&
                    sla.role === mapping.stages[index]
                ),
                `Complete the stage SLAs for ${mapping.riskLevel}`
            );
        }

        verify(
            normalizedNotifications.length === EVENTS.length,
            "Configure all six notification events"
        );
    }

    return {
        details: normalizedDetails,
        riskRanges: normalizedRanges,
        rules: normalizedRules,
        ruleLogic: input.ruleLogic ?? "AND",
        mappings: normalizedMappings,
        segregationOfDuties: input.segregationOfDuties,
        stageSlas: normalizedSlas,
        escalation: normalizedEscalation,
        monitoring: normalizedMonitoring,
        notifications: normalizedNotifications,
        review: normalizedReview
    };
}

async function audit(req, policyId, action, detail) {
    await events().insertOne({
        eventId: randomUUID(),
        policyId,
        actorId: actor(req),
        action,
        details: detail,
        createdAt: new Date()
    });
}

function fields(config, complete) {
    return {
        name: config.details.name || "Untitled Approval Policy",
        description: config.details.description,
        owner: config.details.owner,
        version: config.details.version,
        policyType: config.details.policyType,
        effectiveDate: config.details.effectiveDate || null,
        riskLevels: config.mappings
            .filter(mapping => mapping.stages.length > 0)
            .map(mapping => mapping.riskLevel),
        requiredRoles: [],
        wizardConfig: config,
        wizardCompleted: complete,
        status: "Draft",
        updatedAt: new Date()
    };
}

router.get("/workflows", async (req, res, next) => {
    try {
        const definitions = await getDatabase()
            .collection("approval_workflow_definitions")
            .find({
                isDraft: { $ne: true },
                status: { $in: ["Active", "Inactive"] }
            })
            .project({
                _id: 0,
                definitionId: 1,
                name: 1,
                riskLevels: 1,
                stages: 1,
                status: 1
            })
            .sort({ name: 1 })
            .toArray();

        res.json(definitions);
    } catch (error) {
        next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const policy = await policies().findOne({
            policyId: req.params.id,
            status: "Draft",
            wizardConfig: { $exists: true }
        }, { projection: { _id: 0 } });

        if (!policy) fail("Wizard draft not found", 404);

        res.json(policy);
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    try {
        const complete = req.body?.complete === true;
        const config = validateConfig(req.body?.config, complete);
        const policyId = `APD-${randomUUID()}`;
        const now = new Date();

        const policy = {
            policyId,
            ...fields(config, complete),
            createdAt: now,
            createdBy: actor(req),
            changeSummary: complete
                ? "Wizard draft completed"
                : "Wizard draft saved"
        };

        await policies().insertOne(policy);
        await audit(req, policyId, "Draft Created", {
            completed: complete,
            name: policy.name
        });

        res.status(201).json({
            policyId,
            wizardConfig: config,
            wizardCompleted: complete
        });
    } catch (error) {
        next(error);
    }
});

router.put("/:id", async (req, res, next) => {
    try {
        const complete = req.body?.complete === true;
        const config = validateConfig(req.body?.config, complete);

        const existing = await policies().findOne({
            policyId: req.params.id,
            status: "Draft",
            wizardConfig: { $exists: true }
        });

        if (!existing) fail("Editable wizard draft not found", 404);

        const result = await policies().updateOne(
            {
                _id: existing._id,
                status: "Draft",
                updatedAt: existing.updatedAt
            },
            {
                $set: {
                    ...fields(config, complete),
                    changeSummary: complete
                        ? "Wizard draft completed"
                        : "Wizard draft updated"
                }
            }
        );

        if (!result.modifiedCount) {
            fail("Draft was changed by another request", 409);
        }

        await audit(req, existing.policyId,
            complete ? "Draft Completed" : "Draft Updated",
            { completed: complete }
        );

        res.json({
            policyId: existing.policyId,
            wizardConfig: config,
            wizardCompleted: complete
        });
    } catch (error) {
        next(error);
    }
});

router.delete("/:id", async (req, res, next) => {
    try {
        const result = await policies().deleteOne({
            policyId: req.params.id,
            status: "Draft",
            wizardConfig: { $exists: true }
        });

        if (!result.deletedCount) fail("Draft not found", 404);

        await audit(req, req.params.id, "Draft Deleted", {});
        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

export default router;
