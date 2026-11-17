import {
    validateApprovalDecisionDocument
} from "./approval-decision-document.service.js";

export function validateEscalationDecisionDocument(
    decision,
    workflow,
    actor
) {
    if (
        !["EscalationRequest", "EscalationReview"].includes(
            decision?.reviewType
        )
    ) {
        throw new Error("Invalid escalation decision type");
    }

    if (
        !workflow ||
        !workflow.escalation ||
        !Array.isArray(workflow.requiredStages)
    ) {
        throw new Error("Invalid escalation workflow");
    }

    const stage = workflow.requiredStages.find(
        item => item.stageNumber === workflow.currentStage
    );

    if (
        !stage ||
        stage.status !== "Pending" ||
        workflow.escalation.stageNumber !== stage.stageNumber
    ) {
        throw new Error("Invalid escalation stage");
    }

    if (
        !actor ||
        actor.active !== true ||
        actor.actorId !== decision.actorId ||
        actor.role !== decision.actorRole
    ) {
        throw new Error("Invalid escalation actor");
    }

    const expectedRole =
        decision.reviewType === "EscalationRequest"
            ? stage.requiredRole
            : workflow.escalation.destinationRole;

    if (actor.role !== expectedRole) {
        throw new Error("Incorrect escalation reviewer role");
    }

    if (
        decision.reviewType === "EscalationRequest" &&
        (
            decision.decision !== "Escalated" ||
            decision.destinationRole !==
                workflow.escalation.destinationRole ||
            workflow.escalation.requestedBy !== actor.actorId ||
            decision.comments !== workflow.escalation.reason
        )
    ) {
        throw new Error("Invalid escalation request");
    }

    if (
        decision.reviewType === "EscalationReview" &&
        (
            !["Approved", "Rejected"].includes(decision.decision) ||
            workflow.escalation.status !== "Pending"
        )
    ) {
        throw new Error("Invalid escalation review");
    }

    const validationWorkflow = {
        ...workflow,
        currentStage: stage.stageNumber,
        requiredStages: [
            {
                stageNumber: stage.stageNumber,
                requiredRole: expectedRole,
                status: "Pending"
            }
        ]
    };

    return validateApprovalDecisionDocument(
        decision,
        validationWorkflow,
        actor
    );
}