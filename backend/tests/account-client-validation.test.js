
import test from "node:test";
import assert from "node:assert/strict";
import { Long } from "mongodb";

import {
    toAccountDocument,
    serializeAccountDocument
} from "../src/utils/account-document.js";

import {
    normalizeRegistrationNumber,
    toClientDocument,
    serializeClientDocument
} from "../src/utils/client-document.js";

function createAccount(overrides = {}) {
    return {
        accountId: "ACC-001",
        clientId: "CLIENT-001",
        currency: "CAD",
        balanceMinor: 150000,
        status: "Active",
        createdAt: "2026-11-01T00:00:00.000Z",
        ...overrides
    };
}

function createClient(overrides = {}) {
    return {
        clientId: "CLIENT-001",
        name: "Test Corporation",
        registrationNumber: "ab123",
        status: "Active",
        createdAt: "2026-11-01T00:00:00.000Z",
        updatedAt: "2026-11-02T00:00:00.000Z",
        nextReviewAt: "2027-01-01T00:00:00.000Z",
        ...overrides
    };
}

test("Valid account converts balance to MongoDB Long", () => {
    const result = toAccountDocument(
        createAccount()
    );

    assert.equal(
        Long.isLong(result.balanceMinor),
        true
    );

    assert.equal(
        result.balanceMinor.toBigInt(),
        150000n
    );
});

test("Zero account balance is accepted", () => {
    const result = toAccountDocument(
        createAccount({ balanceMinor: 0 })
    );

    assert.equal(
        result.balanceMinor.toBigInt(),
        0n
    );
});

test("Negative account balance is rejected", () => {
    assert.throws(
        () => toAccountDocument(
            createAccount({ balanceMinor: -1 })
        ),
        /non-negative safe integer/
    );
});

test("Fractional account balance is rejected", () => {
    assert.throws(
        () => toAccountDocument(
            createAccount({ balanceMinor: 10.5 })
        ),
        /non-negative safe integer/
    );
});

test("Invalid account creation date is rejected", () => {
    assert.throws(
        () => toAccountDocument(
            createAccount({
                createdAt: "invalid"
            })
        ),
        /Invalid createdAt/
    );
});

test("Account serialization restores numeric balance", () => {
    const account = toAccountDocument(
        createAccount()
    );

    const result = serializeAccountDocument({
        _id: "DB-ID",
        ...account
    });

    assert.equal(result.balanceMinor, 150000);
    assert.equal(result._id, undefined);

    assert.equal(
        result.createdAt,
        "2026-11-01T00:00:00.000Z"
    );
});

test("Account serialization supports bigint balance", () => {
    const result = serializeAccountDocument({
        ...createAccount(),
        balanceMinor: 200000n
    });

    assert.equal(result.balanceMinor, 200000);
});

test("Account serialization rejects negative stored balance", () => {
    assert.throws(
        () => serializeAccountDocument({
            ...createAccount(),
            balanceMinor: Long.fromNumber(-1)
        }),
        /safe integer range/
    );
});

test("Account serialization rejects unsafe stored balance", () => {
    assert.throws(
        () => serializeAccountDocument({
            ...createAccount(),
            balanceMinor: Long.fromString(
                "9007199254740992"
            )
        }),
        /safe integer range/
    );
});

test("Null account serialization returns null", () => {
    assert.equal(
        serializeAccountDocument(null),
        null
    );
});

test("Registration number is normalized", () => {
    assert.equal(
        normalizeRegistrationNumber("  ab123  "),
        "AB123"
    );
});

test("Client document normalizes registration number", () => {
    const result = toClientDocument(
        createClient()
    );

    assert.equal(
        result.registrationNumberNormalized,
        "AB123"
    );

    assert.ok(result.createdAt instanceof Date);
    assert.ok(result.updatedAt instanceof Date);
    assert.ok(result.nextReviewAt instanceof Date);
});

test("Client document supports missing review date", () => {
    const result = toClientDocument(
        createClient({ nextReviewAt: null })
    );

    assert.equal(result.nextReviewAt, null);
});

test("Invalid client creation date is rejected", () => {
    assert.throws(
        () => toClientDocument(
            createClient({
                createdAt: "invalid"
            })
        ),
        /Invalid createdAt/
    );
});

test("Invalid client update date is rejected", () => {
    assert.throws(
        () => toClientDocument(
            createClient({
                updatedAt: "invalid"
            })
        ),
        /Invalid updatedAt/
    );
});

test("Invalid client review date is rejected", () => {
    assert.throws(
        () => toClientDocument(
            createClient({
                nextReviewAt: "invalid"
            })
        ),
        /Invalid nextReviewAt/
    );
});

test("Client serialization removes internal fields", () => {
    const client = toClientDocument(
        createClient()
    );

    const result = serializeClientDocument({
        _id: "DB-ID",
        ...client
    });

    assert.equal(result._id, undefined);

    assert.equal(
        result.registrationNumberNormalized,
        undefined
    );

    assert.equal(
        result.registrationNumber,
        "ab123"
    );

    assert.equal(
        result.nextReviewAt,
        "2027-01-01T00:00:00.000Z"
    );
});

test("Null client serialization returns null", () => {
    assert.equal(
        serializeClientDocument(null),
        null
    );
});

test("Client without review date serializes null", () => {
    const client = toClientDocument(
        createClient({
            nextReviewAt: null
        })
    );

    const result = serializeClientDocument(client);

    assert.equal(result.nextReviewAt, null);
});
