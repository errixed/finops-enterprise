import test from "node:test";
import assert from "node:assert/strict";

import {
    evaluateTransactionRisk,
    validateRiskPolicy,
    DEFAULT_RISK_RULES,
    DEFAULT_RISK_THRESHOLDS
} from "../src/services/risk-assessment.service.js";

const defaultPolicy = {
    policyId: "RISK-POLICY-001",
    version: 1,
    rules: DEFAULT_RISK_RULES,
    thresholds: DEFAULT_RISK_THRESHOLDS
};

const transactionContext = {
    amountMinor: 12000000,
    currency: "CAD",
    sourceBalanceMinor: 50000000,
    sourceAccountStatus: "Active",
    destinationAccountStatus: "Active",
    sourceClientStatus: "Active",
    destinationClientStatus: "Active",
    recentTransactionCount: 0,
    recentTransferVolumeMinor: 0
};

test("5.3: calculate additive risk score", () => {
    const result = evaluateTransactionRisk(
        transactionContext,
        defaultPolicy
    );

    assert.equal(result.riskScore, 60);
    assert.equal(result.riskLevel, "High");
});

test("5.3: support configurable rule points", () => {
    const policy = {
        ...defaultPolicy,
        rules: DEFAULT_RISK_RULES.map(rule =>
            rule.ruleId === "RISK-001"
                ? { ...rule, points: 35 }
                : { ...rule }
        )
    };

    const result = evaluateTransactionRisk(
        transactionContext,
        policy
    );

    assert.equal(result.riskScore, 80);
    assert.equal(result.riskLevel, "Critical");
});

test("5.3: support configurable risk thresholds", () => {
    const policy = {
        ...defaultPolicy,
        thresholds: [
            { level: "Low", min: 0, max: 19 },
            { level: "Medium", min: 20, max: 39 },
            { level: "High", min: 40, max: 69 },
            { level: "Critical", min: 70, max: 100 }
        ]
    };

    const result = evaluateTransactionRisk(
        transactionContext,
        policy
    );

    assert.equal(result.riskScore, 60);
    assert.equal(result.riskLevel, "High");
});

test("5.3: reject threshold gaps", () => {
    const policy = {
        ...defaultPolicy,
        thresholds: [
            { level: "Low", min: 0, max: 20 },
            { level: "Medium", min: 25, max: 49 },
            { level: "High", min: 50, max: 74 },
            { level: "Critical", min: 75, max: 100 }
        ]
    };

    assert.throws(() => validateRiskPolicy(policy));
});

test("5.3: reject overlapping thresholds", () => {
    const policy = {
        ...defaultPolicy,
        thresholds: [
            { level: "Low", min: 0, max: 30 },
            { level: "Medium", min: 25, max: 49 },
            { level: "High", min: 50, max: 74 },
            { level: "Critical", min: 75, max: 100 }
        ]
    };

    assert.throws(() => validateRiskPolicy(policy));
});

test("5.3: cap additive score at 100", () => {
    const policy = {
        ...defaultPolicy,
        rules: DEFAULT_RISK_RULES.map(rule => ({
            ...rule,
            points: 100
        }))
    };

    const result = evaluateTransactionRisk(
        transactionContext,
        policy
    );

    assert.equal(result.riskScore, 100);
    assert.equal(result.riskLevel, "Critical");
});

test("5.3: reject policies missing required risk rules", () => {
    const invalidPolicy = {
        ...defaultPolicy,
        rules: DEFAULT_RISK_RULES.filter(
            rule => rule.ruleId !== "RISK-008"
        )
    };

    assert.throws(
        () => validateRiskPolicy(invalidPolicy),
        /Missing required risk rule/
    );
});