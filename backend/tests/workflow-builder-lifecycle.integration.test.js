
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
    startIntegrationEnvironment,
    stopIntegrationEnvironment,
    request,
    expectStatus
} from "./helpers/integration.js";

let db;

before(async () => {
    const environment = await startIntegrationEnvironment();
    db = environment.db;
});

after(stopIntegrationEnvironment);

function completePayload(overrides = {}) {
    return {
        name: "Integration Approval Workflow",
        workflowCode:
            `TST-${randomUUID().replaceAll("-", "").slice(0, 12)}`,
        description: "Workflow builder integration test",
        riskLevels: ["High"],
        transactionType: "InternalTransfer",
        stageDefinitions: [
            {
                name: "Operations Review",
                reviewerRole: "OperationsReviewer",
                decisionType: "ApproveReject",
                slaBusinessDays: 2
            },
            {
                name: "Senior Review",
                reviewerRole: "SeniorReviewer",
                decisionType: "ApproveReject",
                slaBusinessDays: 3
            }
        ],
        slaCalculation: "PerStage",
        autoEscalate: false,
        allowParallel: false,
        requireReapproval: false,
        active: false,
        ...overrides
    };
}

async function draft(body = {}) {
    const response = await request(
        "POST",
        "/approval-workflow-builders/drafts",
        { body }
    );

    expectStatus(response, 201);
    return response.data;
}

test("Incomplete workflow draft can be created", async () => {
    const created = await draft();

    assert.ok(created.definitionId);
    assert.equal(created.status, "Draft");
    assert.equal(created.isDraft, true);
});

test("Workflow draft is persisted in MongoDB", async () => {
    const created = await draft({
        name: "Stored Workflow Draft"
    });

    const stored = await db
        .collection("approval_workflow_definitions")
        .findOne({
            definitionId: created.definitionId
        });

    assert.ok(stored);
    assert.equal(stored.status, "Draft");
});

test("Draft can be retrieved", async () => {
    const created = await draft();

    const response = await request(
        "GET",
        `/approval-workflow-builders/drafts/${created.definitionId}`
    );

    expectStatus(response, 200);
    assert.equal(response.data.definitionId, created.definitionId);
});

test("Draft can be edited with reviewer stages", async () => {
    const created = await draft();

    const response = await request(
        "PUT",
        `/approval-workflow-builders/drafts/${created.definitionId}`,
        {
            body: completePayload()
        }
    );

    expectStatus(response, 200);

    assert.equal(response.data.stageDefinitions.length, 2);
    assert.deepEqual(
        response.data.stages,
        ["OperationsReviewer", "SeniorReviewer"]
    );
});

test("Workflow SLA is calculated from stage days", async () => {
    const created = await draft();

    const response = await request(
        "PUT",
        `/approval-workflow-builders/drafts/${created.definitionId}`,
        {
            body: completePayload()
        }
    );

    expectStatus(response, 200);
    assert.equal(response.data.slaHours, 120);
});

test("Draft cannot contain invalid reviewer roles", async () => {
    const created = await draft();

    const response = await request(
        "PUT",
        `/approval-workflow-builders/drafts/${created.definitionId}`,
        {
            body: completePayload({
                stageDefinitions: [
                    {
                        name: "Invalid Stage",
                        reviewerRole: "UnauthorizedRole",
                        decisionType: "ApproveReject",
                        slaBusinessDays: 1
                    }
                ]
            })
        }
    );

    expectStatus(response, 400);
});

test("Stage SLA cannot exceed 30 business days", async () => {
    const created = await draft();

    const response = await request(
        "PUT",
        `/approval-workflow-builders/drafts/${created.definitionId}`,
        {
            body: completePayload({
                stageDefinitions: [
                    {
                        name: "Slow Review",
                        reviewerRole: "OperationsReviewer",
                        decisionType: "ApproveReject",
                        slaBusinessDays: 31
                    }
                ]
            })
        }
    );

    expectStatus(response, 400);
});

test("Workflow cannot have more than five stages", async () => {
    const created = await draft();

    const stages = Array.from({ length: 6 }, (_, index) => ({
        name: `Review ${index + 1}`,
        reviewerRole: "OperationsReviewer",
        decisionType: "ApproveReject",
        slaBusinessDays: 1
    }));

    const response = await request(
        "PUT",
        `/approval-workflow-builders/drafts/${created.definitionId}`,
        {
            body: completePayload({
                stageDefinitions: stages
            })
        }
    );

    expectStatus(response, 400);
});

test("Workflow rejects duplicate risk levels", async () => {
    const created = await draft();

    const response = await request(
        "PUT",
        `/approval-workflow-builders/drafts/${created.definitionId}`,
        {
            body: completePayload({
                riskLevels: ["High", "High"]
            })
        }
    );

    expectStatus(response, 400);
});

test("Incomplete workflow cannot be completed", async () => {
    const created = await draft();

    const response = await request(
        "POST",
        `/approval-workflow-builders/drafts/${created.definitionId}/complete`,
        {
            body: {}
        }
    );

    expectStatus(response, 400);
});

test("Draft can be completed as inactive", async () => {
    const created = await draft();

    const response = await request(
        "POST",
        `/approval-workflow-builders/drafts/${created.definitionId}/complete`,
        {
            body: completePayload()
        }
    );

    expectStatus(response, 200);
    assert.equal(response.data.status, "Inactive");
    assert.equal(response.data.isDraft, false);
});

test("Draft can be completed as active", async () => {
    const created = await draft();

    const response = await request(
        "POST",
        `/approval-workflow-builders/drafts/${created.definitionId}/complete`,
        {
            body: completePayload({ active: true })
        }
    );

    expectStatus(response, 200);
    assert.equal(response.data.status, "Active");
    assert.equal(response.data.isDraft, false);
});

test("Completed workflow cannot be edited as draft", async () => {
    const created = await draft();

    const completed = await request(
        "POST",
        `/approval-workflow-builders/drafts/${created.definitionId}/complete`,
        {
            body: completePayload()
        }
    );

    expectStatus(completed, 200);

    const response = await request(
        "PUT",
        `/approval-workflow-builders/drafts/${created.definitionId}`,
        {
            body: completePayload()
        }
    );

    expectStatus(response, 404);
});

test("Duplicate workflow code is rejected", async () => {
    const payload = completePayload();

    const first = await request(
        "POST",
        "/approval-workflow-builders",
        { body: payload }
    );

    expectStatus(first, 201);

    const second = await request(
        "POST",
        "/approval-workflow-builders",
        { body: payload }
    );

    expectStatus(second, 409);
});

test("Incomplete draft can be deleted", async () => {
    const created = await draft();

    const response = await request(
        "DELETE",
        `/approval-workflow-builders/drafts/${created.definitionId}`
    );

    expectStatus(response, 204);

    const stored = await db
        .collection("approval_workflow_definitions")
        .findOne({
            definitionId: created.definitionId
        });

    assert.equal(stored, null);
});

test("Workflow draft operations produce audit events", async () => {
    const created = await draft();

    const updated = await request(
        "PUT",
        `/approval-workflow-builders/drafts/${created.definitionId}`,
        {
            body: completePayload()
        }
    );

    expectStatus(updated, 200);

    const events = await db
        .collection("approval_workflow_definition_events")
        .find({
            definitionId: created.definitionId
        })
        .toArray();

    assert.ok(
        events.some(event => event.action === "Draft Created")
    );

    assert.ok(
        events.some(event => event.action === "Draft Updated")
    );
});
