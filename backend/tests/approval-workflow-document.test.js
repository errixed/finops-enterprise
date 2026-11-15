import test from "node:test";
import assert from "node:assert/strict";

import {
    validateNewApprovalWorkflow
} from "../src/services/approval-workflow-document.service.js";

const approvalPolicy = {
    policyId: "APPROVAL-POLICY-HIGH",
    version: 1,
    approvalRequired: true,
    requiredRoles: [
        "OperationsReviewer",
        "SeniorReviewer"
    ]
};

function createWorkflow() {
    const now = new Date();

    return {
        workflowId: "WF-001",
        transactionId: "TXN-001",
        assessmentId: "ASSESSMENT-001",
        approvalPolicyId: "APPROVAL-POLICY-HIGH",
        approvalPolicyVersion: 1,
        status: "Pending",
        currentStage: 1,
        requiredStages: [
            {
                stageNumber: 1,
                requiredRole: "OperationsReviewer",
                status: "Pending"
            },
            {
                stageNumber: 2,
                requiredRole: "SeniorReviewer",
                status: "Waiting"
            }
        ],
        createdAt: now,
        updatedAt: now
    };
}

test("6.7: valid workflow document", () => {
    assert.equal(
        validateNewApprovalWorkflow(
            createWorkflow(),
            approvalPolicy
        ),
        true
    );
});

test("6.7: requires transaction reference", () => {
    const workflow = createWorkflow();
    workflow.transactionId = "";

    assert.throws(() =>
        validateNewApprovalWorkflow(workflow, approvalPolicy)
    );
});

test("6.7: requires assessment reference", () => {
    const workflow = createWorkflow();
    workflow.assessmentId = "";

    assert.throws(() =>
        validateNewApprovalWorkflow(workflow, approvalPolicy)
    );
});

test("6.7: first stage must be Pending", () => {
    const workflow = createWorkflow();
    workflow.requiredStages[0].status = "Waiting";

    assert.throws(() =>
        validateNewApprovalWorkflow(workflow, approvalPolicy)
    );
});

test("6.7: second stage must be Waiting", () => {
    const workflow = createWorkflow();
    workflow.requiredStages[1].status = "Pending";

    assert.throws(() =>
        validateNewApprovalWorkflow(workflow, approvalPolicy)
    );
});

test("6.7: reviewer order must match policy", () => {
    const workflow = createWorkflow();
    workflow.requiredStages[0].requiredRole = "SeniorReviewer";

    assert.throws(() =>
        validateNewApprovalWorkflow(workflow, approvalPolicy)
    );
});

test("6.7: policy version must match", () => {
    const workflow = createWorkflow();
    workflow.approvalPolicyVersion = 2;

    assert.throws(() =>
        validateNewApprovalWorkflow(workflow, approvalPolicy)
    );
});

test("6.7: invalid timestamps are rejected", () => {
    const workflow = createWorkflow();
    workflow.createdAt = "not-a-date";

    assert.throws(() =>
        validateNewApprovalWorkflow(workflow, approvalPolicy)
    );
});