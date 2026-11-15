import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
    validateEscalationDecisionDocument
} from "../src/services/approval-escalation-document.service.js";

const actor = {
    actorId: "ACTOR-OPERATIONS-001",
    role: "OperationsReviewer",
    active: true
};

function createFixture() {
    const workflow = {
        workflowId: "WF-001",
        transactionId: "TXN-001",
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
        escalation: {
            stageNumber: 1,
            requestedBy: "ACTOR-OPERATIONS-001",
            destinationRole: "ComplianceReviewer",
            reason: "Additional review required",
            status: "Pending"
        }
    };

    const decision = {
        decisionId: randomUUID(),
        workflowId: "WF-001",
        transactionId: "TXN-001",
        stageNumber: 1,
        actorId: actor.actorId,
        actorRole: actor.role,
        decision: "Escalated",
        reviewType: "EscalationRequest",
        destinationRole: "ComplianceReviewer",
        comments: "Additional review required",
        decidedAt: new Date(),
        idempotencyKey: "escalation-test-001"
    };

    return { workflow, decision };
}

test("6.9: valid escalation request", () => {
    const { workflow, decision } = createFixture();

    assert.equal(
        validateEscalationDecisionDocument(
            decision,
            workflow,
            actor
        ),
        true
    );
});

test("6.9: invalid escalation destination is rejected", () => {
    const { workflow, decision } = createFixture();

    decision.destinationRole = "SeniorReviewer";

    assert.throws(() =>
        validateEscalationDecisionDocument(
            decision,
            workflow,
            actor
        )
    );
});

test("6.9: wrong escalation actor is rejected", () => {
    const { workflow, decision } = createFixture();

    decision.actorId = "ACTOR-SENIOR-001";

    assert.throws(() =>
        validateEscalationDecisionDocument(
            decision,
            workflow,
            actor
        )
    );
});