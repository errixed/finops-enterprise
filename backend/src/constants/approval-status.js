export const APPROVAL_STATUS = Object.freeze({
    NOT_REQUIRED: "NotRequired",
    PENDING: "Pending",
    IN_REVIEW: "InReview",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    ESCALATED: "Escalated",
    CANCELLED: "Cancelled"
});

export const APPROVAL_STATES = Object.freeze(
    Object.values(APPROVAL_STATUS)
);

export const TERMINAL_APPROVAL_STATES = Object.freeze([
    APPROVAL_STATUS.NOT_REQUIRED,
    APPROVAL_STATUS.APPROVED,
    APPROVAL_STATUS.REJECTED,
    APPROVAL_STATUS.CANCELLED
]);

export function isValidApprovalStatus(status) {
    return APPROVAL_STATES.includes(status);
}

export function isTerminalApprovalStatus(status) {
    return TERMINAL_APPROVAL_STATES.includes(status);
}