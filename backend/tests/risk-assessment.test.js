
import test from "node:test";
import assert from "node:assert/strict";

import {
    evaluateTransactionRisk,
    DEFAULT_RISK_RULES,
    DEFAULT_RISK_THRESHOLDS
} from "../src/services/risk-assessment.service.js";

test("5.1: identical inputs produce identical risk assessments", () => {
    const policy = {
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

    const first = evaluateTransactionRisk(
        transactionContext,
        policy
    );

    const second = evaluateTransactionRisk(
        transactionContext,
        policy
    );

    assert.deepEqual(first, second);

    assert.equal(first.riskScore, 60);
    assert.equal(first.riskLevel, "High");
    assert.equal(first.approvalRequired, true);

    assert.deepEqual(
        first.triggeredRules.map(rule => rule.ruleId),
        ["RISK-001", "RISK-002", "RISK-003"]
    );
});