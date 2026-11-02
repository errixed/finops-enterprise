import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Long } from "mongodb";

if (
    process.env.MONGODB_DATABASE !== "finops_enterprise_test"
) {
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

const {
    findClientById,
    insertClient,
    searchClients
} = await import("../src/repositories/client.repository.js");

const {
    findAccountById,
    insertAccount,
    filterAccounts
} = await import("../src/repositories/account.repository.js");

let db;
let clientId;
let accountId;

before(async () => {
    await connectMongoDB();
    db = getDatabase();

    await db.dropDatabase();
    await initializeCollections();
    await initializeValidators();
    await initializeIndexes();
});

after(async () => {
    if (db) {
        await db.dropDatabase();
    }

    await closeMongoDB();
});

test("Repository: inserts and retrieves a client", async () => {
    clientId = randomUUID();
    const now = new Date().toISOString();

    const client = {
        clientId,
        companyName: "Acceptance Test Corporation",
        registrationNumber: `TEST-${randomUUID().slice(0, 12)}`,
        industry: "Technology",
        country: "Canada",
        contactEmail: "test@example.com",
        contactPhone: "",
        status: "Active",
        createdAt: now,
        updatedAt: now
    };

    const inserted = await insertClient(client);
    const retrieved = await findClientById(clientId);

    assert.equal(inserted.clientId, clientId);
    assert.equal(retrieved.clientId, clientId);
    assert.equal(retrieved.companyName, client.companyName);
});

test("Repository: unique registration is enforced", async () => {
    const original = await db.collection("clients").findOne({
        clientId
    });

    const duplicate = {
        ...original,
        clientId: randomUUID()
    };

    delete duplicate._id;

    await assert.rejects(
        db.collection("clients").insertOne(duplicate),
        error => error.code === 11000
    );
});

test("Repository: MongoDB filtering and pagination work", async () => {
    const result = await searchClients({
        search: "Acceptance Test",
        status: "Active",
        page: 1,
        pageSize: 1
    });

    assert.equal(result.data.length, 1);
    assert.equal(result.pagination.page, 1);
    assert.equal(result.pagination.pageSize, 1);
    assert.equal(result.pagination.total, 1);
    assert.equal(result.data[0].clientId, clientId);
});

test("Repository: account balances use exact minor units", async () => {
    const inserted = await insertAccount({
        clientId,
        accountType: "Operating",
        currency: "CAD",
        balanceMinor: 12507550,
        status: "Active",
        createdAt: new Date().toISOString()
    });

    accountId = inserted.accountId;

    const retrieved = await findAccountById(accountId);

    assert.equal(retrieved.balanceMinor, 12507550);
    assert.equal(retrieved.currency, "CAD");
    assert.equal(retrieved.clientId, clientId);


    const stored = await db.collection("accounts").findOne({
        accountId
    });

    assert.ok(stored);

    assert.equal(
        BigInt(stored.balanceMinor),
        BigInt(12507550)
    );

    const storedAsInt64 = await db.collection("accounts").findOne({
        accountId,
        balanceMinor: {
            $type: "long"
        }
    });

    assert.ok(storedAsInt64);

});

test("Repository: account filters run correctly", async () => {
    const results = await filterAccounts({
        clientId,
        currency: "CAD",
        status: "Active"
    });

    assert.equal(results.length, 1);
    assert.equal(results[0].accountId, accountId);
});

test("Repository: negative balances are rejected by MongoDB", async () => {
    const original = await db.collection("accounts").findOne({
        accountId
    });

    const invalid = {
        ...original,
        accountId: randomUUID(),
        accountNumber: `TEST-${randomUUID()}`,
        balanceMinor: Long.fromNumber(-100)
    };

    delete invalid._id;

    await assert.rejects(
        db.collection("accounts").insertOne(invalid),
        error => error.code === 121
    );
});