import { randomUUID } from "node:crypto";

import {
    findAllRiskPolicies,
    findRiskPolicyById,
    findLatestRiskPolicy,
    findActiveRiskPolicy,
    findWorkflowActor,
    insertRiskPolicy,
    updateDraftRiskPolicy,
    activateRiskPolicyVersion,
    searchRiskPolicies,
} from "../repositories/risk-policy.repository.js";

import {
    validateRiskPolicy,
    DEFAULT_RISK_RULES,
    DEFAULT_RISK_THRESHOLDS
} from "./risk-assessment.service.js";

import {
    parsePagination
} from "../utils/pagination.js";

function fail(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
}

async function requirePolicyAdministrator(actorId) {
    if (!actorId || typeof actorId !== "string") {
        fail("A simulated policy administrator is required", 400);
    }

    const actor = await findWorkflowActor(actorId);

    if (!actor || actor.role !== "PolicyAdministrator") {
        fail("Actor is not a policy administrator", 403);
    }

    return actor;
}

function validateConfiguration(rules, thresholds) {
    try {
        validateRiskPolicy({ rules, thresholds });
    } catch (error) {
        fail(error.message, 400);
    }
}
function validateLockedSeededRules(rules) {
    for (const seeded of DEFAULT_RISK_RULES) {
        const current = rules.find(rule =>
            rule.ruleId === seeded.ruleId
        );

        if (
            !current ||
            current.points !== seeded.points ||
            current.threshold !== seeded.threshold ||
            Object.keys(current).length !== Object.keys(seeded).length
        ) {
            fail(`${seeded.ruleId} is a locked seeded rule`);
        }
    }
}
export async function listRiskPolicies(query = {}) {
    const paginated =
        query.page !== undefined ||
        query.pageSize !== undefined;

    if (!paginated) {
        return findAllRiskPolicies();
    }

    const pagination = parsePagination(
        query.page,
        query.pageSize
    );

    return searchRiskPolicies(pagination);
}

export async function getRiskPolicy(id) {
    const policy = await findRiskPolicyById(id);

    if (!policy) {
        fail("Risk policy not found", 404);
    }

    return policy;
}

export async function getActivePolicy(currency) {
    if (!["CAD", "USD"].includes(currency)) {
        fail("Unsupported currency", 400);
    }

    const policy = await findActiveRiskPolicy(currency);

    if (!policy) {
        fail("No active risk policy found", 503);
    }

    return policy;
}

export async function createRiskPolicy(input, actorId) {
    await requirePolicyAdministrator(actorId);

    if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input)
    ) {
        fail("Invalid risk policy request");
    }

    const {
        policyId,
        currency,
        policyName,
        description,
        plannedEffectiveFrom
    } = input;

    if (
        typeof policyId !== "string" ||
        !/^RISK-POLICY-[A-Z0-9-]{1,40}$/.test(policyId)
    ) {
        fail("Invalid policy ID");
    }

    if (!["CAD", "USD"].includes(currency)) {
        fail("Unsupported currency");
    }

    if (
        typeof policyName !== "string" ||
        !policyName.trim() ||
        policyName.length > 120
    ) {
        fail("Policy name must be between 1 and 120 characters");
    }

    if (
        typeof description !== "string" ||
        description.length > 1000
    ) {
        fail("Policy description cannot exceed 1000 characters");
    }

    if (
        typeof plannedEffectiveFrom !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(plannedEffectiveFrom) ||
        Number.isNaN(
            Date.parse(`${plannedEffectiveFrom}T00:00:00.000Z`)
        ) ||
        new Date(`${plannedEffectiveFrom}T00:00:00.000Z`)
            .toISOString()
            .slice(0, 10) !== plannedEffectiveFrom
    ) {
        fail("A valid planned effective date is required");
    }

    const latest = await findLatestRiskPolicy(policyId, currency);

    const rules = structuredClone(
        input.rules ?? latest?.rules ?? DEFAULT_RISK_RULES
    );

    const thresholds = structuredClone(
        input.thresholds ??
        latest?.thresholds ??
        DEFAULT_RISK_THRESHOLDS
    );

    validateConfiguration(rules, thresholds);
    validateLockedSeededRules(rules);
    const now = new Date();

    const document = {
        _id: randomUUID(),
        policyId,
        policyName: policyName.trim(),
        description: description.trim(),
        plannedEffectiveFrom,
        version: latest ? latest.version + 1 : 1,
        currency,
        isDefault: !latest || latest.isDefault === true,
        status: "Draft",
        rules,
        thresholds,
        effectiveFrom: null,
        effectiveTo: null,
        createdBy: actorId,
        createdAt: now,
        updatedAt: now
    };

    try {
        return await insertRiskPolicy(document);
    } catch (error) {
        if (error.code === 11000) {
            fail(
                "A policy version with this identifier already exists",
                409
            );
        }

        throw error;
    }
}

export async function modifyDraftRiskPolicy(
    id,
    input,
    actorId
) {
    await requirePolicyAdministrator(actorId);

    const policy = await getRiskPolicy(id);

    if (policy.status !== "Draft") {
        fail(
            "Only draft policies can be modified. Create a new version.",
            409
        );
    }

    if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input).length === 0 ||
        Object.keys(input).some(
            key => !["rules", "thresholds"].includes(key)
        )
    ) {
        fail("Only draft rules and thresholds may be modified");
    }

    const rules = structuredClone(
        input.rules ?? policy.rules
    );

    const thresholds = structuredClone(
        input.thresholds ?? policy.thresholds
    );

    validateConfiguration(rules, thresholds);
    validateLockedSeededRules(rules);

    const updated = await updateDraftRiskPolicy(
        id,
        {
            rules,
            thresholds
        },
        policy.updatedAt
    );


    if (!updated) {
        fail("Draft policy is no longer editable", 409);
    }

    return updated;
}

export async function activateRiskPolicy(
    id,
    actorId
) {
    await requirePolicyAdministrator(actorId);

    const policy = await getRiskPolicy(id);

    if (policy.status !== "Draft") {
        fail("Only draft policies can be activated", 409);
    }

    validateConfiguration(
        policy.rules,
        policy.thresholds
    );

    const latest = await findLatestRiskPolicy(
        policy.policyId,
        policy.currency
    );

    if (latest._id !== policy._id) {
        fail("Only the latest policy version can be activated", 409);
    }

    try {
        return await activateRiskPolicyVersion(id);
    } catch (error) {
        if (
            error.code === 11000 ||
            error.code === 112 ||
            error.hasErrorLabel?.("TransientTransactionError")
        ) {
            fail("Concurrent policy activation conflict", 409);
        }

        throw error;
    }
}