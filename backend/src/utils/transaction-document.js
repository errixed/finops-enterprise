import { Long } from "mongodb";

const MAX_SAFE_BALANCE = BigInt(Number.MAX_SAFE_INTEGER);

function toDate(value, field) {
    const date = value instanceof Date
        ? value
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid ${field}`);
    }

    return date;
}

function toAmountLong(value) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new RangeError(
            "amountMinor must be a positive safe integer"
        );
    }

    return Long.fromBigInt(BigInt(value));
}

function toSafeAmount(value) {
    const amount = Long.isLong(value)
        ? value.toBigInt()
        : typeof value === "bigint"
            ? value
            : BigInt(value);

    if (amount <= 0n || amount > MAX_SAFE_BALANCE) {
        throw new RangeError(
            "amountMinor exceeds the supported range"
        );
    }

    return Number(amount);
}

export function toTransactionDocument(transaction) {
    const createdAt = toDate(
        transaction.createdAt,
        "createdAt"
    );

    const updatedAt = toDate(
        transaction.updatedAt ?? transaction.createdAt,
        "updatedAt"
    );

    const processedAt = transaction.processedAt == null
        ? null
        : toDate(transaction.processedAt, "processedAt");

    const isLegacy = transaction.isLegacy === true;

    if (!isLegacy) {
        if (
            typeof transaction.idempotencyKey !== "string" ||
            !transaction.idempotencyKey.trim() ||
            typeof transaction.requestFingerprint !== "string" ||
            !transaction.requestFingerprint
        ) {
            throw new Error(
                "New transactions require an idempotency key and request fingerprint"
            );
        }
    }

    return {
        ...transaction,
        amountMinor: toAmountLong(transaction.amountMinor),
        isLegacy,
        rejectionCode: transaction.rejectionCode ?? null,
        rejectionReason: transaction.rejectionReason ?? null,
        createdAt,
        updatedAt,
        processedAt
    };
}

export function serializeTransactionDocument(document) {
    if (!document) {
        return null;
    }

    const { _id, ...transaction } = document;

    return {
        ...transaction,
        amountMinor: toSafeAmount(transaction.amountMinor),
        createdAt: toDate(
            transaction.createdAt,
            "createdAt"
        ).toISOString(),
        updatedAt: toDate(
            transaction.updatedAt,
            "updatedAt"
        ).toISOString(),
        processedAt: transaction.processedAt == null
            ? null
            : toDate(
                transaction.processedAt,
                "processedAt"
            ).toISOString()
    };
}