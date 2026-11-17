const REQUIRED_ROLES = {
    Medium: ["OperationsReviewer"],
    High: ["OperationsReviewer", "SeniorReviewer"],
    Critical: ["SeniorReviewer", "ComplianceReviewer"]
};

export function verifyApprovalDecisionHistory(
    transaction,
    workflow,
    decisions
) {
    if (
        !transaction ||
        !workflow ||
        !Array.isArray(decisions) ||
        workflow.status !== "Approved" ||
        transaction.approvalStatus !== "Approved" ||
        workflow.transactionId !== transaction.transactionId ||
        workflow.workflowId !== transaction.approvalWorkflowId ||
        workflow.assessmentId !== transaction.riskAssessmentId
    ) {
        return false;
    }

    const roles = REQUIRED_ROLES[transaction.riskLevel];

    if (
        !roles ||
        !Array.isArray(workflow.requiredStages) ||
        workflow.requiredStages.length !== roles.length
    ) {
        return false;
    }

    const approvals = decisions.filter(
        decision =>
            decision.decision === "Approved" &&
            decision.reviewType !== "EscalationReview"
    );

    if (approvals.length !== roles.length) {
        return false;
    }

    const approvedActors = new Set();

    for (let index = 0; index < roles.length; index++) {
        const stage = workflow.requiredStages[index];

        if (
            stage.stageNumber !== index + 1 ||
            stage.requiredRole !== roles[index] ||
            stage.status !== "Approved"
        ) {
            return false;
        }

        const matching = approvals.filter(
            decision =>
                decision.stageNumber === stage.stageNumber &&
                decision.actorRole === stage.requiredRole &&
                decision.workflowId === workflow.workflowId &&
                decision.transactionId === transaction.transactionId
        );

        if (matching.length !== 1) {
            return false;
        }

        const decision = matching[0];

        if (
            typeof decision.actorId !== "string" ||
            !decision.actorId.trim() ||
            !(decision.decidedAt instanceof Date) ||
            Number.isNaN(decision.decidedAt.getTime()) ||
            approvedActors.has(decision.actorId)
        ) {
            return false;
        }

        approvedActors.add(decision.actorId);
    }

    for (let index = 1; index < approvals.length; index++) {
        const previous = approvals.find(
            decision => decision.stageNumber === index
        );

        const current = approvals.find(
            decision => decision.stageNumber === index + 1
        );

        if (
            !previous ||
            !current ||
            previous.decidedAt > current.decidedAt
        ) {
            return false;
        }
    }

    if (
        !workflow.escalation &&
        decisions.some(
            decision =>
                decision.decision === "Escalated" ||
                decision.reviewType === "EscalationReview"
        )
    ) {
        return false;
    }

if (workflow.escalation) {
    const escalation = workflow.escalation;

    if (
        escalation.status !== "Approved" ||
        typeof escalation.requestedBy !== "string" ||
        typeof escalation.reviewedBy !== "string" ||
        typeof escalation.destinationRole !== "string" ||
        typeof escalation.reason !== "string" ||
        !escalation.reason.trim() ||
        !(escalation.requestedAt instanceof Date) ||
        Number.isNaN(escalation.requestedAt.getTime()) ||
        !(escalation.reviewedAt instanceof Date) ||
        Number.isNaN(escalation.reviewedAt.getTime())
    ) {
        return false;
    }

    const requests = decisions.filter(
        decision =>
            decision.reviewType === "EscalationRequest" &&
            decision.decision === "Escalated"
    );

    const reviews = decisions.filter(
        decision =>
            decision.reviewType === "EscalationReview" &&
            decision.decision === "Approved"
    );

    if (
        requests.length !== 1 ||
        reviews.length !== 1
    ) {
        return false;
    }

    const request = requests[0];
    const review = reviews[0];

    if (
        !(request.decidedAt instanceof Date) ||
        !(review.decidedAt instanceof Date) ||
        Number.isNaN(request.decidedAt.getTime()) ||
        Number.isNaN(review.decidedAt.getTime())
    ) {
        return false;
    }

    if (
        request.workflowId !== workflow.workflowId ||
        review.workflowId !== workflow.workflowId ||
        request.transactionId !== transaction.transactionId ||
        review.transactionId !== transaction.transactionId ||
        request.stageNumber !== escalation.stageNumber ||
        review.stageNumber !== escalation.stageNumber ||
        request.actorId !== escalation.requestedBy ||
        request.actorRole !== workflow.requiredStages.find(
            stage => stage.stageNumber === escalation.stageNumber
        )?.requiredRole ||
        request.destinationRole !== escalation.destinationRole ||
        request.comments !== escalation.reason ||
        review.actorId !== escalation.reviewedBy ||
        review.actorRole !== escalation.destinationRole
    ) {
        return false;
    }

    if (
        request.decidedAt.getTime() !==
            escalation.requestedAt.getTime() ||
        review.decidedAt.getTime() !==
            escalation.reviewedAt.getTime()
    ) {
        return false;
    }

    if (
        request.decidedAt > review.decidedAt
    ) {
        return false;
    }

    const originalApproval = approvals.find(
        decision =>
            decision.stageNumber === escalation.stageNumber
    );

    if (
        !originalApproval ||
        review.decidedAt > originalApproval.decidedAt
    ) {
        return false;
    }
}

    if (
        decisions.some(
            decision =>
                decision.workflowId !== workflow.workflowId ||
                decision.transactionId !== transaction.transactionId ||
                decision.decision === "Rejected"
        )
    ) {
        return false;
    }

    return true;
}