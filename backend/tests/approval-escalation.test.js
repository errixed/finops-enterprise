import test from "node:test";
import assert from "node:assert/strict";

import {
    determineEscalationRole
} from "../src/services/approval-escalation.service.js";

function workflow(roles, currentStage = 1) {
    return {
        currentStage,
        requiredStages: roles.map((role, index) => ({
            stageNumber: index + 1,
            requiredRole: role,
            status: index + 1 === currentStage
                ? "Pending"
                : "Waiting"
        }))
    };
}

test("6.9: medium risk escalates to Senior Reviewer", () => {
    const result = determineEscalationRole(
        workflow(["OperationsReviewer"])
    );

    assert.equal(result, "SeniorReviewer");
});

test("6.9: high risk escalates to distinct Compliance Reviewer", () => {
    const result = determineEscalationRole(
        workflow([
            "OperationsReviewer",
            "SeniorReviewer"
        ])
    );

    assert.equal(result, "ComplianceReviewer");
});

test("6.9: Senior Reviewer can escalate to Compliance", () => {
    const result = determineEscalationRole(
        workflow([
            "OperationsReviewer",
            "SeniorReviewer"
        ], 2)
    );

    assert.equal(result, "ComplianceReviewer");
});

test("6.9: no compatible higher reviewer is rejected", () => {
    assert.throws(() => {
        determineEscalationRole(
            workflow([
                "SeniorReviewer",
                "ComplianceReviewer"
            ])
        );
    }, /No compatible higher-level reviewer/);
});

test("6.9: inactive stage cannot escalate", () => {
    const current = workflow(["OperationsReviewer"]);
    current.requiredStages[0].status = "Approved";

    assert.throws(() => {
        determineEscalationRole(current);
    }, /No active approval stage/);
});