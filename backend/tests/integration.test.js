import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

if (process.env.MONGODB_DATABASE !== "finops_enterprise_test") {
    throw new Error("An isolated MongoDB test database is required");
}

const {
    connectMongoDB,
    getDatabase,
    initializeCollections,
    closeMongoDB
} = await import("../src/config/mongodb.js");

const { initializeIndexes } = await import(
    "../scripts/initialize-indexes.js"
);

const { initializeValidators } = await import(
    "../scripts/initialize-validators.js"
);

const { default: app } = await import("../src/app.js");

let db;
let server;
let baseUrl;
let clientId;
let accountId;
let transactionId;

async function request(path, method = "GET", body, key) {
    const headers = {};

    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    if (key) {
        headers["Idempotency-Key"] = key;
    }

    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined
            ? undefined
            : JSON.stringify(body)
    });

    return {
        status: response.status,
        body: await response.json()
    };
}

before(async () => {
    await connectMongoDB();
    db = getDatabase();

    await db.dropDatabase();
    await initializeCollections();
    await initializeValidators();
    await initializeIndexes();

    server = app.listen(0);

    await new Promise(resolve =>
        server.once("listening", resolve)
    );

    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
});

after(async () => {
    if (server) {
        await new Promise((resolve, reject) =>
            server.close(error => error ? reject(error) : resolve())
        );
    }

    if (db) {
        await db.dropDatabase();
    }

    await closeMongoDB();
});

test("Regression: health endpoint is available", async () => {
    const response = await request("/health");

    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ok");
});

test("Regression: client registration works", async () => {
    const response = await request(
        "/clients",
        "POST",
        {
            companyName: "Integration Test Corporation",
            registrationNumber: `TEST-${randomUUID().slice(0, 12)}`,
            industry: "Technology",
            country: "Canada",
            contactEmail: "integration@example.com",
            contactPhone: ""
        }
    );

    assert.equal(response.status, 201);
    assert.ok(response.body.clientId);

    clientId = response.body.clientId;
});

test("Regression: client directory supports pagination", async () => {
    const response = await request(
        "/clients?page=1&pageSize=10"
    );

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.data));
    assert.ok(response.body.pagination);
    assert.ok(
        response.body.data.some(client =>
            client.clientId === clientId
        )
    );
});

test("Regression: client details work", async () => {
    const response = await request(`/clients/${clientId}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.clientId, clientId);
});

test("Regression: client editing works", async () => {
    const response = await request(
        `/clients/${clientId}`,
        "PUT",
        {
            companyName: "Updated Integration Corporation"
        }
    );

    assert.equal(response.status, 200);
    assert.equal(
        response.body.companyName,
        "Updated Integration Corporation"
    );
});

test("Regression: account registration works", async () => {
    const response = await request(
        "/accounts",
        "POST",
        {
            clientId,
            accountType: "Operating",
            currency: "CAD",
            balanceMinor: 100000
        }
    );

    assert.equal(response.status, 201);
    assert.ok(response.body.accountId);

    accountId = response.body.accountId;
});

test("Regression: account directory works", async () => {
    const response = await request("/accounts");

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body));
    assert.ok(
        response.body.some(account =>
            account.accountId === accountId
        )
    );
});

test("Regression: account details work", async () => {
    const response = await request(`/accounts/${accountId}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.accountId, accountId);
    assert.equal(response.body.balanceMinor, 100000);
});

test("Regression: client accounts endpoint works", async () => {
    const response = await request(
        `/clients/${clientId}/accounts`
    );

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body));
    assert.ok(
        response.body.some(account =>
            account.accountId === accountId
        )
    );
});

test("Regression: transaction initiation and listing work", async () => {
    const secondAccount = await request(
        "/accounts",
        "POST",
        {
            clientId,
            accountType: "Savings",
            currency: "CAD",
            balanceMinor: 50000
        }
    );

    assert.equal(secondAccount.status, 201);

    const created = await request(
        "/transactions",
        "POST",
        {
            sourceAccountId: accountId,
            destinationAccountId: secondAccount.body.accountId,
            amountMinor: 1000,
            currency: "CAD",
            description: "Integration test"
        },
        randomUUID()
    );

    assert.equal(created.status, 201);

    transactionId = created.body.data.transactionId;

    const directory = await request(
        "/transactions?page=1&pageSize=10"
    );

    assert.equal(directory.status, 200);
    assert.ok(Array.isArray(directory.body.data));
    assert.ok(directory.body.pagination);
});

test("Regression: transaction details work", async () => {
    const response = await request(
        `/transactions/${transactionId}`
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.transactionId, transactionId);
    assert.equal(response.body.status, "Pending");
});

test("TX-16: dashboard counts and volumes are accurate", async () => {
    const response = await request("/dashboard/summary");

    assert.equal(response.status, 200);

    const summary = response.body;

    assert.equal(
        summary.totalClients,
        await db.collection("clients").countDocuments()
    );

    assert.equal(
        summary.totalTransactions,
        await db.collection("transactions").countDocuments()
    );

    assert.equal(
        summary.transactionStatuses.Pending,
        await db.collection("transactions").countDocuments({
            status: "Pending"
        })
    );

    assert.ok(summary.completedVolumes);
    assert.equal(summary.completedVolumes.CAD, 0);
    assert.equal(summary.completedVolumes.USD, 0);
    assert.ok(Array.isArray(summary.recentProcessingActivity));
});

test("Regression: missing entity returns HTTP 404", async () => {
    const response = await request(
        `/clients/${randomUUID()}`
    );

    assert.equal(response.status, 404);
    assert.equal(typeof response.body.error.code, "string");
    assert.equal(typeof response.body.error.message, "string");
    assert.ok(Array.isArray(response.body.error.details));
});

test("Regression: invalid account data returns HTTP 400", async () => {
    const response = await request(
        "/accounts",
        "POST",
        {
            clientId,
            accountType: "Unsupported",
            currency: "CAD",
            balanceMinor: 1000
        }
    );

    assert.equal(response.status, 400);
    assert.ok(response.body.error);
});