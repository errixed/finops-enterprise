
import test, { before, after } from "node:test";
import assert from "node:assert/strict";

import {
    startIntegrationEnvironment,
    stopIntegrationEnvironment,
    request,
    expectStatus
} from "./helpers/integration.js";

let db;

before(async () => {
    ({ db } = await startIntegrationEnvironment());
});

after(stopIntegrationEnvironment);

function config(overrides = {}) {
    return {
        details: {
            name: "Integration Wizard Policy",
            version: "v1.0",
            description: "Policy wizard test",
            policyType: "TransactionApproval",
            owner: "Operations"
        },
        riskRanges: [],
        rules: [],
        mappings: [],
        segregationOfDuties: true,
        stageSlas: [],
        escalation: {},
        monitoring: {},
        notifications: [],
        review: {},
        ...overrides
    };
}

async function createDraft(configuration = config()) {
    const response = await request(
        "POST",
        "/approval-policy-wizard",
        {
            body: {
                config: configuration,
                complete: false
            }
        }
    );

    expectStatus(response, 201);
    return response.data;
}

test("Wizard draft can be saved", async () => {
    const created = await createDraft();

    assert.ok(created.policyId);
    assert.equal(created.wizardCompleted, false);
});

test("Wizard draft can be retrieved", async () => {
    const created = await createDraft();

    const response = await request(
        "GET",
        `/approval-policy-wizard/${created.policyId}`
    );

    expectStatus(response, 200);
    assert.equal(response.data.policyId, created.policyId);
    assert.equal(response.data.status, "Draft");
});

test("Wizard draft configuration can be updated", async () => {
    const created = await createDraft();

    const response = await request(
        "PUT",
        `/approval-policy-wizard/${created.policyId}`,
        {
            body: {
                complete: false,
                config: config({
                    details: {
                        ...config().details,
                        name: "Updated Wizard Policy"
                    }
                })
            }
        }
    );

    expectStatus(response, 200);

    assert.equal(
        response.data.wizardConfig.details.name,
        "Updated Wizard Policy"
    );
});

test("Wizard rejects unsupported policy type", async () => {
    const response = await request(
        "POST",
        "/approval-policy-wizard",
        {
            body: {
                complete: false,
                config: config({
                    details: {
                        ...config().details,
                        policyType: "InvalidType"
                    }
                })
            }
        }
    );

    expectStatus(response, 400);
});

test("Wizard rejects overlapping risk ranges", async () => {
    const response = await request(
        "POST",
        "/approval-policy-wizard",
        {
            body: {
                complete: false,
                config: config({
                    riskRanges: [
                        { level: "Low", min: 0, max: 40 },
                        { level: "Medium", min: 30, max: 60 }
                    ]
                })
            }
        }
    );

    expectStatus(response, 400);
});

test("Wizard rejects duplicate risk levels", async () => {
    const response = await request(
        "POST",
        "/approval-policy-wizard",
        {
            body: {
                complete: false,
                config: config({
                    riskRanges: [
                        { level: "Low", min: 0, max: 20 },
                        { level: "Low", min: 21, max: 40 }
                    ]
                })
            }
        }
    );

    expectStatus(response, 400);
});

test("Wizard rejects invalid approval rule operator", async () => {
    const response = await request(
        "POST",
        "/approval-policy-wizard",
        {
            body: {
                complete: false,
                config: config({
                    rules: [
                        {
                            field: "transactionAmount",
                            operator: "invalid",
                            value: 1000
                        }
                    ]
                })
            }
        }
    );

    expectStatus(response, 400);
});

test("Wizard draft can be deleted", async () => {
    const created = await createDraft();

    const response = await request(
        "DELETE",
        `/approval-policy-wizard/${created.policyId}`
    );

    expectStatus(response, 204);

    const stored = await db.collection("approval_policies")
        .findOne({ policyId: created.policyId });

    assert.equal(stored, null);
});

test("Deleted wizard draft cannot be updated", async () => {
    const created = await createDraft();

    const deleted = await request(
        "DELETE",
        `/approval-policy-wizard/${created.policyId}`
    );

    expectStatus(deleted, 204);

    const response = await request(
        "PUT",
        `/approval-policy-wizard/${created.policyId}`,
        {
            body: {
                config: config(),
                complete: false
            }
        }
    );

    expectStatus(response, 404);
});

test("Wizard operations preserve audit history", async () => {
    const created = await createDraft();

    const updated = await request(
        "PUT",
        `/approval-policy-wizard/${created.policyId}`,
        {
            body: {
                config: config(),
                complete: false
            }
        }
    );

    expectStatus(updated, 200);

    const events = await db
        .collection("approval_policy_management_events")
        .find({ policyId: created.policyId })
        .toArray();

    assert.ok(
        events.some(event => event.action === "Draft Created")
    );

    assert.ok(
        events.some(event => event.action === "Draft Updated")
    );
});

test("Wizard lists available completed workflows", async () => {
    const response = await request(
        "GET",
        "/approval-policy-wizard/workflows"
    );

    expectStatus(response, 200);
    assert.ok(Array.isArray(response.data));
});
