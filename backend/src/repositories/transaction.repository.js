import {
    getCollection,
    findPage,
    escapeRegex,
    handleDuplicateKey
} from "./mongodb.repository.js";

import {
    toTransactionDocument,
    serializeTransactionDocument
} from "../utils/transaction-document.js";

function transactions() {
    return getCollection("transactions");
}

export async function findTransactionById(
    transactionId,
    options = {}
) {
    const document = await transactions().findOne(
        { transactionId },
        options
    );

    return serializeTransactionDocument(document);
}

export async function findTransactionsByAccountId(accountId) {
    const documents = await transactions()
        .find({
            $or: [
                { sourceAccountId: accountId },
                { destinationAccountId: accountId }
            ]
        })
        .toArray();

    return documents.map(serializeTransactionDocument);
}

export async function searchTransactions({
    search = "",
    sourceAccountId = "",
    status = "",
    dateFrom = "",
    dateTo = "",
    page = 1,
    pageSize = 10
} = {}) {
    const filter = {};

    if (search.trim()) {
        filter.referenceNumber = {
            $regex: escapeRegex(search.trim()),
            $options: "i"
        };
    }

    if (sourceAccountId) {
        filter.sourceAccountId = sourceAccountId;
    }

    if (status) {
        filter.status = status;
    }

    if (dateFrom || dateTo) {
        filter.createdAt = {};

        if (dateFrom) {
            filter.createdAt.$gte = new Date(
                `${dateFrom}T00:00:00.000Z`
            );
        }

        if (dateTo) {
            filter.createdAt.$lt = new Date(
                Date.parse(`${dateTo}T00:00:00.000Z`) +
                86400000
            );
        }
    }

    return findPage({
        collection: transactions(),
        filter,
        sort: { createdAt: -1, transactionId: 1 },
        page,
        pageSize,
        serialize: serializeTransactionDocument
    });
}

export async function countTransactions(filter = {}) {
    return transactions().countDocuments(filter);
}

export async function updateTransactionStatus({
    transactionId,
    expectedStatus,
    status,
    rejectionCode = null,
    rejectionReason = null,
    processedAt = null,
    session
}) {
    if (!session?.inTransaction()) {
        throw new Error(
            "An active MongoDB transaction is required"
        );
    }

    const allowedTransitions = {
        Pending: ["Processing"],
        Processing: ["Completed", "Rejected"]
    };

    if (
        !allowedTransitions[expectedStatus]?.includes(status)
    ) {
        throw new Error(
            `Invalid transaction transition: ${expectedStatus} to ${status}`
        );
    }

    const now = new Date();

    const result = await transactions().updateOne(
        {
            transactionId,
            status: expectedStatus,
            isLegacy: false
        },
        {
            $set: {
                status,
                rejectionCode,
                rejectionReason,
                updatedAt: now,
                processedAt:
                    status === "Completed" || status === "Rejected"
                        ? processedAt
                            ? new Date(processedAt)
                            : now
                        : null
            }
        },
        { session }
    );

    return result.modifiedCount === 1;
}

export async function findTransactionByIdempotencyKey(idempotencyKey) {
    const document = await transactions().findOne({
        idempotencyKey,
        isLegacy: false
    });

    return serializeTransactionDocument(document);
}

export async function insertPendingTransaction(transaction) {
    const document = toTransactionDocument(transaction);
    await transactions().insertOne(document);

    return serializeTransactionDocument(document);
}

export async function findTransactionForProcessing(
    transactionId,
    session
) {
    if (!session?.inTransaction()) {
        throw new Error("An active MongoDB transaction is required");
    }

    return transactions().findOne(
        { transactionId },
        { session }
    );
}