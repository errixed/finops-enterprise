export const TRANSACTION_STATUS = Object.freeze({
    PENDING: "Pending",
    PROCESSING: "Processing",
    COMPLETED: "Completed",
    REJECTED: "Rejected"
});

const ALLOWED_TRANSITIONS = Object.freeze({
    Pending: ["Processing"],
    Processing: ["Completed", "Rejected"],
    Completed: [],
    Rejected: []
});

export function canTransition(fromStatus, toStatus) {
    return (
        ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus) ??
        false
    );
}

export function isEligibleForProcessing(transaction) {
    return (
        transaction?.status === TRANSACTION_STATUS.PENDING &&
        transaction.isLegacy === false
    );
}

export const TRANSACTION_REJECTION_CODES = Object.freeze({
    INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
    SOURCE_ACCOUNT_INACTIVE: "SOURCE_ACCOUNT_INACTIVE",
    DESTINATION_ACCOUNT_INACTIVE: "DESTINATION_ACCOUNT_INACTIVE",
    CURRENCY_MISMATCH: "CURRENCY_MISMATCH",
    ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
    BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION"
});