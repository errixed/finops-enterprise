
import test from "node:test";
import assert from "node:assert/strict";
import { Long } from "mongodb";

import {
    validateMinorUnits,
    formatMoney
} from "../src/utils/money.js";

import {
    parsePagination
} from "../src/utils/pagination.js";

import {
    canTransition,
    isEligibleForProcessing,
    TRANSACTION_STATUS
} from "../src/utils/transaction-lifecycle.js";

import {
    toTransactionDocument,
    serializeTransactionDocument
} from "../src/utils/transaction-document.js";

function createTransaction(overrides = {}) {
    return {
        transactionId: "TX-001",
        sourceAccountId: "ACC-001",
        destinationAccountId: "ACC-002",
        amountMinor: 150050,
        currency: "CAD",
        status: "Pending",
        isLegacy: false,
        idempotencyKey: "KEY-001",
        requestFingerprint: "FINGERPRINT-001",
        createdAt: "2026-11-01T12:00:00.000Z",
        updatedAt: "2026-11-01T12:00:00.000Z",
        ...overrides
    };
}

test("Non-negative safe integer amounts are valid", () => {
    for (const value of [
        0,
        1,
        100,
        100000,
        Number.MAX_SAFE_INTEGER
    ]) {
        assert.equal(validateMinorUnits(value), value);
    }
});

test("Invalid monetary amounts are rejected", () => {
    const invalid = [
        -1,
        1.5,
        NaN,
        Infinity,
        -Infinity,
        "100",
        null,
        Number.MAX_SAFE_INTEGER + 1
    ];

    for (const value of invalid) {
        assert.throws(
            () => validateMinorUnits(value),
            /non-negative safe integer/
        );
    }
});

test("CAD amounts are formatted correctly", () => {
    assert.equal(
        formatMoney(123456, "CAD"),
        "$1,234.56"
    );
});

test("USD amounts are formatted correctly", () => {
    assert.match(
        formatMoney(1250, "USD"),
        /12\.50/
    );
});

test("Unsupported currencies are rejected", () => {
    assert.throws(
        () => formatMoney(100, "EUR"),
        /Unsupported currency/
    );
});

test("Valid pagination is accepted", () => {
    assert.deepEqual(
        parsePagination(2, 25),
        {
            page: 2,
            pageSize: 25
        }
    );
});

test("Pagination accepts numeric strings", () => {
    assert.deepEqual(
        parsePagination("3", "20"),
        {
            page: 3,
            pageSize: 20
        }
    );
});

test("Pagination defaults are correct", () => {
    assert.deepEqual(
        parsePagination(),
        {
            page: 1,
            pageSize: 10
        }
    );
});

test("Invalid pagination values are rejected", () => {
    const scenarios = [
        [0, 10],
        [-1, 10],
        [1, 0],
        [1, 101],
        [1.5, 10],
        [1, 1.5],
        ["abc", 10],
        [1, "abc"]
    ];

    for (const [page, pageSize] of scenarios) {
        assert.throws(
            () => parsePagination(page, pageSize),
            /Invalid pagination parameters/
        );
    }
});

test("Pending transaction can transition to processing", () => {
    assert.equal(
        canTransition("Pending", "Processing"),
        true
    );
});

test("Processing transaction can complete", () => {
    assert.equal(
        canTransition("Processing", "Completed"),
        true
    );
});

test("Processing transaction can be rejected", () => {
    assert.equal(
        canTransition("Processing", "Rejected"),
        true
    );
});

test("Invalid transaction transitions are rejected", () => {
    const invalid = [
        ["Pending", "Completed"],
        ["Pending", "Rejected"],
        ["Completed", "Processing"],
        ["Completed", "Pending"],
        ["Rejected", "Processing"],
        ["Rejected", "Pending"],
        ["Unknown", "Completed"],
        ["Pending", "Pending"]
    ];

    for (const [from, to] of invalid) {
        assert.equal(
            canTransition(from, to),
            false
        );
    }
});

test("Transaction status constants are correct", () => {
    assert.equal(TRANSACTION_STATUS.PENDING, "Pending");
    assert.equal(TRANSACTION_STATUS.PROCESSING, "Processing");
    assert.equal(TRANSACTION_STATUS.COMPLETED, "Completed");
    assert.equal(TRANSACTION_STATUS.REJECTED, "Rejected");
});

test("Pending non-legacy transaction is eligible for processing", () => {
    assert.equal(
        isEligibleForProcessing({
            status: "Pending",
            isLegacy: false
        }),
        true
    );
});

test("Legacy transaction cannot be processed", () => {
    assert.equal(
        isEligibleForProcessing({
            status: "Pending",
            isLegacy: true
        }),
        false
    );
});

test("Non-pending transactions cannot be processed", () => {
    for (const status of [
        "Processing",
        "Completed",
        "Rejected"
    ]) {
        assert.equal(
            isEligibleForProcessing({
                status,
                isLegacy: false
            }),
            false
        );
    }
});

test("Undefined legacy flag is not eligible", () => {
    assert.equal(
        isEligibleForProcessing({
            status: "Pending"
        }),
        false
    );
});

test("Transaction is converted to MongoDB document", () => {
    const result = toTransactionDocument(
        createTransaction()
    );

    assert.equal(Long.isLong(result.amountMinor), true);
    assert.equal(result.amountMinor.toBigInt(), 150050n);
    assert.equal(result.isLegacy, false);
    assert.equal(result.rejectionCode, null);
    assert.equal(result.rejectionReason, null);
    assert.equal(result.processedAt, null);
    assert.ok(result.createdAt instanceof Date);
});

test("Transaction document can be serialized", () => {
    const stored = toTransactionDocument(
        createTransaction()
    );

    const result = serializeTransactionDocument({
        _id: "MONGO-ID",
        ...stored
    });

    assert.equal(result.transactionId, "TX-001");
    assert.equal(result.amountMinor, 150050);
    assert.equal(result._id, undefined);

    assert.equal(
        result.createdAt,
        "2026-11-01T12:00:00.000Z"
    );
});

test("Transaction serialization handles null document", () => {
    assert.equal(
        serializeTransactionDocument(null),
        null
    );
});

test("Processed timestamp is serialized", () => {
    const stored = toTransactionDocument(
        createTransaction({
            processedAt: "2026-11-02T10:00:00.000Z"
        })
    );

    const result = serializeTransactionDocument(stored);

    assert.equal(
        result.processedAt,
        "2026-11-02T10:00:00.000Z"
    );
});

test("New transactions require idempotency key", () => {
    assert.throws(
        () => toTransactionDocument(
            createTransaction({
                idempotencyKey: ""
            })
        ),
        /idempotency key/
    );
});

test("New transactions require request fingerprint", () => {
    assert.throws(
        () => toTransactionDocument(
            createTransaction({
                requestFingerprint: ""
            })
        ),
        /request fingerprint/
    );
});

test("Legacy transactions do not require idempotency data", () => {
    const result = toTransactionDocument(
        createTransaction({
            isLegacy: true,
            idempotencyKey: null,
            requestFingerprint: null
        })
    );

    assert.equal(result.isLegacy, true);
});

test("Zero transaction amount is rejected", () => {
    assert.throws(
        () => toTransactionDocument(
            createTransaction({ amountMinor: 0 })
        ),
        /positive safe integer/
    );
});

test("Negative transaction amount is rejected", () => {
    assert.throws(
        () => toTransactionDocument(
            createTransaction({ amountMinor: -100 })
        ),
        /positive safe integer/
    );
});

test("Unsafe transaction amount is rejected", () => {
    assert.throws(
        () => toTransactionDocument(
            createTransaction({
                amountMinor: Number.MAX_SAFE_INTEGER + 1
            })
        ),
        /positive safe integer/
    );
});

test("Invalid transaction creation date is rejected", () => {
    assert.throws(
        () => toTransactionDocument(
            createTransaction({
                createdAt: "invalid"
            })
        ),
        /Invalid createdAt/
    );
});

test("Invalid transaction update date is rejected", () => {
    assert.throws(
        () => toTransactionDocument(
            createTransaction({
                updatedAt: "invalid"
            })
        ),
        /Invalid updatedAt/
    );
});

test("Serialization rejects unsafe stored amounts", () => {
    const stored = toTransactionDocument(
        createTransaction()
    );

    stored.amountMinor = Long.fromString(
        "9007199254740992"
    );

    assert.throws(
        () => serializeTransactionDocument(stored),
        /supported range/
    );
});

test("Serialization rejects zero stored transaction amount", () => {
    const stored = toTransactionDocument(
        createTransaction()
    );

    stored.amountMinor = Long.fromNumber(0);

    assert.throws(
        () => serializeTransactionDocument(stored),
        /supported range/
    );
});
