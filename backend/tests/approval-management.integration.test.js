
import test, { before, after } from "node:test";
import assert from "node:assert/strict";

import {
    startIntegrationEnvironment,
    stopIntegrationEnvironment,
    request,
    expectStatus,
    unique
} from "./helpers/integration.js";

before(startIntegrationEnvironment);
after(stopIntegrationEnvironment);

function workflowPayload(overrides = {}) {
    return {
        name: unique("Custom workflow"),
        description: "Approval workflow integration test",
        riskLevels: ["High"],
        stages: [
            "OperationsReviewer",
            "SeniorReviewer"
        ],
        slaHours: 24,
        ...overrides
    };
}

async function createWorkflow(overrides = {}) {
    const response = await request(
        "POST",
        "/approval-workflow-definitions",
        {
            body: workflowPayload(overrides)
        }
    );

    expectStatus(response, 201);
    return response.data;
}

test("Approval policy management lists existing policies", async () => {
    const response = await request(
        "GET",
        "/approval-policy-management"
    );

    expectStatus(response, 200);
});

test("Approval policy draft can be created", async () => {
    const { db } = await startIntegrationEnvironment();

    const response = await request(
        "POST",
        "/approval-policy-management/drafts",
        {
            body: {
                name: unique("Policy"),
                description: "Integration test policy",
                owner: "Operations"
            },
            headers: {
                "X-Actor-Id": "TEST-ADMIN"
            }
        }
    );

    expectStatus(response, 201);

    assert.equal(response.data.status, "Draft");
    assert.ok(response.data.policyId);

    const stored = await db
        .collection("approval_policies")
        .findOne({
            policyId: response.data.policyId
        });

    assert.ok(stored);
    assert.equal(stored.version, 1);
});

test("Approval policy draft creates audit event", async () => {
    const { db } = await startIntegrationEnvironment();

    const created = await request(
        "POST",
        "/approval-policy-management/drafts",
        {
            body: {
                name: unique("Audited policy"),
                description: "Audited test policy",
                owner: "Operations"
            },
            headers: {
                "X-Actor-Id": "AUDIT-TEST"
            }
        }
    );

    expectStatus(created, 201);

    const event = await db
        .collection("approval_policy_management_events")
        .findOne({
            policyId: created.data.policyId
        });

    assert.ok(event);
    assert.equal(event.action, "Draft Created");
    assert.equal(event.actorId, "AUDIT-TEST");
});

test("Approval policy draft rejects empty name", async () => {
    const response = await request(
        "POST",
        "/approval-policy-management/drafts",
        {
            body: {
                name: "",
                description: "Invalid policy",
                owner: "Operations"
            }
        }
    );

    expectStatus(response, 400);
});

test("Approval policy draft rejects oversized name", async () => {
    const response = await request(
        "POST",
        "/approval-policy-management/drafts",
        {
            body: {
                name: "A".repeat(151),
                description: "Invalid policy",
                owner: "Operations"
            }
        }
    );

    expectStatus(response, 400);
});

test("Approval policy filters reject invalid statuses", async () => {
    const response = await request(
        "GET",
        "/approval-policy-management?status=INVALID"
    );

    expectStatus(response, 400);
});

test("Approval workflow definition can be created", async () => {
    const { db } = await startIntegrationEnvironment();

    const workflow = await createWorkflow();

    assert.ok(workflow.definitionId);
    assert.equal(workflow.status, "Inactive");

    const stored = await db
        .collection("approval_workflow_definitions")
        .findOne({
            definitionId: workflow.definitionId
        });

    assert.ok(stored);
});

test("Approval workflow can be retrieved", async () => {
    const workflow = await createWorkflow();

    const response = await request(
        "GET",
        `/approval-workflow-definitions/${workflow.definitionId}`
    );

    expectStatus(response, 200);

    assert.equal(
        response.data.definitionId,
        workflow.definitionId
    );
});

test("Inactive custom workflow can be edited", async () => {
    const workflow = await createWorkflow();

    const response = await request(
        "PUT",
        `/approval-workflow-definitions/${workflow.definitionId}`,
        {
            body: workflowPayload({
                name: "Edited approval workflow",
                slaHours: 48
            })
        }
    );

    expectStatus(response, 200);

    assert.equal(
        response.data.name,
        "Edited approval workflow"
    );

    assert.equal(response.data.slaHours, 48);
});

test("Workflow can be duplicated", async () => {
    const original = await createWorkflow();

    const response = await request(
        "POST",
        `/approval-workflow-definitions/${original.definitionId}/duplicate`
    );

    expectStatus(response, 201);

    assert.notEqual(
        response.data.definitionId,
        original.definitionId
    );

    assert.deepEqual(
        response.data.stages,
        original.stages
    );
});

test("Workflow can be activated", async () => {
    const workflow = await createWorkflow();

    const response = await request(
        "POST",
        `/approval-workflow-definitions/${workflow.definitionId}/status`,
        {
            body: {
                status: "Active"
            }
        }
    );

    expectStatus(response, 200);
    assert.equal(response.data.status, "Active");
});

test("Active workflow cannot be edited", async () => {
    const workflow = await createWorkflow();

    const activated = await request(
        "POST",
        `/approval-workflow-definitions/${workflow.definitionId}/status`,
        {
            body: {
                status: "Active"
            }
        }
    );

    expectStatus(activated, 200);

    const edited = await request(
        "PUT",
        `/approval-workflow-definitions/${workflow.definitionId}`,
        {
            body: workflowPayload()
        }
    );

    expectStatus(edited, 409);
});

test("Active workflow cannot be deleted", async () => {
    const workflow = await createWorkflow();

    const activated = await request(
        "POST",
        `/approval-workflow-definitions/${workflow.definitionId}/status`,
        {
            body: {
                status: "Active"
            }
        }
    );

    expectStatus(activated, 200);

    const deleted = await request(
        "DELETE",
        `/approval-workflow-definitions/${workflow.definitionId}`
    );

    expectStatus(deleted, 409);
});

test("Inactive custom workflow can be deleted", async () => {
    const workflow = await createWorkflow();

    const response = await request(
        "DELETE",
        `/approval-workflow-definitions/${workflow.definitionId}`
    );

    assert.ok([200, 204].includes(response.status));
});

test("Workflow requires a valid risk level", async () => {
    const response = await request(
        "POST",
        "/approval-workflow-definitions",
        {
            body: workflowPayload({
                riskLevels: ["Invalid"]
            })
        }
    );

    expectStatus(response, 400);
});

test("Workflow requires valid reviewer stages", async () => {
    const response = await request(
        "POST",
        "/approval-workflow-definitions",
        {
            body: workflowPayload({
                stages: ["InvalidReviewer"]
            })
        }
    );

    expectStatus(response, 400);
});

test("Workflow SLA cannot exceed maximum", async () => {
    const response = await request(
        "POST",
        "/approval-workflow-definitions",
        {
            body: workflowPayload({
                slaHours: 721
            })
        }
    );

    expectStatus(response, 400);
});

test("Workflow audit events are persisted", async () => {
    const { db } = await startIntegrationEnvironment();

    const workflow = await createWorkflow();

    const updated = await request(
        "PUT",
        `/approval-workflow-definitions/${workflow.definitionId}`,
        {
            body: workflowPayload()
        }
    );

    expectStatus(updated, 200);

    const events = await db
        .collection("approval_workflow_definition_events")
        .find({
            definitionId: workflow.definitionId
        })
        .toArray();

    assert.ok(
        events.some(event => event.action === "Created")
    );

    assert.ok(
        events.some(event => event.action === "Updated")
    );
});

test("Workflow builder rejects incomplete definitions", async () => {
    const response = await request(
        "POST",
        "/approval-workflow-builders",
        {
            body: {
                name: "Incomplete workflow",
                workflowCode: "TEST-WORKFLOW",
                description: "No risk levels or stages",
                riskLevels: [],
                stageDefinitions: []
            }
        }
    );

    expectStatus(response, 400);
});

test("Unknown workflow definition returns 404", async () => {
    const response = await request(
        "GET",
        "/approval-workflow-definitions/AWD-UNKNOWN"
    );

    expectStatus(response, 404);
});
