import test from "node:test";
import assert from "node:assert/strict";

import {
    validateApprovalTransition,
    isEligibleForFinancialExecution
} from "../src/services/approval-lifecycle.service.js";

test("6.4: pending workflow can enter review", () => {
    assert.equal(
        validateApprovalTransition("Pending", "InReview"),
        true
    );
});

test("6.4: pending workflow can be rejected", () => {
    assert.equal(
        validateApprovalTransition("Pending", "Rejected"),
        true
    );
});

test("6.4: rejected workflow cannot be approved", () => {
    assert.throws(() => {
        validateApprovalTransition("Rejected", "Approved");
    }, /Invalid approval transition/);
});

test("6.4: approved workflow cannot be reopened", () => {
    assert.throws(() => {
        validateApprovalTransition("Approved", "InReview");
    });
});

test("6.4: escalation does not automatically approve", () => {
    assert.equal(
        validateApprovalTransition("InReview", "Escalated"),
        true
    );

    assert.equal(
        validateApprovalTransition("Escalated", "InReview"),
        true
    );
});

test("6.4: low risk can be eligible without approval", () => {
    const transaction = {
        status: "Pending",
        riskLevel: "Low",
        approvalRequired: false,
        approvalStatus: "NotRequired",
        approvalWorkflowId: null
    };

    assert.equal(
        isEligibleForFinancialExecution(transaction),
        true
    );
});

test("6.4: pending approval blocks processing", () => {
    const transaction = {
        transactionId: "TXN-001",
        status: "Pending",
        approvalRequired: true,
        approvalStatus: "Pending",
        approvalWorkflowId: "WF-001"
    };

    assert.equal(
        isEligibleForFinancialExecution(transaction),
        false
    );
});

test("6.4: approved workflow permits eligibility", () => {
    const transaction = {
        transactionId: "TXN-001",
        status: "Pending",
        approvalRequired: true,
        approvalStatus: "Approved",
        approvalWorkflowId: "WF-001"
    };

    const workflow = {
        workflowId: "WF-001",
        transactionId: "TXN-001",
        status: "Approved",
        requiredStages: [
            { stageNumber: 1, status: "Approved" },
            { stageNumber: 2, status: "Approved" }
        ]
    };

    assert.equal(
        isEligibleForFinancialExecution(
            transaction,
            workflow
        ),
        true
    );
});

test("6.4: incomplete stages block processing", () => {
    const transaction = {
        transactionId: "TXN-001",
        status: "Pending",
        approvalRequired: true,
        approvalStatus: "Approved",
        approvalWorkflowId: "WF-001"
    };

    const workflow = {
        workflowId: "WF-001",
        transactionId: "TXN-001",
        status: "Approved",
        requiredStages: [
            { stageNumber: 1, status: "Approved" },
            { stageNumber: 2, status: "Waiting" }
        ]
    };

    assert.equal(
        isEligibleForFinancialExecution(
            transaction,
            workflow
        ),
        false
    );
});