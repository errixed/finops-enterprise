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

export async function insertTransaction(transaction, options = {}) {
    const document = toTransactionDocument(transaction);

    try {
        await transactions().insertOne(document, options);
        return serializeTransactionDocument(document);
    } catch (error) {
        handleDuplicateKey(
            error,
            "Transaction identifier, reference number or idempotency key already exists"
        );
    }
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
    if (!session) {
        throw new Error(
            "Transaction status changes require a MongoDB session"
        );
    }

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
                updatedAt: new Date(),
                processedAt: processedAt
                    ? new Date(processedAt)
                    : null
            }
        },
        { session }
    );

    return result.modifiedCount === 1;
}