function isUUID(value) {
    return (
        typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    );
}

const VALID_DECISIONS = [
    "Approved",
    "Rejected",
    "Escalated"
];

const VALID_ROLES = [
    "OperationsReviewer",
    "SeniorReviewer",
    "ComplianceReviewer",
    "PolicyAdministrator"
];

export function validateApprovalDecisionDocument(
    document,
    workflow,
    actor
) {
    if (
        !document ||
        typeof document !== "object" ||
        !isUUID(document.decisionId)
    ) {
        throw new Error("Invalid decision ID");
    }

    if (
        typeof document.workflowId !== "string" ||
        !document.workflowId.trim() ||
        typeof document.transactionId !== "string" ||
        !document.transactionId.trim()
    ) {
        throw new Error("Invalid decision references");
    }

    if (
        !workflow ||
        document.workflowId !== workflow.workflowId ||
        document.transactionId !== workflow.transactionId
    ) {
        throw new Error("Decision workflow reference mismatch");
    }

    if (
        !Number.isInteger(document.stageNumber) ||
        document.stageNumber < 1 ||
        document.stageNumber !== workflow.currentStage
    ) {
        throw new Error("Invalid decision stage");
    }

    const stage = workflow.requiredStages?.find(
        item => item.stageNumber === document.stageNumber
    );

    if (
        !stage ||
        stage.status !== "Pending"
    ) {
        throw new Error("Decision stage is not actionable");
    }

    if (
        !actor ||
        actor.active !== true ||
        document.actorId !== actor.actorId ||
        document.actorRole !== actor.role ||
        !VALID_ROLES.includes(document.actorRole) ||
        stage.requiredRole !== document.actorRole
    ) {
        throw new Error("Invalid decision actor or role");
    }

    if (!VALID_DECISIONS.includes(document.decision)) {
        throw new Error("Invalid approval decision");
    }

    if (
        typeof document.comments !== "string" ||
        !document.comments.trim() ||
        document.comments.length > 2000
    ) {
        throw new Error("Decision comments are required");
    }

    if (
        !(document.decidedAt instanceof Date) ||
        Number.isNaN(document.decidedAt.getTime())
    ) {
        throw new Error("Invalid decision timestamp");
    }

    if (
        typeof document.idempotencyKey !== "string" ||
        !document.idempotencyKey.trim() ||
        document.idempotencyKey.length > 128
    ) {
        throw new Error("Invalid decision idempotency key");
    }

    return true;
}