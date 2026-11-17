
import test from "node:test";
import assert from "node:assert/strict";

import {
    validateApprovalTransition,
    isEligibleForFinancialExecution
} from "../src/services/approval-lifecycle.service.js";

import {
    applyApprovalStageDecision
} from "../src/services/approval-stage-transition.js";

import {
    validateNewApprovalWorkflow
} from "../src/services/approval-workflow-document.service.js";

import {
    APPROVAL_STATUS,
    isValidApprovalStatus,
    isTerminalApprovalStatus
} from "../src/constants/approval-status.js";

function createPolicy() {
    return {
        policyId: "AP-001",
        version: 1,
        approvalRequired: true,
        requiredRoles: [
            "OperationsReviewer",
            "SeniorReviewer"
        ]
    };
}

function createWorkflow(overrides = {}) {
    return {
        workflowId: "WF-001",
        transactionId: "TX-001",
        assessmentId: "RA-001",
        approvalPolicyId: "AP-001",
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
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

test("Valid initial approval workflow is accepted", () => {
    assert.equal(
        validateNewApprovalWorkflow(
            createWorkflow(),
            createPolicy()
        ),
        true
    );
});

test("Workflow with wrong approval policy is rejected", () => {
    assert.throws(
        () => validateNewApprovalWorkflow(
            createWorkflow({
                approvalPolicyId: "WRONG"
            }),
            createPolicy()
        ),
        /policy reference/
    );
});

test("Workflow with wrong policy version is rejected", () => {
    assert.throws(
        () => validateNewApprovalWorkflow(
            createWorkflow({
                approvalPolicyVersion: 2
            }),
            createPolicy()
        ),
        /policy reference/
    );
});

test("Workflow must initially be pending", () => {
    assert.throws(
        () => validateNewApprovalWorkflow(
            createWorkflow({ status: "Approved" }),
            createPolicy()
        ),
        /initial workflow state/
    );
});

test("Workflow must initially start at stage one", () => {
    assert.throws(
        () => validateNewApprovalWorkflow(
            createWorkflow({ currentStage: 2 }),
            createPolicy()
        ),
        /initial workflow state/
    );
});

test("Workflow must have required number of stages", () => {
    const workflow = createWorkflow();

    workflow.requiredStages.pop();

    assert.throws(
        () => validateNewApprovalWorkflow(
            workflow,
            createPolicy()
        ),
        /initial workflow state/
    );
});

test("Workflow stages must have correct reviewer roles", () => {
    const workflow = createWorkflow();

    workflow.requiredStages[0].requiredRole =
        "ComplianceReviewer";

    assert.throws(
        () => validateNewApprovalWorkflow(
            workflow,
            createPolicy()
        ),
        /stage configuration/
    );
});

test("Second stage cannot initially be pending", () => {
    const workflow = createWorkflow();

    workflow.requiredStages[1].status = "Pending";

    assert.throws(
        () => validateNewApprovalWorkflow(
            workflow,
            createPolicy()
        ),
        /stage configuration/
    );
});

test("Invalid workflow timestamps are rejected", () => {
    assert.throws(
        () => validateNewApprovalWorkflow(
            createWorkflow({
                createdAt: new Date("invalid")
            }),
            createPolicy()
        ),
        /timestamps/
    );
});

test("First approval advances to second stage", () => {
    const original = createWorkflow();

    const updated = applyApprovalStageDecision(
        original,
        "Approved"
    );

    assert.equal(updated.status, "InReview");
    assert.equal(updated.currentStage, 2);

    assert.equal(
        updated.requiredStages[0].status,
        "Approved"
    );

    assert.equal(
        updated.requiredStages[1].status,
        "Pending"
    );
});

test("Final approval completes workflow", () => {
    let workflow = createWorkflow();

    workflow = applyApprovalStageDecision(
        workflow,
        "Approved"
    );

    workflow = applyApprovalStageDecision(
        workflow,
        "Approved"
    );

    assert.equal(workflow.status, "Approved");
    assert.equal(workflow.currentStage, null);

    assert.equal(
        workflow.requiredStages.every(
            stage => stage.status === "Approved"
        ),
        true
    );
});

test("Rejecting first stage cancels later stages", () => {
    const result = applyApprovalStageDecision(
        createWorkflow(),
        "Rejected"
    );

    assert.equal(result.status, "Rejected");
    assert.equal(result.currentStage, null);

    assert.equal(
        result.requiredStages[0].status,
        "Rejected"
    );

    assert.equal(
        result.requiredStages[1].status,
        "Cancelled"
    );
});

test("Rejecting second stage preserves previous approval", () => {
    let workflow = createWorkflow();

    workflow = applyApprovalStageDecision(
        workflow,
        "Approved"
    );

    workflow = applyApprovalStageDecision(
        workflow,
        "Rejected"
    );

    assert.equal(workflow.status, "Rejected");

    assert.equal(
        workflow.requiredStages[0].status,
        "Approved"
    );

    assert.equal(
        workflow.requiredStages[1].status,
        "Rejected"
    );
});

test("Approved workflow cannot be approved again", () => {
    let workflow = createWorkflow();

    workflow = applyApprovalStageDecision(
        workflow,
        "Approved"
    );

    workflow = applyApprovalStageDecision(
        workflow,
        "Approved"
    );

    assert.throws(
        () => applyApprovalStageDecision(
            workflow,
            "Approved"
        ),
        /not actionable/
    );
});

test("Rejected workflow cannot receive more decisions", () => {
    const workflow = applyApprovalStageDecision(
        createWorkflow(),
        "Rejected"
    );

    assert.throws(
        () => applyApprovalStageDecision(
            workflow,
            "Approved"
        ),
        /not actionable/
    );
});

test("Invalid approval decision is rejected", () => {
    assert.throws(
        () => applyApprovalStageDecision(
            createWorkflow(),
            "Maybe"
        ),
        /Invalid approval decision/
    );
});

test("Previous stages must be approved first", () => {
    const workflow = createWorkflow({
        status: "InReview",
        currentStage: 2
    });

    workflow.requiredStages[1].status = "Pending";

    assert.throws(
        () => applyApprovalStageDecision(
            workflow,
            "Approved"
        ),
        /Previous stages/
    );
});

test("Next stage must be waiting before advancement", () => {
    const workflow = createWorkflow();

    workflow.requiredStages[1].status = "Approved";

    assert.throws(
        () => applyApprovalStageDecision(
            workflow,
            "Approved"
        ),
        /Invalid next stage/
    );
});

test("Approval operation does not mutate original workflow", () => {
    const original = createWorkflow();

    const updated = applyApprovalStageDecision(
        original,
        "Approved"
    );

    assert.notStrictEqual(updated, original);

    assert.equal(original.status, "Pending");
    assert.equal(original.currentStage, 1);

    assert.equal(
        original.requiredStages[0].status,
        "Pending"
    );
});

test("Valid approval transitions are accepted", () => {
    const transitions = [
        ["Pending", "InReview"],
        ["Pending", "Approved"],
        ["Pending", "Rejected"],
        ["Pending", "Escalated"],
        ["Pending", "Cancelled"],
        ["InReview", "Approved"],
        ["InReview", "Rejected"],
        ["InReview", "Escalated"],
        ["Escalated", "InReview"],
        ["Escalated", "Approved"],
        ["Escalated", "Rejected"],
        ["Escalated", "Cancelled"]
    ];

    for (const [from, to] of transitions) {
        assert.equal(
            validateApprovalTransition(from, to),
            true
        );
    }
});

test("Terminal approval states cannot transition", () => {
    const terminal = [
        "NotRequired",
        "Approved",
        "Rejected",
        "Cancelled"
    ];

    for (const status of terminal) {
        assert.throws(
            () => validateApprovalTransition(
                status,
                "Pending"
            ),
            /Invalid approval transition/
        );
    }
});

test("Invalid approval statuses are rejected", () => {
    assert.equal(
        isValidApprovalStatus("Unknown"),
        false
    );

    assert.throws(
        () => validateApprovalTransition(
            "Unknown",
            "Approved"
        ),
        /Invalid approval status/
    );
});

test("Terminal status helper classifies statuses", () => {
    assert.equal(
        isTerminalApprovalStatus("Approved"),
        true
    );

    assert.equal(
        isTerminalApprovalStatus("Rejected"),
        true
    );

    assert.equal(
        isTerminalApprovalStatus("Pending"),
        false
    );

    assert.equal(
        isTerminalApprovalStatus("Escalated"),
        false
    );
});

test("Low-risk transaction without approval can execute", () => {
    const transaction = {
        transactionId: "TX-001",
        status: "Pending",
        riskLevel: "Low",
        approvalRequired: false,
        approvalStatus: APPROVAL_STATUS.NOT_REQUIRED,
        approvalWorkflowId: null
    };

    assert.equal(
        isEligibleForFinancialExecution(transaction),
        true
    );
});

test("Low-risk transaction with inconsistent approval state cannot execute", () => {
    const transaction = {
        status: "Pending",
        riskLevel: "Low",
        approvalRequired: false,
        approvalStatus: "Pending",
        approvalWorkflowId: null
    };

    assert.equal(
        isEligibleForFinancialExecution(transaction),
        false
    );
});

test("High-risk transaction with pending approval cannot execute", () => {
    const transaction = {
        transactionId: "TX-001",
        status: "Pending",
        riskLevel: "High",
        approvalRequired: true,
        approvalStatus: "Pending",
        approvalWorkflowId: "WF-001"
    };

    assert.equal(
        isEligibleForFinancialExecution(
            transaction,
            createWorkflow()
        ),
        false
    );
});

test("Fully approved high-risk transaction can execute", () => {
    let workflow = createWorkflow();

    workflow = applyApprovalStageDecision(
        workflow,
        "Approved"
    );

    workflow = applyApprovalStageDecision(
        workflow,
        "Approved"
    );

    const transaction = {
        transactionId: "TX-001",
        status: "Pending",
        riskLevel: "High",
        approvalRequired: true,
        approvalStatus: "Approved",
        approvalWorkflowId: "WF-001"
    };

    assert.equal(
        isEligibleForFinancialExecution(
            transaction,
            workflow
        ),
        true
    );
});

test("Approved transaction with mismatched workflow cannot execute", () => {
    const workflow = createWorkflow({
        transactionId: "TX-OTHER",
        status: "Approved"
    });

    workflow.requiredStages.forEach(
        stage => stage.status = "Approved"
    );

    const transaction = {
        transactionId: "TX-001",
        status: "Pending",
        riskLevel: "High",
        approvalRequired: true,
        approvalStatus: "Approved",
        approvalWorkflowId: "WF-001"
    };

    assert.equal(
        isEligibleForFinancialExecution(
            transaction,
            workflow
        ),
        false
    );
});

test("Completed transactions cannot execute again", () => {
    assert.equal(
        isEligibleForFinancialExecution({
            status: "Completed",
            approvalRequired: false,
            riskLevel: "Low",
            approvalStatus: "NotRequired",
            approvalWorkflowId: null
        }),
        false
    );
});

test("Rejected transactions cannot execute", () => {
    assert.equal(
        isEligibleForFinancialExecution({
            status: "Rejected",
            approvalRequired: false,
            riskLevel: "Low",
            approvalStatus: "NotRequired",
            approvalWorkflowId: null
        }),
        false
    );
});
