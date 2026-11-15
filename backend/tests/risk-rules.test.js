import test from "node:test";
import assert from "node:assert/strict";

import {
    evaluateTransactionRisk,
    DEFAULT_RISK_RULES,
    DEFAULT_RISK_THRESHOLDS
} from "../src/services/risk-assessment.service.js";

const policy = {
    policyId: "RISK-POLICY-001",
    version: 1,
    rules: DEFAULT_RISK_RULES,
    thresholds: DEFAULT_RISK_THRESHOLDS
};

function createContext() {
    return {
        amountMinor: 100000,
        currency: "CAD",
        sourceBalanceMinor: 50000000,
        sourceAccountStatus: "Active",
        destinationAccountStatus: "Active",
        sourceClientStatus: "Active",
        destinationClientStatus: "Active",
        recentTransactionCount: 0,
        recentTransferVolumeMinor: 0
    };
}

function evaluate(changes = {}) {
    return evaluateTransactionRisk(
        { ...createContext(), ...changes },
        policy
    );
}

function hasRule(result, ruleId) {
    return result.triggeredRules.some(
        rule => rule.ruleId === ruleId
    );
}

test("5.4: default rule points match specification", () => {
    assert.deepEqual(
        DEFAULT_RISK_RULES.map(rule => rule.points),
        [15, 20, 25, 15, 20, 15, 30, 30]
    );
});

test("5.4: RISK-001 triggers at 10000", () => {
    const result = evaluate({ amountMinor: 1000000 });

    assert.equal(hasRule(result, "RISK-001"), true);
    assert.equal(result.riskScore, 15);
});

test("5.4: RISK-002 triggers at 50000", () => {
    const result = evaluate({ amountMinor: 5000000 });

    assert.equal(hasRule(result, "RISK-002"), true);
    assert.equal(result.riskScore, 35);
});

test("5.4: RISK-003 triggers at 100000", () => {
    const result = evaluate({ amountMinor: 10000000 });

    assert.equal(hasRule(result, "RISK-003"), true);
    assert.equal(result.riskScore, 60);
});

test("5.4: RISK-004 triggers after five completed transfers", () => {
    const result = evaluate({
        recentTransactionCount: 5
    });

    assert.equal(hasRule(result, "RISK-004"), true);
    assert.equal(result.riskScore, 15);
});

test("5.4: RISK-005 triggers at 100000 transfer volume", () => {
    const result = evaluate({
        recentTransferVolumeMinor: 10000000
    });

    assert.equal(hasRule(result, "RISK-005"), true);
    assert.equal(result.riskScore, 20);
});

test("5.4: RISK-006 triggers above 50 percent balance", () => {
    const result = evaluate({
        amountMinor: 600000,
        sourceBalanceMinor: 1000000
    });

    assert.equal(hasRule(result, "RISK-006"), true);
    assert.equal(result.riskScore, 15);
});

test("5.4: RISK-006 does not trigger at exactly 50 percent", () => {
    const result = evaluate({
        amountMinor: 500000,
        sourceBalanceMinor: 1000000
    });

    assert.equal(hasRule(result, "RISK-006"), false);
});

test("5.4: RISK-007 triggers for inactive source client", () => {
    const result = evaluate({
        sourceClientStatus: "Inactive"
    });

    assert.equal(hasRule(result, "RISK-007"), true);
    assert.equal(result.riskScore, 30);
});

test("5.4: RISK-008 triggers for suspended destination client", () => {
    const result = evaluate({
        destinationClientStatus: "Suspended"
    });

    assert.equal(hasRule(result, "RISK-008"), true);
    assert.equal(result.riskScore, 30);
});

test("5.4: amount rules are cumulative", () => {
    const result = evaluate({
        amountMinor: 12000000
    });

    assert.deepEqual(
        result.triggeredRules.map(rule => rule.ruleId),
        ["RISK-001", "RISK-002", "RISK-003"]
    );

    assert.equal(result.riskScore, 60);
    assert.equal(result.riskLevel, "High");
});

test("5.4: CAD and USD use the same nominal thresholds", () => {
    const cad = evaluate({
        amountMinor: 5000000,
        currency: "CAD"
    });

    const usd = evaluate({
        amountMinor: 5000000,
        currency: "USD"
    });

    assert.equal(cad.riskScore, usd.riskScore);
    assert.equal(cad.riskScore, 35);
});

test("5.4: triggered rules record points and inputs", () => {
    const result = evaluate({
        recentTransactionCount: 5
    });

    const rule = result.triggeredRules.find(
        item => item.ruleId === "RISK-004"
    );

    assert.equal(rule.points, 15);
    assert.equal(rule.evaluatedInput, 5);
    assert.equal(typeof rule.reason, "string");
    assert.ok(rule.reason.length > 0);
});

test("5.4: risk score is capped at 100", () => {
    const result = evaluate({
        amountMinor: 12000000,
        sourceBalanceMinor: 15000000,
        recentTransactionCount: 5,
        recentTransferVolumeMinor: 10000000,
        sourceClientStatus: "Suspended",
        destinationClientStatus: "Inactive"
    });

    assert.equal(result.riskScore, 100);
    assert.equal(result.riskLevel, "Critical");
    assert.equal(result.approvalRequired, true);
});