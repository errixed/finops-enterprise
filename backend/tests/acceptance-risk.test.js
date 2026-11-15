import test from "node:test";
import assert from "node:assert/strict";

import {
    evaluateTransactionRisk,
    validateRiskPolicy,
    DEFAULT_RISK_RULES,
    DEFAULT_RISK_THRESHOLDS
} from "../src/services/risk-assessment.service.js";

function createPolicy(version = 1) {
    return {
        policyId: "RISK-POLICY-CAD",
        version,
        rules: structuredClone(DEFAULT_RISK_RULES),
        thresholds: structuredClone(DEFAULT_RISK_THRESHOLDS)
    };
}

function createContext(overrides = {}) {
    return {
        amountMinor: 100000,
        currency: "CAD",
        sourceBalanceMinor: 100000000,
        sourceAccountStatus: "Active",
        destinationAccountStatus: "Active",
        sourceClientStatus: "Active",
        destinationClientStatus: "Active",
        recentTransactionCount: 0,
        recentTransferVolumeMinor: 0,
        ...overrides
    };
}

test("RISK-01: low-risk assessment needs no approval", () => {
    const result = evaluateTransactionRisk(
        createContext(),
        createPolicy()
    );

    assert.equal(result.riskLevel, "Low");
    assert.equal(result.riskScore, 0);
    assert.equal(result.approvalRequired, false);
});

test("RISK-02: medium-risk assessment requires approval", () => {
    const result = evaluateTransactionRisk(
        createContext({
            amountMinor: 1000000,
            recentTransactionCount: 5
        }),
        createPolicy()
    );

    assert.equal(result.riskLevel, "Medium");
    assert.equal(result.riskScore, 30);
    assert.equal(result.approvalRequired, true);
});

test("RISK-03: high-risk assessment requires approval", () => {
    const result = evaluateTransactionRisk(
        createContext({
            amountMinor: 10000000
        }),
        createPolicy()
    );

    assert.equal(result.riskLevel, "High");
    assert.equal(result.riskScore, 60);
    assert.equal(result.approvalRequired, true);
});

test("RISK-04: critical-risk assessment requires approval", () => {
    const result = evaluateTransactionRisk(
        createContext({
            amountMinor: 10000000,
            recentTransactionCount: 5,
            recentTransferVolumeMinor: 10000000
        }),
        createPolicy()
    );

    assert.equal(result.riskLevel, "Critical");
    assert.equal(result.riskScore, 95);
    assert.equal(result.approvalRequired, true);
});

test("RISK-05: multiple triggered rules accumulate points", () => {
    const result = evaluateTransactionRisk(
        createContext({
            amountMinor: 10000000
        }),
        createPolicy()
    );

    assert.deepEqual(
        result.triggeredRules.map(rule => rule.ruleId),
        ["RISK-001", "RISK-002", "RISK-003"]
    );

    assert.equal(
        result.triggeredRules.reduce(
            (sum, rule) => sum + rule.points,
            0
        ),
        60
    );

    assert.equal(result.riskScore, 60);
});

test("RISK-06: risk score is capped at 100", () => {
    const result = evaluateTransactionRisk(
        createContext({
            amountMinor: 10000000,
            recentTransactionCount: 5,
            recentTransferVolumeMinor: 10000000,
            sourceClientStatus: "Inactive",
            destinationClientStatus: "Suspended"
        }),
        createPolicy()
    );

    const uncappedScore = result.triggeredRules.reduce(
        (sum, rule) => sum + rule.points,
        0
    );

    assert.ok(uncappedScore > 100);
    assert.equal(result.riskScore, 100);
    assert.equal(result.riskLevel, "Critical");
});

test("RISK-08: assessment result preserves its policy version", () => {
    const result = evaluateTransactionRisk(
        createContext(),
        createPolicy(7)
    );

    assert.equal(result.policyId, "RISK-POLICY-CAD");
    assert.equal(result.policyVersion, 7);
});

test("RISK-09: invalid policy thresholds are rejected", () => {
    const policy = createPolicy();

    policy.thresholds[1].min = 30;

    assert.throws(
        () => validateRiskPolicy(policy),
        /gaps or overlaps/
    );
});