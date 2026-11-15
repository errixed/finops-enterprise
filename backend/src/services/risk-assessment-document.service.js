import { randomUUID } from "node:crypto";

import {
    insertRiskAssessment
} from "../repositories/risk-assessment.repository.js";

import {
    validateRiskPolicy
} from "./risk-assessment.service.js";

export function validateAssessmentResult(result, policy) {
    validateRiskPolicy(policy);

    if (
        !result ||
        result.policyId !== policy.policyId ||
        result.policyVersion !== policy.version ||
        !Array.isArray(result.triggeredRules)
    ) {
        throw new Error("Invalid assessment policy reference");
    }

    const ruleIds = new Set();
    let total = 0;

    for (const triggered of result.triggeredRules) {
        const configured = policy.rules.find(
            rule => rule.ruleId === triggered.ruleId
        );

        if (
            !configured ||
            ruleIds.has(triggered.ruleId) ||
            configured.points !== triggered.points ||
            typeof triggered.reason !== "string" ||
            triggered.reason.trim().length === 0 ||
            !Object.hasOwn(triggered, "evaluatedInput") ||
            triggered.evaluatedInput === null
        ) {
            throw new Error("Invalid triggered risk rule");
        }

        ruleIds.add(triggered.ruleId);
        total += triggered.points;
    }

    const expectedScore = Math.min(100, total);

    if (
        !Number.isInteger(result.riskScore) ||
        result.riskScore !== expectedScore
    ) {
        throw new Error("Risk score does not match rule contributions");
    }

    const expectedLevel = policy.thresholds.find(
        threshold =>
            expectedScore >= threshold.min &&
            expectedScore <= threshold.max
    )?.level;

    if (
        result.riskLevel !== expectedLevel ||
        result.approvalRequired !== (expectedLevel !== "Low")
    ) {
        throw new Error("Invalid risk classification");
    }

    return true;
}

export async function recordRiskAssessment({
    transactionId,
    result,
    policy,
    session,
    assessedAt = new Date()
}) {
    if (
        typeof transactionId !== "string" ||
        transactionId.trim().length === 0
    ) {
        throw new Error("Invalid transaction ID");
    }

    if (!session?.inTransaction()) {
        throw new Error(
            "An active MongoDB transaction is required"
        );
    }

    validateAssessmentResult(result, policy);

    const date = new Date(assessedAt);

    if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid assessment timestamp");
    }

    const assessment = {
        assessmentId: randomUUID(),
        transactionId,
        policyId: result.policyId,
        policyVersion: result.policyVersion,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        approvalRequired: result.approvalRequired,
        triggeredRules: structuredClone(result.triggeredRules),
        assessedAt: date
    };

    return insertRiskAssessment(assessment, session);
}