import test from "node:test";
import assert from "node:assert/strict";

import {
    applyApprovalStageDecision
} from "../src/services/approval-stage-transition.js";

function createWorkflow() {
    return {
        workflowId: "WORKFLOW-001",
        status: "Pending",
        currentStage: 1,
        requiredStages: [
            {
                stageNumber: 1,
                requiredRole: "OperationsReviewer",
                status: "Pending"
            },
            {
                stageNumber: 2,
                requiredRole: "SeniorReviewer",
                status: "Waiting"
            }
        ]
    };
}

test("6.2: first approval unlocks second stage", () => {
    const result = applyApprovalStageDecision(
        createWorkflow(),
        "Approved"
    );

    assert.equal(result.status, "InReview");
    assert.equal(result.currentStage, 2);
    assert.equal(result.requiredStages[0].status, "Approved");
    assert.equal(result.requiredStages[1].status, "Pending");
});

test("6.2: final approval completes workflow", () => {
    const first = applyApprovalStageDecision(
        createWorkflow(),
        "Approved"
    );

    const second = applyApprovalStageDecision(
        first,
        "Approved"
    );

    assert.equal(second.status, "Approved");
    assert.equal(second.currentStage, null);

    assert.ok(
        second.requiredStages.every(
            stage => stage.status === "Approved"
        )
    );
});

test("6.2: rejection terminates workflow", () => {
    const result = applyApprovalStageDecision(
        createWorkflow(),
        "Rejected"
    );

    assert.equal(result.status, "Rejected");
    assert.equal(result.currentStage, null);
    assert.equal(result.requiredStages[0].status, "Rejected");
    assert.equal(result.requiredStages[1].status, "Cancelled");
});

test("6.2: rejected workflow cannot be approved", () => {
    const rejected = applyApprovalStageDecision(
        createWorkflow(),
        "Rejected"
    );

    assert.throws(() => {
        applyApprovalStageDecision(rejected, "Approved");
    }, /not actionable/);
});

test("6.2: completed workflow cannot be approved again", () => {
    const first = applyApprovalStageDecision(
        createWorkflow(),
        "Approved"
    );

    const completed = applyApprovalStageDecision(
        first,
        "Approved"
    );

    assert.throws(() => {
        applyApprovalStageDecision(completed, "Approved");
    }, /not actionable/);
});

test("6.2: inactive stage cannot be skipped", () => {
    const workflow = createWorkflow();
    workflow.currentStage = 2;

    assert.throws(() => {
        applyApprovalStageDecision(workflow, "Approved");
    }, /not actionable|Previous stages/);
});

test("6.2: transition does not mutate original workflow", () => {
    const workflow = createWorkflow();

    applyApprovalStageDecision(workflow, "Approved");

    assert.equal(workflow.status, "Pending");
    assert.equal(workflow.currentStage, 1);
    assert.equal(workflow.requiredStages[1].status, "Waiting");
});