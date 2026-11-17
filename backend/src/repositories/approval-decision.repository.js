import {
    getCollection
} from "./mongodb.repository.js";

const decisions = () => getCollection("approval_decisions");

export async function initializeApprovalDecisionIndexes() {
    await decisions().createIndexes([
        {
            key: { decisionId: 1 },
            unique: true,
            name: "idx_approval_decision_id"
        },
        {
            key: { workflowId: 1, idempotencyKey: 1 },
            unique: true,
            name: "idx_approval_decision_idempotency"
        },
        {
            key: { workflowId: 1, stageNumber: 1 },
            name: "idx_approval_decision_stage"
        },
        {
            key: { workflowId: 1, decidedAt: 1 },
            name: "idx_approval_decision_history"
        }
    ]);
}

export async function findDecisionByIdempotencyKey(
    workflowId,
    idempotencyKey,
    session
) {
    return decisions().findOne(
        {
            workflowId,
            idempotencyKey
        },
        { session }
    );
}

export async function findApprovedDecisionByActor(
    workflowId,
    actorId,
    session
) {
    return decisions().findOne(
        {
            workflowId,
            actorId,
            decision: "Approved"
        },
        { session }
    );
}


export async function insertApprovalDecision(
    decision,
    session
) {
    if (!session?.inTransaction()) {
        throw new Error(
            "An active MongoDB transaction is required"
        );
    }

    await decisions().insertOne(
        decision,
        { session }
    );

    return decision;
}


export async function listApprovalDecisions(
    workflowId,
    session
) {
    return decisions()
        .find({ workflowId }, { session })
        .sort({ decidedAt: 1, stageNumber: 1 })
        .toArray();
}