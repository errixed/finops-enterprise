import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Long } from "mongodb";

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
let sourceId;
let destinationId;

before(async () => {
    await connectMongoDB();
    db = getDatabase();

    await db.dropDatabase();
    await initializeCollections();
    await initializeValidators();
    await initializeIndexes();

    const clientId = randomUUID();
    sourceId = randomUUID();
    destinationId = randomUUID();

    const now = new Date();
    const registrationNumber = `TEST-${randomUUID().slice(0, 12)}`;

    await db.collection("clients").insertOne({
        clientId,
        companyName: "Concurrency Test Corporation",
        registrationNumber,
        registrationNumberNormalized: registrationNumber,
        industry: "Technology",
        country: "Canada",
        contactEmail: "concurrency@example.com",
        contactPhone: "",
        status: "Active",
        createdAt: now,
        updatedAt: now
    });


    await db.collection("accounts").insertMany([
        {
            accountId: sourceId,
            clientId,
            accountNumber: `TEST-${randomUUID()}`,
            accountType: "Operating",
            currency: "CAD",
            balanceMinor: Long.fromNumber(100000),
            status: "Active",
            createdAt: now
        },
        {
            accountId: destinationId,
            clientId,
            accountNumber: `TEST-${randomUUID()}`,
            accountType: "Operating",
            currency: "CAD",
            balanceMinor: Long.fromNumber(50000),
            status: "Active",
            createdAt: now
        }
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

test("TX-13: concurrent processing executes a transfer at most once", async () => {
    const initiatedResponse = await fetch(
        `${baseUrl}/transactions`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": randomUUID()
            },
            body: JSON.stringify({
                sourceAccountId: sourceId,
                destinationAccountId: destinationId,
                amountMinor: 10000,
                currency: "CAD",
                description: "Concurrency test"
            })
        }
    );

    assert.equal(initiatedResponse.status, 201);

    const initiated = await initiatedResponse.json();
    const transactionId = initiated.data.transactionId;

    const url =
        `${baseUrl}/transactions/${transactionId}/process`;

    const responses = await Promise.all([
        fetch(url, { method: "POST" }),
        fetch(url, { method: "POST" })
    ]);

    const statuses = responses.map(response => response.status);

    assert.ok(
        statuses.every(status =>
            status === 200 ||
            status === 409 ||
            status === 500 ||
            status === 503
        )
    );

    const transaction = await db.collection("transactions").findOne({
        transactionId
    });

    const source = await db.collection("accounts").findOne({
        accountId: sourceId
    });

    const destination = await db.collection("accounts").findOne({
        accountId: destinationId
    });

    assert.ok(source);
    assert.ok(destination);

    const sourceBalance = BigInt(source.balanceMinor);
    const destinationBalance = BigInt(destination.balanceMinor);

    assert.ok(["Pending", "Completed"].includes(transaction.status));

    if (transaction.status === "Completed") {
        assert.equal(sourceBalance, 90000n);
        assert.equal(destinationBalance, 60000n);
    } else {
        assert.equal(sourceBalance, 100000n);
        assert.equal(destinationBalance, 50000n);
    }

    assert.equal(
        sourceBalance + destinationBalance,
        150000n
    );

    assert.equal(
        await db.collection("transactions").countDocuments({
            transactionId
        }),
        1
    );

});