import {
    validateApprovalTransition
} from "./approval-lifecycle.service.js";

export function applyApprovalStageDecision(workflow, decision) {
    if (
        !workflow ||
        !["Pending", "InReview"].includes(workflow.status)
    ) {
        throw new Error("Workflow is not actionable");
    }

    if (!["Approved", "Rejected"].includes(decision)) {
        throw new Error("Invalid approval decision");
    }

    const updated = structuredClone(workflow);
    const stages = updated.requiredStages;

    if (
        !Array.isArray(stages) ||
        stages.length === 0 ||
        !Number.isInteger(updated.currentStage)
    ) {
        throw new Error("Invalid workflow stages");
    }

    const stageIndex = stages.findIndex(
        stage => stage.stageNumber === updated.currentStage
    );

    if (stageIndex === -1) {
        throw new Error("Current stage not found");
    }

    const currentStage = stages[stageIndex];

    if (currentStage.status !== "Pending") {
        throw new Error("Current stage is not actionable");
    }

    if (
        stages.slice(0, stageIndex).some(
            stage => stage.status !== "Approved"
        )
    ) {
        throw new Error("Previous stages must be approved");
    }

    if (decision === "Rejected") {
        validateApprovalTransition(
            updated.status,
            "Rejected"
        );

        currentStage.status = "Rejected";

        for (const stage of stages.slice(stageIndex + 1)) {
            stage.status = "Cancelled";
        }

        updated.status = "Rejected";
        updated.currentStage = null;

        return updated;
    }

    currentStage.status = "Approved";

    const nextStage = stages[stageIndex + 1];

    if (nextStage) {
        if (nextStage.status !== "Waiting") {
            throw new Error("Invalid next stage");
        }
        validateApprovalTransition(
            updated.status,
            "InReview"
        );
        nextStage.status = "Pending";
        updated.currentStage = nextStage.stageNumber;
        updated.status = "InReview";
    } else {
        validateApprovalTransition(
            updated.status,
            "Approved"
        );

        updated.currentStage = null;
        updated.status = "Approved";
    }

    return updated;
}