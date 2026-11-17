import { randomUUID } from "node:crypto";

import {
    getMongoClient
} from "../config/mongodb.js";

import {
    findApprovalWorkflowById,
    updateApprovalWorkflowState
} from "../repositories/approval-workflow.repository.js";

import {
    findActiveWorkflowActor
} from "../repositories/workflow-actor.repository.js";

import {
    findDecisionByIdempotencyKey,
    insertApprovalDecision
} from "../repositories/approval-decision.repository.js";

import {
    updateTransactionApprovalStatus
} from "../repositories/transaction.repository.js";

import {
    validateApprovalTransition
} from "./approval-lifecycle.service.js";

import {
    validateEscalationDecisionDocument
} from "./approval-escalation-document.service.js";

function fail(message, code = "APPROVAL_CONFLICT", statusCode = 409) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    throw error;
}

export function determineEscalationRole(workflow) {
    const currentStage = workflow.requiredStages?.find(
        stage => stage.stageNumber === workflow.currentStage
    );

    if (!currentStage || currentStage.status !== "Pending") {
        fail("No active approval stage");
    }

    const higherRoles = {
        OperationsReviewer: [
            "SeniorReviewer",
            "ComplianceReviewer"
        ],
        SeniorReviewer: ["ComplianceReviewer"],
        ComplianceReviewer: []
    };

    const candidates = higherRoles[currentStage.requiredRole];

    if (!candidates) {
        fail("Unknown review role");
    }

    const otherRoles = workflow.requiredStages
        .filter(stage => stage.stageNumber !== currentStage.stageNumber)
        .map(stage => stage.requiredRole);

    const destinationRole = candidates.find(
        role => !otherRoles.includes(role)
    );

    if (!destinationRole) {
        fail(
            "No compatible higher-level reviewer is available",
            "ESCALATION_UNAVAILABLE"
        );
    }

    return destinationRole;
}

export async function requestApprovalEscalation(
    workflowId,
    input,
    idempotencyKey
) {
    const actorId = input?.actorId;
    const reason = input?.reason?.trim();

    if (
        typeof workflowId !== "string" ||
        !workflowId.trim() ||
        typeof actorId !== "string" ||
        !actorId.trim() ||
        typeof reason !== "string" ||
        !reason ||
        reason.length > 2000 ||
        typeof idempotencyKey !== "string" ||
        !idempotencyKey.trim() ||
        idempotencyKey.length > 128
    ) {
        fail(
            "Valid actor, reason and idempotency key are required",
            "INVALID_ESCALATION",
            400
        );
    }

    const key = idempotencyKey.trim();
    const session = getMongoClient().startSession();

    try {
        return await session.withTransaction(async () => {
            const existing = await findDecisionByIdempotencyKey(
                workflowId,
                key,
                session
            );

            if (existing) {
                if (
                    existing.decision !== "Escalated" ||
                    existing.actorId !== actorId ||
                    existing.comments !== reason
                ) {
                    fail(
                        "Idempotency key already used for another decision",
                        "IDEMPOTENCY_CONFLICT"
                    );
                }

                return {
                    workflow: existing.workflowSnapshot,
                    decision: existing,
                    replayed: true
                };
            }

            const workflow = await findApprovalWorkflowById(
                workflowId,
                session
            );

            if (!workflow) {
                fail("Workflow not found", "WORKFLOW_NOT_FOUND", 404);
            }

            if (!["Pending", "InReview"].includes(workflow.status)) {
                fail("Workflow cannot be escalated in its current state");
            }


            if (
                workflow.escalation?.stageNumber ===
                workflow.currentStage
            ) {
                fail(
                    "This approval stage has already been escalated",
                    "ESCALATION_ALREADY_REQUESTED"
                );
            }


            const stage = workflow.requiredStages.find(
                item => item.stageNumber === workflow.currentStage
            );

            if (!stage || stage.status !== "Pending") {
                fail("Only an active approval stage can be escalated");
            }

            const actor = await findActiveWorkflowActor(
                actorId,
                session
            );

            if (!actor || actor.role !== stage.requiredRole) {
                fail(
                    "Actor does not have the required reviewer role",
                    "INVALID_REVIEWER_ROLE"
                );
            }

            const destinationRole = determineEscalationRole(
                workflow
            );

            validateApprovalTransition(
                workflow.status,
                "Escalated"
            );

            const now = new Date();

            const updated = structuredClone(workflow);

            updated.status = "Escalated";
            updated.escalation = {
                stageNumber: stage.stageNumber,
                requestedBy: actor.actorId,
                destinationRole,
                reason,
                status: "Pending",
                requestedAt: now,
                reviewedBy: null,
                reviewedAt: null
            };

            const changed = await updateApprovalWorkflowState(
                workflow,
                updated,
                session
            );

            if (!changed) {
                fail("Workflow changed during escalation");
            }

            const transactionChanged =
                await updateTransactionApprovalStatus({
                    transactionId: workflow.transactionId,
                    workflowId: workflow.workflowId,
                    expectedApprovalStatus: workflow.status,
                    nextApprovalStatus: "Escalated",
                    session
                });

            if (!transactionChanged) {
                fail("Transaction approval state is inconsistent");
            }

            const decision = {
                decisionId: randomUUID(),
                reviewType: "EscalationRequest",
                workflowId: workflow.workflowId,
                transactionId: workflow.transactionId,
                stageNumber: stage.stageNumber,
                actorId: actor.actorId,
                actorRole: actor.role,
                decision: "Escalated",
                comments: reason,
                destinationRole,
                decidedAt: now,
                idempotencyKey: key,
                workflowSnapshot: updated
            };

            validateEscalationDecisionDocument(
                decision,
                workflow,
                actor
            );

            await insertApprovalDecision(decision, session);

            return {
                workflow: updated,
                decision,
                replayed: false
            };
        }, {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
            readPreference: "primary"
        });
    } catch (error) {
        if (
            error.code === 11000 ||
            error.code === 112 ||
            error.hasErrorLabel?.("TransientTransactionError")
        ) {
            const recorded = await findDecisionByIdempotencyKey(
                workflowId,
                key
            );

            if (
                recorded &&
                recorded.decision === "Escalated" &&
                recorded.actorId === actorId &&
                recorded.comments === reason
            ) {
                return {
                    workflow: recorded.workflowSnapshot,
                    decision: recorded,
                    replayed: true
                };
            }

            fail("Concurrent escalation conflict");
        }

        throw error;
    } finally {
        await session.endSession();
    }
}

export async function reviewApprovalEscalation(
    workflowId,
    input,
    idempotencyKey
) {
    const actorId = input?.actorId;
    const decisionValue = input?.decision;
    const comments = input?.comments?.trim();

    if (
        typeof actorId !== "string" ||
        !actorId.trim() ||
        !["Approved", "Rejected"].includes(decisionValue) ||
        typeof comments !== "string" ||
        !comments ||
        comments.length > 2000 ||
        typeof idempotencyKey !== "string" ||
        !idempotencyKey.trim() ||
        idempotencyKey.length > 128
    ) {
        fail("Invalid escalation review", "INVALID_DECISION", 400);
    }

    const key = idempotencyKey.trim();
    const session = getMongoClient().startSession();

    try {
        return await session.withTransaction(async () => {
            const previous = await findDecisionByIdempotencyKey(
                workflowId,
                key,
                session
            );

            if (previous) {
                if (
                    previous.actorId !== actorId ||
                    previous.decision !== decisionValue ||
                    previous.comments !== comments ||
                    previous.reviewType !== "EscalationReview"
                ) {
                    fail("Idempotency key conflict", "IDEMPOTENCY_CONFLICT");
                }

                return {
                    workflow: previous.workflowSnapshot,
                    decision: previous,
                    replayed: true
                };
            }

            const workflow = await findApprovalWorkflowById(
                workflowId,
                session
            );

            if (!workflow) {
                fail("Workflow not found", "WORKFLOW_NOT_FOUND", 404);
            }

            if (
                workflow.status !== "Escalated" ||
                workflow.escalation?.status !== "Pending"
            ) {
                fail("No actionable escalation review");
            }

            const stage = workflow.requiredStages.find(
                item => item.stageNumber === workflow.currentStage
            );

            if (
                !stage ||
                stage.status !== "Pending" ||
                workflow.escalation.stageNumber !== stage.stageNumber
            ) {
                fail("Invalid escalation stage");
            }

            const actor = await findActiveWorkflowActor(
                actorId,
                session
            );

            if (
                !actor ||
                actor.role !== workflow.escalation.destinationRole
            ) {
                fail("Reviewer has the wrong escalation role", "INVALID_REVIEWER_ROLE");
            }

            const now = new Date();
            const updated = structuredClone(workflow);

            updated.escalation.status = decisionValue;
            updated.escalation.reviewedBy = actor.actorId;
            updated.escalation.reviewedAt = now;

            if (decisionValue === "Rejected") {
                validateApprovalTransition("Escalated", "Rejected");

                updated.status = "Rejected";
                updated.currentStage = null;
                updated.requiredStages = updated.requiredStages.map(
                    item => item.status === "Approved"
                        ? item
                        : { ...item, status: "Cancelled" }
                );

                updated.escalation.status = "Rejected";
            } else {
                validateApprovalTransition("Escalated", "InReview");

                updated.status = "InReview";
            }

            const changed = await updateApprovalWorkflowState(
                workflow,
                updated,
                session
            );

            if (!changed) {
                fail("Escalation workflow changed");
            }

            const transactionChanged =
                await updateTransactionApprovalStatus({
                    transactionId: workflow.transactionId,
                    workflowId: workflow.workflowId,
                    expectedApprovalStatus: "Escalated",
                    nextApprovalStatus: updated.status,
                    session
                });

            if (!transactionChanged) {
                fail("Transaction approval state mismatch");
            }

            const decision = {
                decisionId: randomUUID(),
                workflowId: workflow.workflowId,
                transactionId: workflow.transactionId,
                stageNumber: stage.stageNumber,
                actorId: actor.actorId,
                actorRole: actor.role,
                decision: decisionValue,
                comments,
                reviewType: "EscalationReview",
                decidedAt: now,
                idempotencyKey: key,
                workflowSnapshot: updated
            };

            validateEscalationDecisionDocument(
                decision,
                workflow,
                actor
            );

            await insertApprovalDecision(decision, session);

            return {
                workflow: updated,
                decision,
                replayed: false
            };
        }, {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
            readPreference: "primary"
        });
    } catch (error) {
        if (
            error.code === 11000 ||
            error.code === 112 ||
            error.hasErrorLabel?.("TransientTransactionError")
        ) {
            const recorded = await findDecisionByIdempotencyKey(
                workflowId,
                key
            );

            if (
                recorded &&
                recorded.reviewType === "EscalationReview" &&
                recorded.actorId === actorId &&
                recorded.decision === decisionValue &&
                recorded.comments === comments
            ) {
                return {
                    workflow: recorded.workflowSnapshot,
                    decision: recorded,
                    replayed: true
                };
            }

            fail("Concurrent escalation review conflict");
        }

        throw error;
    } finally {
        await session.endSession();
    }
}
