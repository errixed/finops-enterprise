import {
    findTransactionById,
    searchTransactions,
    findTransactionByIdempotencyKey,
    insertPendingTransaction
} from "../repositories/transaction.repository.js";
import {
    findAccountById
} from "../repositories/account.repository.js";
import { ENUMS } from "../../config.js";
import {
    randomUUID,
    createHash
} from "node:crypto";

const STATUSES = ENUMS.TRANSACTION_STATUSES;

function fail(message, statusCode = 400, field) {
    const error = new Error(message);
    error.statusCode = statusCode;

    if (field) {
        error.details = { field };
    }

    throw error;
}

function parseDate(value, field) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        fail(`Invalid ${field}. Expected YYYY-MM-DD`, 400, field);
    }

    const timestamp = Date.parse(`${value}T00:00:00.000Z`);

    if (
        !Number.isFinite(timestamp) ||
        new Date(timestamp).toISOString().slice(0, 10) !== value
    ) {
        fail(`Invalid ${field}`, 400, field);
    }

    return value;
}

export async function getAllTransactions({
    search = "",
    sourceAccountId = "",
    status = "",
    dateFrom = "",
    dateTo = "",
    page = 1,
    pageSize = 10
} = {}) {
    const currentPage = Number(page);
    const currentPageSize = Number(pageSize);

    if (
        !Number.isInteger(currentPage) ||
        currentPage < 1 ||
        !Number.isInteger(currentPageSize) ||
        currentPageSize < 1 ||
        currentPageSize > 100
    ) {
        fail("Invalid pagination parameters", 400);
    }

    if (
        typeof search !== "string" ||
        typeof sourceAccountId !== "string" ||
        typeof status !== "string"
    ) {
        fail("Invalid transaction filters", 400);
    }

    if (status && !STATUSES.includes(status)) {
        fail("Unsupported transaction status", 400, "status");
    }

    const from = dateFrom
        ? parseDate(dateFrom, "dateFrom")
        : "";

    const to = dateTo
        ? parseDate(dateTo, "dateTo")
        : "";

    if (from && to && from > to) {
        fail(
            "Start date cannot be after end date",
            400,
            "dateFrom"
        );
    }

    const result = await searchTransactions({
        search,
        sourceAccountId,
        status,
        dateFrom: from,
        dateTo: to,
        page: currentPage,
        pageSize: currentPageSize
    });

    const ids = [
        ...new Set(
            result.data.flatMap(transaction => [
                transaction.sourceAccountId,
                transaction.destinationAccountId
            ])
        )
    ];

    const entries = await Promise.all(
        ids.map(async id => [
            id,
            await findAccountById(id)
        ])
    );

    const accountMap = new Map(entries);

    return {
        ...result,
        data: result.data.map(transaction => ({
            ...transaction,
            sourceAccountNumber:
                accountMap.get(transaction.sourceAccountId)
                    ?.accountNumber ?? "Unknown",
            destinationAccountNumber:
                accountMap.get(transaction.destinationAccountId)
                    ?.accountNumber ?? "Unknown"
        }))
    };
}

export async function getTransactionById(transactionId) {
    const transaction = await findTransactionById(transactionId);

    if (!transaction) {
        fail("Transaction not found", 404);
    }

    const [source, destination] = await Promise.all([
        findAccountById(transaction.sourceAccountId),
        findAccountById(transaction.destinationAccountId)
    ]);

    if (!source || !destination) {
        fail("Transaction account relationship is invalid", 500);
    }

    return {
        ...transaction,
        sourceAccount: {
            accountId: source.accountId,
            accountNumber: source.accountNumber,
            clientId: source.clientId,
            currency: source.currency
        },
        destinationAccount: {
            accountId: destination.accountId,
            accountNumber: destination.accountNumber,
            clientId: destination.clientId,
            currency: destination.currency
        }
    };
}

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INITIATION_FIELDS = [
    "sourceAccountId",
    "destinationAccountId",
    "amountMinor",
    "currency",
    "description"
];

function validateInitiationInput(input) {
    if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input)
    ) {
        fail("Request body must be an object", 400);
    }

    for (const field of Object.keys(input)) {
        if (!INITIATION_FIELDS.includes(field)) {
            fail(
                `Field ${field} is not allowed`,
                400,
                field
            );
        }
    }

    const {
        sourceAccountId,
        destinationAccountId,
        amountMinor,
        currency,
        description = ""
    } = input;

    if (
        typeof sourceAccountId !== "string" ||
        !UUID_PATTERN.test(sourceAccountId)
    ) {
        fail(
            "Invalid source account ID",
            400,
            "sourceAccountId"
        );
    }

    if (
        typeof destinationAccountId !== "string" ||
        !UUID_PATTERN.test(destinationAccountId)
    ) {
        fail(
            "Invalid destination account ID",
            400,
            "destinationAccountId"
        );
    }

    if (
        sourceAccountId.toLowerCase() ===
        destinationAccountId.toLowerCase()
    ) {
        fail(
            "Source and destination accounts must differ",
            400,
            "destinationAccountId"
        );
    }

    if (
        !Number.isSafeInteger(amountMinor) ||
        amountMinor <= 0
    ) {
        fail(
            "Amount must be a positive safe integer",
            400,
            "amountMinor"
        );
    }

    if (!ENUMS.CURRENCIES.includes(currency)) {
        fail(
            "Unsupported currency",
            400,
            "currency"
        );
    }

    if (
        typeof description !== "string" ||
        description.length > 250
    ) {
        fail(
            "Description must be a string of at most 250 characters",
            400,
            "description"
        );
    }

    return {
        sourceAccountId: sourceAccountId.toLowerCase(),
        destinationAccountId: destinationAccountId.toLowerCase(),
        amountMinor,
        currency,
        description
    };
}

function validateIdempotencyKey(key) {
    if (
        typeof key !== "string" ||
        !key.trim() ||
        key.length > 200
    ) {
        fail(
            "A valid Idempotency-Key header is required",
            400,
            "Idempotency-Key"
        );
    }

    return key.trim();
}

function fingerprintRequest(payload) {
    return createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex");
}

function resolveExistingTransaction(transaction, fingerprint) {
    if (
        transaction.requestFingerprint !== fingerprint
    ) {
        fail(
            "Idempotency key already used for a different request",
            409,
            "Idempotency-Key"
        );
    }

    return {
        transaction,
        created: false
    };
}

export async function initiateTransaction(input, idempotencyKey) {
    const key = validateIdempotencyKey(idempotencyKey);
    const payload = validateInitiationInput(input);
    const fingerprint = fingerprintRequest(payload);

    const existing = await findTransactionByIdempotencyKey(key);

    if (existing) {
        return resolveExistingTransaction(existing, fingerprint);
    }

    const [sourceAccount, destinationAccount] = await Promise.all([
        findAccountById(payload.sourceAccountId),
        findAccountById(payload.destinationAccountId)
    ]);

    if (!sourceAccount) {
        fail(
            "Source account not found",
            404,
            "sourceAccountId"
        );
    }

    if (!destinationAccount) {
        fail(
            "Destination account not found",
            404,
            "destinationAccountId"
        );
    }

    if (sourceAccount.currency !== destinationAccount.currency) {
        fail(
            "Source and destination account currencies must match",
            400,
            "currency"
        );
    }

    if (payload.currency !== sourceAccount.currency) {
        fail(
            "Transaction currency must match both accounts",
            400,
            "currency"
        );
    }

    const now = new Date().toISOString();
    const transactionId = randomUUID();

    const transaction = {
        transactionId,
        referenceNumber: `TXN-${transactionId.toUpperCase()}`,
        idempotencyKey: key,
        requestFingerprint: fingerprint,
        ...payload,
        transactionType: "Transfer",
        status: "Pending",
        isLegacy: false,
        rejectionCode: null,
        rejectionReason: null,
        createdAt: now,
        updatedAt: now,
        processedAt: null
    };

    try {
        const createdTransaction =
            await insertPendingTransaction(transaction);

        return {
            transaction: createdTransaction,
            created: true
        };
    } catch (error) {
        if (error.code === 11000) {
            const conflictingTransaction =
                await findTransactionByIdempotencyKey(key);

            if (conflictingTransaction) {
                return resolveExistingTransaction(
                    conflictingTransaction,
                    fingerprint
                );
            }

            fail(
                "Transaction identifier or reference conflict",
                409
            );
        }

        throw error;
    }
}

export const TRANSACTION_STATUSES = STATUSES;