
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

let db;

before(async () => {
    ({ db } = await startIntegrationEnvironment());
});

after(stopIntegrationEnvironment);

async function createTransfer(amountMinor = 10000) {
    const client = await createTestClient();

    const source = await createTestAccount(
        client.clientId,
        { balanceMinor: 1000000 }
    );

    const destination = await createTestAccount(
        client.clientId,
        { balanceMinor: 1000000 }
    );

    const created = await request(
        "POST",
        "/transactions",
        {
            body: {
                sourceAccountId: source.accountId,
                destinationAccountId: destination.accountId,
                amountMinor,
                currency: "CAD"
            },
            headers: {
                "Idempotency-Key": randomUUID()
            }
        }
    );

    expectStatus(created, 201);

    return {
        transactionId: created.data.data.transactionId,
        source,
        destination,
        amountMinor
    };
}

async function balance(accountId) {
    const stored = await db.collection("accounts").findOne({
        accountId
    });

    assert.ok(stored);
    return BigInt(stored.balanceMinor);
}

test("Concurrent processing debits a transaction at most once", async () => {
    const transaction = await createTransfer();

    const responses = await Promise.all(
        Array.from({ length: 6 }, () =>
            request(
                "POST",
                `/transactions/${transaction.transactionId}/process`
            )
        )
    );

    const completed = await db
        .collection("transactions")
        .findOne({
            transactionId: transaction.transactionId
        });

    assert.ok(completed);
    assert.equal(completed.status, "Completed");

    assert.ok(responses.some(response =>
        response.status === 200
    ));

    const sourceAfter = await balance(
        transaction.source.accountId
    );

    const destinationAfter = await balance(
        transaction.destination.accountId
    );

    assert.equal(sourceAfter, 990000n);
    assert.equal(destinationAfter, 1010000n);
});

test("Processing creates exactly one debit and credit", async () => {
    const transaction = await createTransfer();

    const response = await request(
        "POST",
        `/transactions/${transaction.transactionId}/process`
    );

    expectStatus(response, 200);

    const entries = await db
        .collection("account_balance_history")
        .find({
            transactionId: transaction.transactionId
        })
        .toArray();

    assert.equal(entries.length, 2);

    const finalSource = await balance(
        transaction.source.accountId
    );

    const finalDestination = await balance(
        transaction.destination.accountId
    );

    assert.equal(finalSource, 990000n);
    assert.equal(finalDestination, 1010000n);
});

test("Reprocessing cannot create more ledger entries", async () => {
    const transaction = await createTransfer();

    const first = await request(
        "POST",
        `/transactions/${transaction.transactionId}/process`
    );

    expectStatus(first, 200);

    const countBefore = await db
        .collection("account_balance_history")
        .countDocuments({
            transactionId: transaction.transactionId
        });

    const second = await request(
        "POST",
        `/transactions/${transaction.transactionId}/process`
    );

    expectStatus(second, 409);

    const countAfter = await db
        .collection("account_balance_history")
        .countDocuments({
            transactionId: transaction.transactionId
        });

    assert.equal(countAfter, countBefore);
});

test("Insufficient funds do not credit destination", async () => {
    const transaction = await createTransfer();

    const { Long } = await import("mongodb");

    await db.collection("accounts").updateOne(
        { accountId: transaction.source.accountId },
        {
            $set: {
                balanceMinor: Long.fromNumber(0)
            }
        }
    );

    const response = await request(
        "POST",
        `/transactions/${transaction.transactionId}/process`
    );

    expectStatus(response, 200);
    assert.equal(response.data.data.status, "Rejected");

    assert.equal(
        await balance(transaction.source.accountId),
        0n
    );

    assert.equal(
        await balance(transaction.destination.accountId),
        1000000n
    );
});
