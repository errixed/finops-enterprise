import {
    APPROVAL_STATUS
} from "../constants/approval-status.js";

export function validateNewApprovalWorkflow(
    workflow,
    approvalPolicy
) {
    if (
        !workflow ||
        !approvalPolicy ||
        typeof workflow.workflowId !== "string" ||
        !workflow.workflowId.trim() ||
        typeof workflow.transactionId !== "string" ||
        !workflow.transactionId.trim() ||
        typeof workflow.assessmentId !== "string" ||
        !workflow.assessmentId.trim()
    ) {
        throw new Error("Invalid approval workflow references");
    }

    if (
        workflow.approvalPolicyId !== approvalPolicy.policyId ||
        workflow.approvalPolicyVersion !== approvalPolicy.version
    ) {
        throw new Error("Invalid approval policy reference");
    }

    if (
        !approvalPolicy.approvalRequired ||
        !Array.isArray(approvalPolicy.requiredRoles) ||
        approvalPolicy.requiredRoles.length === 0
    ) {
        throw new Error("Approval policy requires no workflow");
    }

    if (
        workflow.status !== APPROVAL_STATUS.PENDING ||
        workflow.currentStage !== 1 ||
        !Array.isArray(workflow.requiredStages) ||
        workflow.requiredStages.length !==
            approvalPolicy.requiredRoles.length
    ) {
        throw new Error("Invalid initial workflow state");
    }

    for (let i = 0; i < workflow.requiredStages.length; i++) {
        const stage = workflow.requiredStages[i];

        if (
            stage.stageNumber !== i + 1 ||
            stage.requiredRole !==
                approvalPolicy.requiredRoles[i] ||
            stage.status !== (i === 0 ? "Pending" : "Waiting")
        ) {
            throw new Error(
                "Invalid approval workflow stage configuration"
            );
        }
    }

    if (
        !(workflow.createdAt instanceof Date) ||
        Number.isNaN(workflow.createdAt.getTime()) ||
        !(workflow.updatedAt instanceof Date) ||
        Number.isNaN(workflow.updatedAt.getTime())
    ) {
        throw new Error("Invalid workflow timestamps");
    }

    return true;
}