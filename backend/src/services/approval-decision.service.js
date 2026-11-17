import { randomUUID } from "node:crypto";
import {
    getMongoClient
} from "../config/mongodb.js";
import {
    findActiveWorkflowActor
} from "../repositories/workflow-actor.repository.js";
import {
    findApprovalWorkflowById,
    updateApprovalWorkflowState
} from "../repositories/approval-workflow.repository.js";
import {
    findDecisionByIdempotencyKey,
    findApprovedDecisionByActor,
    insertApprovalDecision
} from "../repositories/approval-decision.repository.js";
import {
    updateTransactionApprovalStatus
} from "../repositories/transaction.repository.js";
import {
    applyApprovalStageDecision
} from "./approval-stage-transition.js";
import {
    validateApprovalDecisionDocument
} from "./approval-decision-document.service.js";

import {
    reviewApprovalEscalation
} from "./approval-escalation.service.js";

function decisionError(message, code = "APPROVAL_CONFLICT", statusCode = 409) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
}

function validateDecisionRequest(input, idempotencyKey) {
    if (
        !input ||
        typeof input.actorId !== "string" ||
        !input.actorId.trim() ||
        !["Approved", "Rejected"].includes(input.decision) ||
        typeof input.comments !== "string" ||
        !input.comments.trim() ||
        input.comments.trim().length > 2000
    ) {
        throw decisionError(
            "Valid actor, decision and comments are required",
            "INVALID_DECISION",
            400
        );
    }

    if (
        typeof idempotencyKey !== "string" ||
        !idempotencyKey.trim() ||
        idempotencyKey.length > 128
    ) {
        throw decisionError(
            "A valid Idempotency-Key header is required",
            "INVALID_IDEMPOTENCY_KEY",
            400
        );
    }

    return {
        actorId: input.actorId.trim(),
        decision: input.decision,
        comments: input.comments.trim(),
        idempotencyKey: idempotencyKey.trim()
    };
}

function checkRepeatedDecision(existing, request) {
    if (
        existing.decision === "Escalated" ||
        existing.actorId !== request.actorId ||
        existing.decision !== request.decision ||
        existing.comments !== request.comments
    ) {
        throw decisionError(
            "Idempotency key was used for another decision",
            "IDEMPOTENCY_CONFLICT",
            409
        );
    }

    return {
        workflow: existing.workflowSnapshot,
        decision: existing,
        replayed: true
    };
}

export async function submitApprovalDecision(
    workflowId,
    input,
    idempotencyKey
) {
    if (
        typeof workflowId !== "string" ||
        !workflowId.trim()
    ) {
        throw decisionError(
            "Invalid workflow ID",
            "INVALID_WORKFLOW",
            400
        );
    }

    const request = validateDecisionRequest(
        input,
        idempotencyKey
    );

    const previousDecision = await findDecisionByIdempotencyKey(
        workflowId,
        request.idempotencyKey
    );

    if (previousDecision) {
        return checkRepeatedDecision(
            previousDecision,
            request
        );
    }

    const currentWorkflow = await findApprovalWorkflowById(
        workflowId
    );

    if (currentWorkflow?.status === "Escalated") {
        return reviewApprovalEscalation(
            workflowId,
            request,
            request.idempotencyKey
        );
    }

    const session = getMongoClient().startSession();

    try {
        return await session.withTransaction(async () => {
            const repeated = await findDecisionByIdempotencyKey(
                workflowId,
                request.idempotencyKey,
                session
            );

            if (repeated) {
                return checkRepeatedDecision(
                    repeated,
                    request
                );
            }

            const workflow = await findApprovalWorkflowById(
                workflowId,
                session
            );

            if (!workflow) {
                throw decisionError(
                    "Approval workflow not found",
                    "WORKFLOW_NOT_FOUND",
                    404
                );
            }

            if (!["Pending", "InReview"].includes(workflow.status)) {
                throw decisionError(
                    "Approval workflow is not actionable"
                );
            }

            const stage = workflow.requiredStages?.find(
                item => item.stageNumber === workflow.currentStage
            );

            if (!stage || stage.status !== "Pending") {
                throw decisionError(
                    "Only the active approval stage may receive a decision"
                );
            }

            const actor = await findActiveWorkflowActor(
                request.actorId,
                session
            );

            if (!actor || actor.role !== stage.requiredRole) {
                throw decisionError(
                    "Reviewer does not have the required simulated role",
                    "INVALID_REVIEWER_ROLE"
                );
            }

            const previousApproval = await findApprovedDecisionByActor(
                workflowId,
                actor.actorId,
                session
            );

            if (previousApproval) {
                throw decisionError(
                    "Reviewer already approved another stage of this workflow",
                    "DUPLICATE_REVIEWER"
                );
            }

            if (
                workflow.escalation?.stageNumber === workflow.currentStage &&
                workflow.escalation?.status === "Pending"
            ) {
                throw decisionError(
                    "Escalation review must be completed first"
                );
            }

            const updatedWorkflow = applyApprovalStageDecision(
                workflow,
                request.decision
            );

            const now = new Date();

            const changed = await updateApprovalWorkflowState(
                workflow,
                updatedWorkflow,
                session
            );

            if (!changed) {
                throw decisionError(
                    "Approval workflow changed during review"
                );
            }

            const transactionUpdated =
                await updateTransactionApprovalStatus({
                    transactionId: workflow.transactionId,
                    workflowId: workflow.workflowId,
                    expectedApprovalStatus: workflow.status,
                    nextApprovalStatus: updatedWorkflow.status,
                    session
                });

            if (!transactionUpdated) {
                throw decisionError(
                    "Transaction approval state is inconsistent"
                );
            }

            updatedWorkflow.updatedAt = now;

            const decision = {
                decisionId: randomUUID(),
                workflowId: workflow.workflowId,
                transactionId: workflow.transactionId,
                stageNumber: stage.stageNumber,
                actorId: actor.actorId,
                actorRole: actor.role,
                decision: request.decision,
                comments: request.comments,
                decidedAt: now,
                idempotencyKey: request.idempotencyKey,
                workflowSnapshot: updatedWorkflow
            };

            validateApprovalDecisionDocument(
                decision,
                workflow,
                actor
            );

            await insertApprovalDecision(
                decision,
                session
            );

            return {
                workflow: updatedWorkflow,
                decision,
                replayed: false
            };
        }, {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
            readPreference: "primary"
        });
    } catch (error) {
        const recorded = await findDecisionByIdempotencyKey(
            workflowId,
            request.idempotencyKey
        );

        if (recorded) {
            return checkRepeatedDecision(recorded, request);
        }

        if (
            error.code === 11000 ||
            error.code === 112 ||
            error.hasErrorLabel?.("TransientTransactionError")
        ) {
            throw decisionError(
                "A concurrent approval decision conflicted. Retry the request."
            );
        }

        throw error;
    } finally {
        await session.endSession();
    }
}