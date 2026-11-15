import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
    validateApprovalDecisionDocument
} from "../src/services/approval-decision-document.service.js";

const actor = {
    actorId: "ACTOR-OPERATIONS-001",
    name: "Olivia Chen",
    role: "OperationsReviewer",
    active: true
};

const workflow = {
    workflowId: "WF-001",
    transactionId: "TXN-001",
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
    ]
};

function createDecision() {
    return {
        decisionId: randomUUID(),
        workflowId: "WF-001",
        transactionId: "TXN-001",
        stageNumber: 1,
        actorId: "ACTOR-OPERATIONS-001",
        actorRole: "OperationsReviewer",
        decision: "Approved",
        comments: "Transaction reviewed and approved.",
        decidedAt: new Date(),
        idempotencyKey: "approval-test-001"
    };
}

test("6.8: valid approval decision document", () => {
    assert.equal(
        validateApprovalDecisionDocument(
            createDecision(),
            workflow,
            actor
        ),
        true
    );
});

test("6.8: invalid UUID is rejected", () => {
    const decision = createDecision();
    decision.decisionId = "INVALID";

    assert.throws(() =>
        validateApprovalDecisionDocument(decision, workflow, actor),
        /Invalid decision ID/
    );
});

test("6.8: incorrect workflow reference is rejected", () => {
    const decision = createDecision();
    decision.workflowId = "WF-OTHER";

    assert.throws(() =>
        validateApprovalDecisionDocument(decision, workflow, actor),
        /reference mismatch/
    );
});

test("6.8: inactive stage is rejected", () => {
    const decision = createDecision();
    decision.stageNumber = 2;

    assert.throws(() =>
        validateApprovalDecisionDocument(decision, workflow, actor),
        /Invalid decision stage/
    );
});

test("6.8: client-supplied incorrect role is rejected", () => {
    const decision = createDecision();
    decision.actorRole = "SeniorReviewer";

    assert.throws(() =>
        validateApprovalDecisionDocument(decision, workflow, actor),
        /Invalid decision actor or role/
    );
});

test("6.8: rejection requires comments", () => {
    const decision = createDecision();
    decision.decision = "Rejected";
    decision.comments = "";

    assert.throws(() =>
        validateApprovalDecisionDocument(decision, workflow, actor),
        /Decision comments are required/
    );
});

test("6.8: escalation is a valid document decision type", () => {
    const decision = createDecision();
    decision.decision = "Escalated";
    decision.comments = "Requires higher-level review.";

    assert.equal(
        validateApprovalDecisionDocument(decision, workflow, actor),
        true
    );
});

test("6.8: invalid timestamp is rejected", () => {
    const decision = createDecision();
    decision.decidedAt = "2026-11-14";

    assert.throws(() =>
        validateApprovalDecisionDocument(decision, workflow, actor),
        /Invalid decision timestamp/
    );
});

test("6.8: missing idempotency key is rejected", () => {
    const decision = createDecision();
    decision.idempotencyKey = "";

    assert.throws(() =>
        validateApprovalDecisionDocument(decision, workflow, actor),
        /Invalid decision idempotency key/
    );
});