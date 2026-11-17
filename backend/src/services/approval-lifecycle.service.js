import {
    APPROVAL_STATUS,
    isValidApprovalStatus
} from "../constants/approval-status.js";

const ALLOWED_TRANSITIONS = Object.freeze({
    [APPROVAL_STATUS.NOT_REQUIRED]: [],
    [APPROVAL_STATUS.PENDING]: [
        APPROVAL_STATUS.IN_REVIEW,
        APPROVAL_STATUS.APPROVED,
        APPROVAL_STATUS.REJECTED,
        APPROVAL_STATUS.ESCALATED,
        APPROVAL_STATUS.CANCELLED
    ],
    [APPROVAL_STATUS.IN_REVIEW]: [
        APPROVAL_STATUS.APPROVED,
        APPROVAL_STATUS.REJECTED,
        APPROVAL_STATUS.ESCALATED,
        APPROVAL_STATUS.CANCELLED
    ],
    [APPROVAL_STATUS.APPROVED]: [],
    [APPROVAL_STATUS.REJECTED]: [],
    [APPROVAL_STATUS.ESCALATED]: [
        APPROVAL_STATUS.IN_REVIEW,
        APPROVAL_STATUS.APPROVED,
        APPROVAL_STATUS.REJECTED,
        APPROVAL_STATUS.CANCELLED
    ],
    [APPROVAL_STATUS.CANCELLED]: []
});

export function validateApprovalTransition(
    currentStatus,
    nextStatus
) {
    if (
        !isValidApprovalStatus(currentStatus) ||
        !isValidApprovalStatus(nextStatus)
    ) {
        throw new Error("Invalid approval status");
    }

    const allowed = ALLOWED_TRANSITIONS[currentStatus];

    if (!allowed.includes(nextStatus)) {
        throw new Error(
            `Invalid approval transition: ${currentStatus} to ${nextStatus}`
        );
    }

    return true;
}

export function isEligibleForFinancialExecution(
    transaction,
    workflow = null
) {
    if (!transaction || transaction.status !== "Pending") {
        return false;
    }

    if (transaction.approvalRequired === false) {
        return (
            transaction.riskLevel === "Low" &&
            transaction.approvalStatus ===
                APPROVAL_STATUS.NOT_REQUIRED &&
            transaction.approvalWorkflowId == null
        );
    }

    if (transaction.approvalRequired !== true) {
        return false;
    }

    if (
        transaction.approvalStatus !==
            APPROVAL_STATUS.APPROVED ||
        !workflow ||
        workflow.status !== APPROVAL_STATUS.APPROVED ||
        workflow.transactionId !== transaction.transactionId ||
        workflow.workflowId !== transaction.approvalWorkflowId ||
        !Array.isArray(workflow.requiredStages) ||
        workflow.requiredStages.length === 0
    ) {
        return false;
    }

    return workflow.requiredStages.every(
        stage => stage.status === APPROVAL_STATUS.APPROVED
    );
}