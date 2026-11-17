import { randomUUID } from "node:crypto";
import { Long } from "mongodb";
import {
    getCollection,
    repositoryError
} from "./mongodb.repository.js";
import {
    serializeAccountDocument
} from "../utils/account-document.js";

const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

function toBigInt(value) {
    if (Long.isLong(value)) return value.toBigInt();
    if (typeof value === "bigint") return value;
    if (Number.isSafeInteger(value)) return BigInt(value);
    throw repositoryError("Invalid monetary value", 500);
}

function minorNumber(value) {
    const amount = toBigInt(value);
    if (amount < 0 || amount > MAX_MINOR) {
        throw repositoryError("Monetary value out of range", 500);
    }
    return Number(amount);
}

export async function recordAccountEvent({
    accountId,
    eventType,
    actorId = "SYSTEM",
    details = {},
    occurredAt = new Date(),
    session
}) {
    await getCollection("account_audit_events").insertOne({
        eventId: randomUUID(),
        accountId,
        eventType,
        actorId,
        details,
        occurredAt,
        createdAt: new Date()
    }, session ? { session } : {});
}

export async function recordBalanceSnapshot({
    accountId,
    balanceMinor,
    currency,
    eventType,
    transactionId = null,
    occurredAt = new Date(),
    session
}) {
    await getCollection("account_balance_history").insertOne({
        snapshotId: randomUUID(),
        accountId,
        balanceMinor: Long.fromBigInt(toBigInt(balanceMinor)),
        currency,
        eventType,
        transactionId,
        occurredAt,
        createdAt: new Date()
    }, session ? { session } : {});
}

export async function initializeAccountHistory(account) {
    const existing = await getCollection("account_balance_history")
        .findOne({ accountId: account.accountId });

    if (existing) return;

    await recordBalanceSnapshot({
        accountId: account.accountId,
        balanceMinor: account.balanceMinor,
        currency: account.currency,
        eventType: "BASELINE"
    });

    await recordAccountEvent({
        accountId: account.accountId,
        eventType: "HISTORY_TRACKING_STARTED",
        details: {
            message: "Initial observed balance; not the original opening balance"
        }
    });
}

export async function getAccountHistory(accountId, months = 6) {
    if (![3, 6, 12].includes(months)) {
        throw repositoryError("Invalid reporting period", 400);
    }

    const account = await getCollection("accounts").findOne({ accountId });

    if (!account) {
        throw repositoryError("Account not found", 404);
    }

    const now = new Date();
    const start = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - months + 1,
        1
    ));

    const first = await getCollection("account_balance_history")
        .findOne(
            { accountId },
            { sort: { occurredAt: 1, _id: 1 } }
        );

    const lastBefore = await getCollection("account_balance_history")
        .findOne(
            { accountId, occurredAt: { $lt: start } },
            { sort: { occurredAt: -1, _id: -1 } }
        );

    const snapshots = await getCollection("account_balance_history")
        .find({
            accountId,
            occurredAt: { $gte: start, $lte: now }
        })
        .sort({ occurredAt: 1, _id: 1 })
        .toArray();

    let current = lastBefore ?? null;
    const monthsData = [];

    for (let offset = 0; offset < months; offset++) {
        const from = new Date(Date.UTC(
            start.getUTCFullYear(),
            start.getUTCMonth() + offset,
            1
        ));

        const to = new Date(Date.UTC(
            from.getUTCFullYear(),
            from.getUTCMonth() + 1,
            1
        ));

        const relevant = snapshots.filter(snapshot =>
            snapshot.occurredAt >= from &&
            snapshot.occurredAt < to
        );

        if (relevant.length) {
            current = relevant[relevant.length - 1];
        }

        monthsData.push({
            month: from.toISOString().slice(0, 7),
            balanceMinor: current
                ? minorNumber(current.balanceMinor)
                : null,
            observedAt: current
                ? current.occurredAt.toISOString()
                : null
        });
    }

    return {
        accountId,
        currency: account.currency,
        trackingStartedAt: first?.occurredAt?.toISOString() ?? null,
        months: monthsData
    };
}

export async function getAccountAuditHistory(accountId, limit = 100) {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));

    const events = await getCollection("account_audit_events")
        .find({ accountId })
        .sort({ occurredAt: -1, _id: -1 })
        .limit(safeLimit)
        .toArray();

    return events.map(({ _id, ...event }) => ({
        ...event,
        occurredAt: event.occurredAt.toISOString()
    }));
}

export async function getAccountLastActivityMap(accountIds) {
    if (!accountIds.length) return new Map();

    const [audits, transactions] = await Promise.all([
        getCollection("account_audit_events").aggregate([
            { $match: { accountId: { $in: accountIds } } },
            { $sort: { occurredAt: -1 } },
            {
                $group: {
                    _id: "$accountId",
                    lastActivityAt: { $first: "$occurredAt" }
                }
            }
        ]).toArray(),

        getCollection("transactions").aggregate([
            {
                $match: {
                    $or: [
                        { sourceAccountId: { $in: accountIds } },
                        { destinationAccountId: { $in: accountIds } }
                    ]
                }
            },
            {
                $project: {
                    accountIds: [
                        "$sourceAccountId",
                        "$destinationAccountId"
                    ],
                    lastActivityAt: {
                        $ifNull: ["$processedAt", "$createdAt"]
                    }
                }
            },
            { $unwind: "$accountIds" },
            { $match: { accountIds: { $in: accountIds } } },
            { $sort: { lastActivityAt: -1 } },
            {
                $group: {
                    _id: "$accountIds",
                    lastActivityAt: { $first: "$lastActivityAt" }
                }
            }
        ]).toArray()
    ]);

    const result = new Map();

    for (const entry of [...audits, ...transactions]) {
        const value = new Date(entry.lastActivityAt);
        const existing = result.get(entry._id);

        if (!existing || value > existing) {
            result.set(entry._id, value);
        }
    }

    return result;
}

export async function getAccountStatementRecords(
    accountId,
    from,
    to
) {
    const account = await getCollection("accounts")
        .findOne({ accountId });

    if (!account) {
        throw repositoryError("Account not found", 404);
    }

    const transactions = await getCollection("transactions")
        .find({
            status: "Completed",
            $or: [
                { sourceAccountId: accountId },
                { destinationAccountId: accountId }
            ],
            $and: [
                {
                    $or: [
                        {
                            processedAt: {
                                $gte: from,
                                $lt: to
                            }
                        },
                        {
                            processedAt: null,
                            createdAt: {
                                $gte: from,
                                $lt: to
                            }
                        }
                    ]
                }
            ]
        })
        .sort({
            processedAt: 1,
            createdAt: 1,
            transactionId: 1
        })
        .toArray();

    return {
        account: serializeAccountDocument(account),
        from: from.toISOString(),
        to: to.toISOString(),
        entries: transactions.map(transaction => {
            const debit =
                transaction.sourceAccountId === accountId;

            const amount = minorNumber(transaction.amountMinor);

            const date =
                transaction.processedAt ??
                transaction.createdAt;

            return {
                transactionId: transaction.transactionId,
                referenceNumber: transaction.referenceNumber,
                date: new Date(date).toISOString(),
                description: transaction.description ?? "Transfer",
                direction: debit ? "Debit" : "Credit",
                amountMinor: debit ? -amount : amount,
                currency: transaction.currency
            };
        })
    };
}
