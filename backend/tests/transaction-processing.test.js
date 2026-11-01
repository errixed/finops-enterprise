import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Long } from "mongodb";
import {
    processTransaction
} from "../src/services/transaction-processing.service.js";

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
let sourceId;
let destinationId;
let usdId;

function accountDocument(currency, balanceMinor, status = "Active") {
    return {
        accountId: randomUUID(),
        clientId,
        accountNumber: `TEST-${randomUUID()}`,
        accountType: "Operating",
        currency,
        balanceMinor: Long.fromNumber(balanceMinor),
        status,
        createdAt: new Date()
    };
}

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
        headers: response.headers,
        body: await response.json()
    };
}

async function initiate(
    amountMinor = 1000,
    sourceAccountId = sourceId,
    destinationAccountId = destinationId,
    currency = "CAD",
    key = randomUUID()
) {
    return request(
        "/transactions",
        "POST",
        {
            sourceAccountId,
            destinationAccountId,
            amountMinor,
            currency,
            description: "Automated transfer test"
        },
        key
    );
}

async function balance(accountId) {
    const account = await db.collection("accounts").findOne({
        accountId
    });

    assert.ok(account);

    return BigInt(account.balanceMinor);
}

before(async () => {
    await connectMongoDB();
    db = getDatabase();

    await db.dropDatabase();
    await initializeCollections();
    await initializeValidators();
    await initializeIndexes();

    clientId = randomUUID();

    const registrationNumber = `TEST-${randomUUID().slice(0, 12)}`;

    await db.collection("clients").insertOne({
        clientId,
        companyName: "Transaction Test Corporation",
        registrationNumber,
        registrationNumberNormalized: registrationNumber,
        industry: "Technology",
        country: "Canada",
        contactEmail: "transactions@example.com",
        contactPhone: "",
        status: "Active",
        createdAt: new Date(),
        updatedAt: new Date()
    });


    const source = accountDocument("CAD", 100000);
    const destination = accountDocument("CAD", 50000);
    const usd = accountDocument("USD", 50000);

    sourceId = source.accountId;
    destinationId = destination.accountId;
    usdId = usd.accountId;

    await db.collection("accounts").insertMany([
        source,
        destination,
        usd
    ]);

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

test("TX-01: valid initiation creates a Pending transaction", async () => {
    const response = await initiate();

    assert.equal(response.status, 201);
    assert.equal(response.body.data.status, "Pending");
    assert.ok(response.body.data.transactionId);
    assert.ok(response.body.data.referenceNumber);
    assert.ok(response.headers.get("location"));
});

test("TX-02: invalid amount returns HTTP 400", async () => {
    const response = await initiate(-100);

    assert.equal(response.status, 400);
    assert.ok(response.body.error);
});

test("TX-03: identical accounts return HTTP 400", async () => {
    const response = await initiate(
        1000,
        sourceId,
        sourceId
    );

    assert.equal(response.status, 400);
});

test("TX-04: mismatched currencies are rejected", async () => {
    const response = await initiate(
        1000,
        sourceId,
        usdId
    );

    assert.equal(response.status, 400);
});

test("TX-05: nonexistent account returns HTTP 404", async () => {
    const response = await initiate(
        1000,
        randomUUID(),
        destinationId
    );

    assert.equal(response.status, 404);
});

test("TX-06 and TX-07: idempotency prevents duplicate instructions", async () => {
    const key = randomUUID();

    const first = await initiate(
        1000,
        sourceId,
        destinationId,
        "CAD",
        key
    );

    const repeated = await initiate(
        1000,
        sourceId,
        destinationId,
        "CAD",
        key
    );

    const conflicting = await initiate(
        2000,
        sourceId,
        destinationId,
        "CAD",
        key
    );

    assert.equal(first.status, 201);
    assert.equal(repeated.status, 200);
    assert.equal(conflicting.status, 409);

    assert.equal(
        first.body.data.transactionId,
        repeated.body.data.transactionId
    );

    assert.equal(
        await db.collection("transactions").countDocuments({
            idempotencyKey: key
        }),
        1
    );
});

test("TX-08: processing updates both balances atomically", async () => {
    const created = await initiate(2500);

    assert.equal(created.status, 201);

    const sourceBefore = await balance(sourceId);
    const destinationBefore = await balance(destinationId);

    const processed = await request(
        `/transactions/${created.body.data.transactionId}/process`,
        "POST"
    );

    assert.equal(processed.status, 200);
    assert.equal(processed.body.data.status, "Completed");
    assert.ok(processed.body.data.processedAt);

    assert.equal(
        await balance(sourceId),
        sourceBefore - 2500n
    );

    assert.equal(
        await balance(destinationId),
        destinationBefore + 2500n
    );

    assert.equal(
        (await balance(sourceId)) +
        (await balance(destinationId)),
        sourceBefore + destinationBefore
    );
});

test("TX-09: insufficient funds cause rejection without balance changes", async () => {
    const created = await initiate(200000);

    assert.equal(created.status, 201);

    const sourceBefore = await balance(sourceId);
    const destinationBefore = await balance(destinationId);

    const processed = await request(
        `/transactions/${created.body.data.transactionId}/process`,
        "POST"
    );

    assert.equal(processed.status, 200);
    assert.equal(processed.body.data.status, "Rejected");
    assert.equal(
        processed.body.data.rejectionCode,
        "INSUFFICIENT_FUNDS"
    );

    assert.equal(await balance(sourceId), sourceBefore);
    assert.equal(await balance(destinationId), destinationBefore);
});

test("TX-10: Frozen source account is rejected", async () => {
    const source = accountDocument("CAD", 5000, "Frozen");
    await db.collection("accounts").insertOne(source);

    const created = await initiate(
        1000,
        source.accountId,
        destinationId
    );

    assert.equal(created.status, 201);

    const processed = await request(
        `/transactions/${created.body.data.transactionId}/process`,
        "POST"
    );

    assert.equal(processed.status, 200);
    assert.equal(processed.body.data.status, "Rejected");
    assert.equal(
        processed.body.data.rejectionCode,
        "SOURCE_ACCOUNT_INACTIVE"
    );

    assert.equal(
        await balance(source.accountId),
        5000n
    );
});

test("TX-11: Closed destination account is rejected", async () => {
    const destination = accountDocument("CAD", 5000, "Closed");
    await db.collection("accounts").insertOne(destination);

    const created = await initiate(
        1000,
        sourceId,
        destination.accountId
    );

    assert.equal(created.status, 201);

    const sourceBefore = await balance(sourceId);

    const processed = await request(
        `/transactions/${created.body.data.transactionId}/process`,
        "POST"
    );

    assert.equal(processed.status, 200);
    assert.equal(processed.body.data.status, "Rejected");
    assert.equal(
        processed.body.data.rejectionCode,
        "DESTINATION_ACCOUNT_INACTIVE"
    );

    assert.equal(await balance(sourceId), sourceBefore);
    assert.equal(
        await balance(destination.accountId),
        5000n
    );
});

test("TX-12: Completed transaction cannot be processed twice", async () => {
    const created = await initiate(1000);

    const path =
        `/transactions/${created.body.data.transactionId}/process`;

    const first = await request(path, "POST");
    const second = await request(path, "POST");

    assert.equal(first.status, 200);
    assert.equal(first.body.data.status, "Completed");
    assert.equal(second.status, 409);
});

test("TX-14: failure after debit aborts the entire transfer", async () => {
    const created = await initiate(3500);

    assert.equal(created.status, 201);

    const transactionId = created.body.data.transactionId;

    const sourceBefore = await balance(sourceId);
    const destinationBefore = await balance(destinationId);

    let failureInjected = false;

    await assert.rejects(
        processTransaction(transactionId, {
            afterDebit: async () => {
                failureInjected = true;
                throw new Error("Injected transaction failure");
            }
        }),
        {
            message: "Injected transaction failure"
        }
    );

    assert.equal(failureInjected, true);

    const sourceAfter = await balance(sourceId);
    const destinationAfter = await balance(destinationId);

    assert.equal(sourceAfter, sourceBefore);
    assert.equal(destinationAfter, destinationBefore);

    const transaction = await db.collection("transactions").findOne({
        transactionId
    });

    assert.ok(transaction);
    assert.equal(transaction.status, "Pending");
    assert.equal(transaction.processedAt, null);

    assert.equal(
        sourceAfter + destinationAfter,
        sourceBefore + destinationBefore
    );

    assert.equal(
        await db.collection("transactions").countDocuments({
            transactionId
        }),
        1
    );
});