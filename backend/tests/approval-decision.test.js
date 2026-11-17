
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
    validateApprovalDecisionDocument
} from "../src/services/approval-decision-document.service.js";

function createWorkflow() {
    return {
        workflowId: "WF-001",
        transactionId: "TX-001",
        currentStage: 1,
        requiredStages: [
            {
                stageNumber: 1,
                requiredRole: "OperationsReviewer",
                status: "Pending"
            }
        ]
    };
}

function createActor() {
    return {
        actorId: "USER-001",
        role: "OperationsReviewer",
        active: true
    };
}

function createDecision(overrides = {}) {
    return {
        decisionId: randomUUID(),
        workflowId: "WF-001",
        transactionId: "TX-001",
        stageNumber: 1,
        actorId: "USER-001",
        actorRole: "OperationsReviewer",
        decision: "Approved",
        comments: "Reviewed and approved",
        decidedAt: new Date(),
        idempotencyKey: randomUUID(),
        ...overrides
    };
}

test("Valid approval decision is accepted", () => {
    assert.equal(
        validateApprovalDecisionDocument(
            createDecision(),
            createWorkflow(),
            createActor()
        ),
        true
    );
});

test("Valid rejection decision is accepted", () => {
    assert.equal(
        validateApprovalDecisionDocument(
            createDecision({ decision: "Rejected" }),
            createWorkflow(),
            createActor()
        ),
        true
    );
});

test("Valid escalation decision is accepted", () => {
    assert.equal(
        validateApprovalDecisionDocument(
            createDecision({ decision: "Escalated" }),
            createWorkflow(),
            createActor()
        ),
        true
    );
});

const invalidCases = [
    {
        name: "Invalid decision UUID",
        changes: { decisionId: "INVALID" },
        message: /Invalid decision ID/
    },
    {
        name: "Missing workflow ID",
        changes: { workflowId: "" },
        message: /Invalid decision references/
    },
    {
        name: "Incorrect workflow reference",
        changes: { workflowId: "WF-OTHER" },
        message: /reference mismatch/
    },
    {
        name: "Incorrect transaction reference",
        changes: { transactionId: "TX-OTHER" },
        message: /reference mismatch/
    },
    {
        name: "Incorrect stage",
        changes: { stageNumber: 2 },
        message: /Invalid decision stage/
    },
    {
        name: "Incorrect actor",
        changes: { actorId: "OTHER-USER" },
        message: /Invalid decision actor or role/
    },
    {
        name: "Incorrect reviewer role",
        changes: { actorRole: "SeniorReviewer" },
        message: /Invalid decision actor or role/
    },
    {
        name: "Unsupported decision",
        changes: { decision: "Maybe" },
        message: /Invalid approval decision/
    },
    {
        name: "Missing comments",
        changes: { comments: "" },
        message: /Decision comments are required/
    },
    {
        name: "Whitespace-only comments",
        changes: { comments: "   " },
        message: /Decision comments are required/
    },
    {
        name: "Comments exceeding maximum length",
        changes: { comments: "A".repeat(2001) },
        message: /Decision comments are required/
    },
    {
        name: "Invalid timestamp",
        changes: { decidedAt: "2026-01-01" },
        message: /Invalid decision timestamp/
    },
    {
        name: "Invalid Date object",
        changes: { decidedAt: new Date("invalid") },
        message: /Invalid decision timestamp/
    },
    {
        name: "Missing idempotency key",
        changes: { idempotencyKey: "" },
        message: /Invalid decision idempotency key/
    },
    {
        name: "Oversized idempotency key",
        changes: { idempotencyKey: "X".repeat(129) },
        message: /Invalid decision idempotency key/
    }
];

for (const scenario of invalidCases) {
    test(scenario.name, () => {
        assert.throws(
            () => validateApprovalDecisionDocument(
                createDecision(scenario.changes),
                createWorkflow(),
                createActor()
            ),
            scenario.message
        );
    });
}

test("Inactive reviewer cannot approve", () => {
    const actor = createActor();
    actor.active = false;

    assert.throws(
        () => validateApprovalDecisionDocument(
            createDecision(),
            createWorkflow(),
            actor
        ),
        /Invalid decision actor or role/
    );
});

test("Reviewer cannot approve another role's stage", () => {
    const workflow = createWorkflow();

    workflow.requiredStages[0].requiredRole =
        "SeniorReviewer";

    assert.throws(
        () => validateApprovalDecisionDocument(
            createDecision(),
            workflow,
            createActor()
        ),
        /Invalid decision actor or role/
    );
});

test("Already approved stage cannot receive another decision", () => {
    const workflow = createWorkflow();

    workflow.requiredStages[0].status = "Approved";

    assert.throws(
        () => validateApprovalDecisionDocument(
            createDecision(),
            workflow,
            createActor()
        ),
        /not actionable/
    );
});

test("Waiting stage cannot receive a decision", () => {
    const workflow = createWorkflow();

    workflow.requiredStages[0].status = "Waiting";

    assert.throws(
        () => validateApprovalDecisionDocument(
            createDecision(),
            workflow,
            createActor()
        ),
        /not actionable/
    );
});

test("Missing actor is rejected", () => {
    assert.throws(
        () => validateApprovalDecisionDocument(
            createDecision(),
            createWorkflow(),
            null
        ),
        /Invalid decision actor or role/
    );
});
