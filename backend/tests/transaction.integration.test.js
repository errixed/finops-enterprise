
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
    startIntegrationEnvironment,
    stopIntegrationEnvironment,
    request,
    expectStatus,
    createTestClient,
    createTestAccount
} from "./helpers/integration.js";

before(startIntegrationEnvironment);
after(stopIntegrationEnvironment);

async function accounts() {
    const client = await createTestClient();

    const source = await createTestAccount(
        client.clientId,
        { balanceMinor: 10000000 }
    );

    const destination = await createTestAccount(
        client.clientId,
        { balanceMinor: 10000000 }
    );

    return { source, destination };
}

function transfer(source, destination, amountMinor = 10000) {
    return {
        sourceAccountId: source.accountId,
        destinationAccountId: destination.accountId,
        amountMinor,
        currency: "CAD",
        description: "Automated integration test"
    };
}

async function initiate(body, key = randomUUID()) {
    return request("POST", "/transactions", {
        body,
        headers: {
            "Idempotency-Key": key
        }
    });
}

test("Transaction initiation returns 201", async () => {
    const { source, destination } = await accounts();

    const response = await initiate(
        transfer(source, destination)
    );

    expectStatus(response, 201);

    assert.ok(response.data.data.transactionId);
    assert.equal(response.data.data.status, "Pending");
});

test("Transaction is persisted in MongoDB", async () => {
    const { db } = await startIntegrationEnvironment();

    const { source, destination } = await accounts();

    const response = await initiate(
        transfer(source, destination)
    );

    expectStatus(response, 201);

    const transactionId = response.data.data.transactionId;

    const stored = await db.collection("transactions").findOne({
        transactionId
    });

    assert.ok(stored);
    assert.equal(BigInt(stored.amountMinor), 10000n);
});

test("Risk assessment is created with transaction", async () => {
    const { db } = await startIntegrationEnvironment();

    const { source, destination } = await accounts();

    const response = await initiate(
        transfer(source, destination)
    );

    expectStatus(response, 201);

    const transactionId = response.data.data.transactionId;

    const assessment = await db
        .collection("risk_assessments")
        .findOne({ transactionId });

    assert.ok(assessment);
    assert.equal(assessment.transactionId, transactionId);
    assert.ok(assessment.policyId);
    assert.ok(assessment.policyVersion);
});

test("Low-risk transaction requires no approval", async () => {
    const { db } = await startIntegrationEnvironment();

    const { source, destination } = await accounts();

    const response = await initiate(
        transfer(source, destination, 10000)
    );

    expectStatus(response, 201);

    const transactionId = response.data.data.transactionId;

    const assessment = await db
        .collection("risk_assessments")
        .findOne({ transactionId });

    assert.equal(assessment.riskLevel, "Low");
    assert.equal(assessment.approvalRequired, false);
});

test("High-risk transaction creates approval workflow", async () => {
    const { db } = await startIntegrationEnvironment();

    const { source, destination } = await accounts();

    const response = await initiate(
        transfer(source, destination, 5000000)
    );

    expectStatus(response, 201);

    const transactionId = response.data.data.transactionId;

    const assessment = await db
        .collection("risk_assessments")
        .findOne({ transactionId });

    assert.ok(assessment);
    assert.equal(assessment.approvalRequired, true);

    const workflow = await db
        .collection("approval_workflows")
        .findOne({ transactionId });

    assert.ok(workflow);
    assert.equal(workflow.transactionId, transactionId);
    assert.equal(workflow.status, "Pending");
});

test("Same idempotency key returns original transaction", async () => {
    const { db } = await startIntegrationEnvironment();

    const { source, destination } = await accounts();

    const payload = transfer(source, destination);
    const key = randomUUID();

    const first = await initiate(payload, key);
    const second = await initiate(payload, key);

    expectStatus(first, 201);
    expectStatus(second, 200);

    assert.equal(
        first.data.data.transactionId,
        second.data.data.transactionId
    );

    const count = await db
        .collection("transactions")
        .countDocuments({ idempotencyKey: key });

    assert.equal(count, 1);
});

test("Reusing idempotency key with different data fails", async () => {
    const { source, destination } = await accounts();

    const key = randomUUID();

    const first = await initiate(
        transfer(source, destination, 10000),
        key
    );

    expectStatus(first, 201);

    const second = await initiate(
        transfer(source, destination, 20000),
        key
    );

    expectStatus(second, 409);
});

test("Concurrent identical initiation cannot create duplicate transaction", async () => {
    const { db } = await startIntegrationEnvironment();

    const { source, destination } = await accounts();

    const key = randomUUID();
    const payload = transfer(source, destination);

    const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
            initiate(payload, key)
        )
    );

    const successful = responses.filter(
        response => [200, 201].includes(response.status)
    );

    const ids = new Set(
        successful.map(response =>
            response.data.data.transactionId
        )
    );

    assert.ok(successful.length >= 1);
    assert.equal(ids.size, 1);

    const count = await db
        .collection("transactions")
        .countDocuments({ idempotencyKey: key });

    assert.equal(count, 1);
});

test("Missing idempotency key is rejected", async () => {
    const { source, destination } = await accounts();

    const response = await request(
        "POST",
        "/transactions",
        {
            body: transfer(source, destination)
        }
    );

    expectStatus(response, 400);
});

test("Zero transfer amount is rejected", async () => {
    const { source, destination } = await accounts();

    const response = await initiate(
        transfer(source, destination, 0)
    );

    expectStatus(response, 400);
});

test("Negative transfer amount is rejected", async () => {
    const { source, destination } = await accounts();

    const response = await initiate(
        transfer(source, destination, -100)
    );

    expectStatus(response, 400);
});

test("Unsafe transfer amount is rejected", async () => {
    const { source, destination } = await accounts();

    const response = await initiate(
        transfer(
            source,
            destination,
            Number.MAX_SAFE_INTEGER + 1
        )
    );

    expectStatus(response, 400);
});

test("Source and destination must differ", async () => {
    const { source } = await accounts();

    const response = await initiate(
        transfer(source, source)
    );

    expectStatus(response, 400);
});

test("Unknown source account is rejected", async () => {
    const { destination } = await accounts();

    const response = await initiate({
        sourceAccountId: randomUUID(),
        destinationAccountId: destination.accountId,
        amountMinor: 10000,
        currency: "CAD"
    });

    expectStatus(response, 404);
});

test("Transaction with unsupported currency is rejected", async () => {
    const { source, destination } = await accounts();

    const response = await initiate({
        ...transfer(source, destination),
        currency: "EUR"
    });

    expectStatus(response, 400);
});

test("Transaction with unknown fields is rejected", async () => {
    const { source, destination } = await accounts();

    const response = await initiate({
        ...transfer(source, destination),
        unauthorizedField: true
    });

    expectStatus(response, 400);
});

test("Transaction with invalid description is rejected", async () => {
    const { source, destination } = await accounts();

    const response = await initiate({
        ...transfer(source, destination),
        description: "X".repeat(251)
    });

    expectStatus(response, 400);
});

test("High-risk transaction cannot process before approval", async () => {
    const { source, destination } = await accounts();

    const created = await initiate(
        transfer(source, destination, 5000000)
    );

    expectStatus(created, 201);

    const transactionId = created.data.data.transactionId;

    const response = await request(
        "POST",
        `/transactions/${transactionId}/process`
    );

    assert.ok([400, 409].includes(response.status));
});

test("Processing endpoint rejects non-empty body", async () => {
    const { source, destination } = await accounts();

    const created = await initiate(
        transfer(source, destination)
    );

    expectStatus(created, 201);

    const response = await request(
        "POST",
        `/transactions/${created.data.data.transactionId}/process`,
        {
            body: { force: true }
        }
    );

    expectStatus(response, 400);

    assert.equal(
        response.data.error.code,
        "INVALID_REQUEST_BODY"
    );
});

test("Unknown transaction cannot be processed", async () => {
    const response = await request(
        "POST",
        `/transactions/${randomUUID()}/process`
    );

    expectStatus(response, 404);
});

test("Transactions can be filtered by status", async () => {
    const response = await request(
        "GET",
        "/transactions?status=Pending&page=1&pageSize=10"
    );

    expectStatus(response, 200);
    assert.ok(Array.isArray(response.data.data));
});

test("Transaction listing rejects invalid pagination", async () => {
    const response = await request(
        "GET",
        "/transactions?page=0&pageSize=200"
    );

    expectStatus(response, 400);
});

test("Risk assessment listing responds successfully", async () => {
    const response = await request(
        "GET",
        "/risk-assessments"
    );

    expectStatus(response, 200);
});

test("Risk assessment dashboard responds successfully", async () => {
    const response = await request(
        "GET",
        "/risk-assessments/dashboard"
    );

    expectStatus(response, 200);
});
