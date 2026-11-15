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
    currency = "",
    dateFrom = "",
    dateTo = "",
    page = 1,
    pageSize = 10
} = {}) {
    const filter = {};

    if (search.trim()) {
        const query = {
            $regex: escapeRegex(search.trim()),
            $options: "i"
        };

        const matchingAccounts = await getCollection("accounts")
            .find(
                { accountNumber: query },
                { projection: { accountId: 1 } }
            )
            .toArray();

        const matchingAccountIds = matchingAccounts.map(
            account => account.accountId
        );

        filter.$or = [
            {
                referenceNumber: query
            },
            {
                sourceAccountId: {
                    $in: matchingAccountIds
                }
            },
            {
                destinationAccountId: {
                    $in: matchingAccountIds
                }
            }
        ];
    }

    if (sourceAccountId) {
        filter.sourceAccountId = sourceAccountId;
    }

    if (status) {
        filter.status = status;
    }

    if (currency) {
        filter.currency = currency;
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
        sort: {
            createdAt: -1,
            transactionId: 1
        },
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

export async function findTransactionByIdempotencyKey(
    idempotencyKey,
    options = {}
) {
    const document = await transactions().findOne(
        {
            idempotencyKey,
            isLegacy: false
        },
        options
    );

    return serializeTransactionDocument(document);
}

export async function insertPendingTransaction(
    transaction,
    session
) {
    if (!session?.inTransaction()) {
        throw new Error(
            "An active MongoDB transaction is required"
        );
    }

    const document = toTransactionDocument(transaction);

    await transactions().insertOne(document, { session });

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

export async function getRecentCompletedOutgoingActivity({
    sourceAccountId,
    currency,
    periodHours = 24,
    asOf = new Date(),
    session
}) {
    if (
        typeof sourceAccountId !== "string" ||
        !["CAD", "USD"].includes(currency) ||
        !Number.isSafeInteger(periodHours) ||
        periodHours <= 0 ||
        periodHours > 8760
    ) {
        throw new Error("Invalid transaction history parameters");
    }

    const end = new Date(asOf);

    if (Number.isNaN(end.getTime())) {
        throw new Error("Invalid assessment time");
    }

    const start = new Date(
        end.getTime() - periodHours * 60 * 60 * 1000
    );

    const pipeline = [
        {
            $match: {
                sourceAccountId,
                currency,
                transactionType: "Transfer",
                status: "Completed",
                isLegacy: false,
                processedAt: {
                    $gte: start,
                    $lt: end
                }
            }
        },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                volume: {
                    $sum: { $toDecimal: "$amountMinor" }
                }
            }
        }
    ];

    const options = session ? { session } : {};

    const [result] = await transactions()
        .aggregate(pipeline, options)
        .toArray();

    if (!result) {
        return {
            recentTransactionCount: 0,
            recentTransferVolumeMinor: 0
        };
    }


    const volume = BigInt(result.volume.toString());

    if (
        volume < 0n ||
        volume > BigInt(Number.MAX_SAFE_INTEGER)
    ) {
        throw new RangeError(
            "Recent transfer volume is outside the supported range"
        );
    }

    if (
        !Number.isSafeInteger(result.count) ||
        result.count < 0
    ) {
        throw new RangeError(
            "Invalid recent transaction count"
        );
    }

    return {
        recentTransactionCount: result.count,
        recentTransferVolumeMinor: Number(volume)
    };

}

export async function createRiskActivityIndex() {
    await transactions().createIndex(
        {
            sourceAccountId: 1,
            currency: 1,
            status: 1,
            processedAt: -1
        },
        {
            name: "idx_transaction_risk_activity"
        }
    );
}

export async function updateTransactionApprovalStatus({
    transactionId,
    workflowId,
    expectedApprovalStatus,
    nextApprovalStatus,
    session
}) {
    if (!session?.inTransaction()) {
        throw new Error("An active MongoDB transaction is required");
    }

    const result = await transactions().updateOne(
        {
            transactionId,
            approvalWorkflowId: workflowId,
            approvalStatus: expectedApprovalStatus,
            status: "Pending",
            isLegacy: false
        },
        {
            $set: {
                approvalStatus: nextApprovalStatus,
                updatedAt: new Date()
            }
        },
        { session }
    );

    return result.modifiedCount === 1;
}
