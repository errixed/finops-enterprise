import test from "node:test";
import assert from "node:assert/strict";

import {
    evaluateTransactionRisk,
    DEFAULT_RISK_RULES,
    DEFAULT_RISK_THRESHOLDS
} from "../src/services/risk-assessment.service.js";

import {
    validateAssessmentResult,
    recordRiskAssessment
} from "../src/services/risk-assessment-document.service.js";

const policy = {
    policyId: "RISK-POLICY-CAD",
    version: 1,
    rules: DEFAULT_RISK_RULES,
    thresholds: DEFAULT_RISK_THRESHOLDS
};

const context = {
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

function createResult() {
    return evaluateTransactionRisk(context, policy);
}

test("5.6: valid assessment passes validation", () => {
    const result = createResult();

    assert.equal(validateAssessmentResult(result, policy), true);
    assert.equal(result.riskScore, 60);
    assert.equal(result.riskLevel, "High");
});

test("5.6: incorrect score is rejected", () => {
    const result = createResult();
    result.riskScore = 55;

    assert.throws(
        () => validateAssessmentResult(result, policy),
        /Risk score does not match/
    );
});

test("5.6: incorrect rule contribution is rejected", () => {
    const result = createResult();
    result.triggeredRules[0].points = 99;

    assert.throws(
        () => validateAssessmentResult(result, policy),
        /Invalid triggered risk rule/
    );
});

test("5.6: incorrect policy version is rejected", () => {
    const result = createResult();
    result.policyVersion = 2;

    assert.throws(
        () => validateAssessmentResult(result, policy),
        /Invalid assessment policy reference/
    );
});

test("5.6: incorrect classification is rejected", () => {
    const result = createResult();
    result.riskLevel = "Low";

    assert.throws(
        () => validateAssessmentResult(result, policy),
        /Invalid risk classification/
    );
});

test("5.6: assessment insertion requires transaction session", async () => {
    await assert.rejects(
        recordRiskAssessment({
            transactionId: "TXN-001",
            result: createResult(),
            policy
        }),
        /active MongoDB transaction/
    );
});

test("5.6: assessment result retains policy version", () => {
    const result = createResult();

    assert.equal(result.policyId, "RISK-POLICY-CAD");
    assert.equal(result.policyVersion, 1);
    assert.equal(validateAssessmentResult(result, policy), true);
});
