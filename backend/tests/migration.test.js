import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MongoClient } from "mongodb";

const execute = promisify(execFile);
const databaseName = "finops_enterprise_test";
const uri = process.env.MONGODB_URI;

if (
    process.env.MONGODB_DATABASE !== databaseName ||
    !uri
) {
    throw new Error("An isolated MongoDB test configuration is required");
}

const client = new MongoClient(uri);
let db;
let source;

async function runScript(filename) {
    return execute(
        process.execPath,
        [`scripts/${filename}`],
        {
            env: {
                ...process.env,
                MONGODB_DATABASE: databaseName,
                MONGODB_DB_NAME: databaseName
            },
            timeout: 120000
        }
    );
}

before(async () => {
    await client.connect();
    db = client.db(databaseName);
    await db.dropDatabase();

    source = {};

    for (const name of ["clients", "accounts", "transactions"]) {
        source[name] = JSON.parse(
            await readFile(
                new URL(`../data/legacy/${name}.json`, import.meta.url),
                "utf8"
            )
        );
    }

    await runScript("migrate-json-to-mongodb.js");
});

after(async () => {
    if (db) {
        await db.dropDatabase();
    }

    await client.close();
});

test("DB-01: all legacy clients are preserved", async () => {
    const collection = db.collection("clients");

    for (const record of source.clients) {
        const stored = await collection.findOne({
            clientId: record.clientId
        });

        assert.ok(stored);
        assert.equal(stored.companyName, record.companyName);
        assert.equal(stored.registrationNumber, record.registrationNumber);
        assert.equal(stored.contactEmail, record.contactEmail);
        assert.equal(stored.status, record.status);
        assert.equal(stored.createdAt.toISOString(), record.createdAt);
    }

    assert.equal(
        await collection.countDocuments(),
        source.clients.length
    );
});

test("DB-02: account balances and relationships are preserved", async () => {
    const collection = db.collection("accounts");
    const clientIds = new Set(
        source.clients.map(record => record.clientId)
    );

    for (const record of source.accounts) {
        const stored = await collection.findOne({
            accountId: record.accountId
        });

        assert.ok(stored);
        assert.ok(clientIds.has(stored.clientId));
        assert.equal(stored.accountNumber, record.accountNumber);
        assert.equal(stored.currency, record.currency);
        assert.equal(stored.status, record.status);
        
        assert.equal(
            BigInt(stored.balanceMinor),
            BigInt(record.balanceMinor)
        );

    }

    assert.equal(
        await collection.countDocuments(),
        source.accounts.length
    );
});

test("DB-03: all historical transactions are preserved", async () => {
    const collection = db.collection("transactions");

    const accountIds = new Set(
        source.accounts.map(record => record.accountId)
    );

    for (const record of source.transactions) {
        const stored = await collection.findOne({
            transactionId: record.transactionId
        });

        assert.ok(stored);
        assert.equal(stored.referenceNumber, record.referenceNumber);
        assert.equal(stored.status, record.status);
        assert.equal(stored.currency, record.currency);
        assert.equal(stored.isLegacy, true);
        
        assert.equal(
            BigInt(stored.amountMinor),
            BigInt(record.amountMinor)
        );

        assert.ok(accountIds.has(stored.sourceAccountId));
        assert.ok(accountIds.has(stored.destinationAccountId));
    }

    assert.equal(
        await collection.countDocuments(),
        source.transactions.length
    );
});

test("DB-04: migration is repeatable without duplicates", async () => {
    const beforeCounts = {};

    for (const name of ["clients", "accounts", "transactions"]) {
        beforeCounts[name] = await db
            .collection(name)
            .countDocuments();
    }

    await runScript("migrate-json-to-mongodb.js");
    await runScript("verify-migration.js");

    for (const name of ["clients", "accounts", "transactions"]) {
        assert.equal(
            await db.collection(name).countDocuments(),
            beforeCounts[name]
        );
    }

    assert.equal(
        await db.collection("schema_migrations").countDocuments({
            version: "assignment2_initial_migration_v1"
        }),
        1
    );
});

test("DB-05: duplicate registration numbers are rejected", async () => {
    const original = await db.collection("clients").findOne({});

    const duplicate = {
        ...original,
        _id: undefined,
        clientId: randomUUID()
    };

    delete duplicate._id;

    await assert.rejects(
        db.collection("clients").insertOne(duplicate),
        error => error.code === 11000
    );
});

test("DB-06: historical Pending transactions remain protected", async t => {
    const pending = await db.collection("transactions").findOne({
        status: "Pending",
        isLegacy: true
    });

    if (!pending) {
        t.skip("No historical Pending transaction exists in the source dataset");
        return;
    }

    const { processTransaction } = await import(
        "../src/services/transaction-processing.service.js"
    );

    const { connectMongoDB, closeMongoDB } = await import(
        "../src/config/mongodb.js"
    );

    await connectMongoDB();

    try {
        await assert.rejects(
            processTransaction(pending.transactionId),
            error => error.statusCode === 409
        );
    } finally {
        await closeMongoDB();
    }
});

test("DB-07: Assignment 3 migration preserves legacy data", async () => {
    const transactions = db.collection("transactions");
    const accounts = db.collection("accounts");

    const beforeTransactions = await transactions
        .find({ isLegacy: true })
        .project({
            _id: 0,
            transactionId: 1,
            status: 1
        })
        .sort({ transactionId: 1 })
        .toArray();

    const beforeAccounts = await accounts
        .find({})
        .project({
            _id: 0,
            accountId: 1,
            balanceMinor: 1
        })
        .sort({ accountId: 1 })
        .toArray();

    const firstRun = await runScript("migrate-schema.js");

    assert.match(
        firstRun.stdout,
        /Migration completed|Migration already completed/
    );

    const migration = await db
        .collection("schema_migrations")
        .findOne({
            version: "assignment3_risk_approval_v1"
        });

    assert.ok(migration);
    assert.equal(migration.status, "Completed");

    for (const name of [
        "risk_policies",
        "risk_assessments",
        "approval_policies",
        "approval_workflows",
        "approval_decisions",
        "workflow_actors"
    ]) {
        const exists = await db
            .listCollections({ name }, { nameOnly: true })
            .hasNext();

        assert.equal(exists, true, name);
    }

    assert.equal(
        await db.collection("workflow_actors").countDocuments({
            active: true
        }),
        4
    );

    const afterTransactions = await transactions
        .find({ isLegacy: true })
        .project({
            _id: 0,
            transactionId: 1,
            status: 1
        })
        .sort({ transactionId: 1 })
        .toArray();

    assert.deepEqual(afterTransactions, beforeTransactions);

    const afterAccounts = await accounts
        .find({})
        .project({
            _id: 0,
            accountId: 1,
            balanceMinor: 1
        })
        .sort({ accountId: 1 })
        .toArray();

    assert.deepEqual(afterAccounts, beforeAccounts);

    const historicalPending = await transactions
        .find({ isLegacy: true, status: "Pending" })
        .toArray();

    for (const transaction of historicalPending) {
        assert.equal(transaction.approvalStatus, "Cancelled");
        assert.equal(transaction.approvalWorkflowId, null);
        assert.equal(transaction.riskAssessmentId, null);
    }

    const secondRun = await runScript("migrate-schema.js");

    assert.match(
        secondRun.stdout,
        /Migration already completed/
    );

    assert.equal(
        await db.collection("schema_migrations")
            .countDocuments({
                version: "assignment3_risk_approval_v1"
            }),
        1
    );
});
