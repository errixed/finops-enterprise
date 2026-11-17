
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
let actorId;

before(async () => {
    const environment = await startIntegrationEnvironment();
    db = environment.db;
    actorId = `ACTOR-${randomUUID()}`;

    await db.collection("workflow_actors").insertOne({
        actorId,
        name: "Integration Policy Administrator",
        role: "PolicyAdministrator",
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
    });
});

after(stopIntegrationEnvironment);
function newPolicyId() {
    return `RISK-POLICY-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}
function payload(policyId, overrides = {}) {
    return {
        policyId,
        currency: "CAD",
        policyName: "Integration Risk Policy",
        description: "Risk policy lifecycle test",
        plannedEffectiveFrom: "2027-01-01",
        ...overrides
    };
}

function adminRequest(method, path, body) {
    return request(method, path, {
        body,
        headers: {
            "X-Actor-Id": actorId
        }
    });
}

test("Unauthenticated policy creation is rejected", async () => {
    const response = await request(
        "POST",
        "/risk-policies",
        {
            body: payload(newPolicyId())
        }
    );

    assert.ok([400, 403].includes(response.status));
});

test("Invalid policy identifier is rejected", async () => {
    const response = await adminRequest(
        "POST",
        "/risk-policies",
        payload("invalid")
    );

    expectStatus(response, 400);
});

test("New risk policy is created as a draft", async () => {
    const policyId = newPolicyId();

    const response = await adminRequest(
        "POST",
        "/risk-policies",
        payload(policyId)
    );

    expectStatus(response, 201);
    assert.equal(response.data.status, "Draft");
    assert.equal(response.data.version, 1);

    const stored = await db.collection("risk_policies").findOne({
        _id: response.data._id
    });

    assert.ok(stored);
    assert.equal(stored.policyId, policyId);
});

test("Draft policy can update its thresholds", async () => {
    const policyId = newPolicyId();

    const created = await adminRequest(
        "POST",
        "/risk-policies",
        payload(policyId)
    );

    expectStatus(created, 201);

    const response = await adminRequest(
        "PUT",
        `/risk-policies/${created.data._id}`,
        {
            thresholds: created.data.thresholds
        }
    );

    expectStatus(response, 200);
    assert.equal(response.data.status, "Draft");
});

test("Locked seeded risk rules cannot be changed", async () => {
    const created = await adminRequest(
        "POST",
        "/risk-policies",
        payload(newPolicyId())
    );

    expectStatus(created, 201);

    const rules = structuredClone(created.data.rules);
    rules[0].points += 1;

    const response = await adminRequest(
        "PUT",
        `/risk-policies/${created.data._id}`,
        { rules }
    );

    expectStatus(response, 400);
});

test("Risk policy can be activated", async () => {
    const created = await adminRequest(
        "POST",
        "/risk-policies",
        payload(newPolicyId())
    );

    expectStatus(created, 201);

    const activated = await adminRequest(
        "POST",
        `/risk-policies/${created.data._id}/activate`
    );

    expectStatus(activated, 200);
    assert.equal(activated.data.status, "Active");
});

test("Active risk policy cannot be edited", async () => {
    const created = await adminRequest(
        "POST",
        "/risk-policies",
        payload(newPolicyId())
    );

    expectStatus(created, 201);

    const activated = await adminRequest(
        "POST",
        `/risk-policies/${created.data._id}/activate`
    );

    expectStatus(activated, 200);

    const edited = await adminRequest(
        "PUT",
        `/risk-policies/${created.data._id}`,
        {
            thresholds: created.data.thresholds
        }
    );

    expectStatus(edited, 409);
});

test("New version preserves historical policy", async () => {
    const policyId = newPolicyId();

    const versionOne = await adminRequest(
        "POST",
        "/risk-policies",
        payload(policyId)
    );

    expectStatus(versionOne, 201);

    const activated = await adminRequest(
        "POST",
        `/risk-policies/${versionOne.data._id}/activate`
    );

    expectStatus(activated, 200);

    const versionTwo = await adminRequest(
        "POST",
        "/risk-policies",
        payload(policyId, {
            policyName: "Second Version"
        })
    );

    expectStatus(versionTwo, 201);
    assert.equal(versionTwo.data.version, 2);
    assert.equal(versionTwo.data.status, "Draft");

    const history = await db.collection("risk_policies")
        .find({ policyId, currency: "CAD" })
        .sort({ version: 1 })
        .toArray();

    assert.equal(history.length, 2);
    assert.equal(history[0].version, 1);
    assert.equal(history[1].version, 2);
    assert.equal(history[0].status, "Active");
});

test("Older draft version cannot be activated", async () => {
    const policyId = newPolicyId();

    const first = await adminRequest(
        "POST",
        "/risk-policies",
        payload(policyId)
    );

    expectStatus(first, 201);

    const second = await adminRequest(
        "POST",
        "/risk-policies",
        payload(policyId)
    );

    expectStatus(second, 201);

    const response = await adminRequest(
        "POST",
        `/risk-policies/${first.data._id}/activate`
    );

    expectStatus(response, 409);
});

test("Unknown risk policy returns 404", async () => {
    const response = await request(
        "GET",
        `/risk-policies/${randomUUID()}`
    );

    expectStatus(response, 404);
});
