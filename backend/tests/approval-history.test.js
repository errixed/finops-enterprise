import test from "node:test";
import assert from "node:assert/strict";

import {
    verifyApprovalDecisionHistory
} from "../src/services/approval-history.service.js";

function createFixture() {
    const transaction = {
        transactionId: "TXN-001",
        riskAssessmentId: "ASSESSMENT-001",
        approvalWorkflowId: "WF-001",
        riskLevel: "High",
        approvalRequired: true,
        approvalStatus: "Approved"
    };

    const workflow = {
        workflowId: "WF-001",
        transactionId: "TXN-001",
        assessmentId: "ASSESSMENT-001",
        status: "Approved",
        currentStage: null,
        requiredStages: [
            {
                stageNumber: 1,
                requiredRole: "OperationsReviewer",
                status: "Approved"
            },
            {
                stageNumber: 2,
                requiredRole: "SeniorReviewer",
                status: "Approved"
            }
        ]
    };

    const decisions = [
        {
            workflowId: "WF-001",
            transactionId: "TXN-001",
            stageNumber: 1,
            actorId: "ACTOR-OPERATIONS-001",
            actorRole: "OperationsReviewer",
            decision: "Approved",
            decidedAt: new Date("2026-11-14T15:00:00Z")
        },
        {
            workflowId: "WF-001",
            transactionId: "TXN-001",
            stageNumber: 2,
            actorId: "ACTOR-SENIOR-001",
            actorRole: "SeniorReviewer",
            decision: "Approved",
            decidedAt: new Date("2026-11-14T15:01:00Z")
        }
    ];

    return { transaction, workflow, decisions };
}

test("6.5: valid approval history permits eligibility", () => {
    const { transaction, workflow, decisions } =
        createFixture();

    assert.equal(
        verifyApprovalDecisionHistory(
            transaction,
            workflow,
            decisions
        ),
        true
    );
});

test("6.5: missing decision blocks execution", () => {
    const { transaction, workflow, decisions } =
        createFixture();

    decisions.pop();

    assert.equal(
        verifyApprovalDecisionHistory(
            transaction,
            workflow,
            decisions
        ),
        false
    );
});

test("6.5: wrong reviewer role blocks execution", () => {
    const { transaction, workflow, decisions } =
        createFixture();

    decisions[1].actorRole = "ComplianceReviewer";

    assert.equal(
        verifyApprovalDecisionHistory(
            transaction,
            workflow,
            decisions
        ),
        false
    );
});

test("6.5: same actor cannot approve two stages", () => {
    const { transaction, workflow, decisions } =
        createFixture();

    decisions[1].actorId = decisions[0].actorId;

    assert.equal(
        verifyApprovalDecisionHistory(
            transaction,
            workflow,
            decisions
        ),
        false
    );
});

test("6.5: reversed approval order blocks execution", () => {
    const { transaction, workflow, decisions } =
        createFixture();

    decisions[0].decidedAt =
        new Date("2026-11-14T15:02:00Z");

    assert.equal(
        verifyApprovalDecisionHistory(
            transaction,
            workflow,
            decisions
        ),
        false
    );
});

test("6.5: rejected decision blocks execution", () => {
    const { transaction, workflow, decisions } =
        createFixture();

    decisions.push({
        workflowId: "WF-001",
        transactionId: "TXN-001",
        stageNumber: 2,
        actorId: "ACTOR-SENIOR-001",
        actorRole: "SeniorReviewer",
        decision: "Rejected",
        decidedAt: new Date("2026-11-14T15:02:00Z")
    });

    assert.equal(
        verifyApprovalDecisionHistory(
            transaction,
            workflow,
            decisions
        ),
        false
    );
});

test("6.5: unresolved escalation blocks execution", () => {
    const { transaction, workflow, decisions } =
        createFixture();

    workflow.escalation = {
        stageNumber: 1,
        status: "Pending"
    };

    assert.equal(
        verifyApprovalDecisionHistory(
            transaction,
            workflow,
            decisions
        ),
        false
    );
});

test("6.5: completed escalation preserves mandatory approvals", () => {
    const { transaction, workflow, decisions } =
        createFixture();

    workflow.escalation = {
        stageNumber: 1,
        status: "Approved",
        requestedBy: "ACTOR-OPERATIONS-001",
        requestedAt: new Date("2026-11-14T15:00:00Z"),
        destinationRole: "ComplianceReviewer",
        reason: "Additional review required",
        reviewedBy: "ACTOR-COMPLIANCE-001",
        reviewedAt: new Date("2026-11-14T15:01:00Z")
    };

    decisions[0].decidedAt =
        new Date("2026-11-14T15:03:00Z");

    decisions[1].decidedAt =
        new Date("2026-11-14T15:04:00Z");


    decisions.push(
        {
            workflowId: "WF-001",
            transactionId: "TXN-001",
            stageNumber: 1,
            actorId: "ACTOR-OPERATIONS-001",
            actorRole: "OperationsReviewer",
            decision: "Escalated",
            reviewType: "EscalationRequest",
            destinationRole: "ComplianceReviewer",
            comments: "Additional review required",
            decidedAt: new Date("2026-11-14T15:00:00Z")
        },
        {
            workflowId: "WF-001",
            transactionId: "TXN-001",
            stageNumber: 1,
            actorId: "ACTOR-COMPLIANCE-001",
            actorRole: "ComplianceReviewer",
            decision: "Approved",
            reviewType: "EscalationReview",
            decidedAt: new Date("2026-11-14T15:01:00Z")
        }
    );

    assert.equal(
        verifyApprovalDecisionHistory(
            transaction,
            workflow,
            decisions
        ),
        true
    );
});

test("6.9: escalation timestamp mismatch blocks execution", () => {
    const { transaction, workflow, decisions } =
        createFixture();

    workflow.escalation = {
        stageNumber: 1,
        status: "Approved",
        requestedBy: "ACTOR-OPERATIONS-001",
        requestedAt: new Date("2026-11-14T14:59:00Z"),
        destinationRole: "ComplianceReviewer",
        reason: "Additional review required",
        reviewedBy: "ACTOR-COMPLIANCE-001",
        reviewedAt: new Date("2026-11-14T15:01:00Z")
    };

    decisions[0].decidedAt =
        new Date("2026-11-14T15:03:00Z");

    decisions[1].decidedAt =
        new Date("2026-11-14T15:04:00Z");

    decisions.push(
        {
            workflowId: "WF-001",
            transactionId: "TXN-001",
            stageNumber: 1,
            actorId: "ACTOR-OPERATIONS-001",
            actorRole: "OperationsReviewer",
            decision: "Escalated",
            reviewType: "EscalationRequest",
            destinationRole: "ComplianceReviewer",
            comments: "Additional review required",
            decidedAt: new Date("2026-11-14T15:00:00Z")
        },
        {
            workflowId: "WF-001",
            transactionId: "TXN-001",
            stageNumber: 1,
            actorId: "ACTOR-COMPLIANCE-001",
            actorRole: "ComplianceReviewer",
            decision: "Approved",
            reviewType: "EscalationReview",
            decidedAt: new Date("2026-11-14T15:01:00Z")
        }
    );

    assert.equal(
        verifyApprovalDecisionHistory(
            transaction,
            workflow,
            decisions
        ),
        false
    );
});

test("6.9: mismatched escalation reason blocks execution", () => {
    const { transaction, workflow, decisions } =
        createFixture();

    workflow.escalation = {
        stageNumber: 1,
        status: "Approved",
        requestedBy: "ACTOR-OPERATIONS-001",
        requestedAt: new Date("2026-11-14T15:00:00Z"),
        destinationRole: "ComplianceReviewer",
        reason: "Different reason",
        reviewedBy: "ACTOR-COMPLIANCE-001",
        reviewedAt: new Date("2026-11-14T15:01:00Z")
    };

    decisions[0].decidedAt =
        new Date("2026-11-14T15:03:00Z");

    decisions[1].decidedAt =
        new Date("2026-11-14T15:04:00Z");

    decisions.push(
        {
            workflowId: "WF-001",
            transactionId: "TXN-001",
            stageNumber: 1,
            actorId: "ACTOR-OPERATIONS-001",
            actorRole: "OperationsReviewer",
            decision: "Escalated",
            reviewType: "EscalationRequest",
            destinationRole: "ComplianceReviewer",
            comments: "Original reason",
            decidedAt: new Date("2026-11-14T15:00:00Z")
        },
        {
            workflowId: "WF-001",
            transactionId: "TXN-001",
            stageNumber: 1,
            actorId: "ACTOR-COMPLIANCE-001",
            actorRole: "ComplianceReviewer",
            decision: "Approved",
            reviewType: "EscalationReview",
            decidedAt: new Date("2026-11-14T15:01:00Z")
        }
    );

    assert.equal(
        verifyApprovalDecisionHistory(
            transaction,
            workflow,
            decisions
        ),
        false
    );
});
