import { getDatabase } from "../config/mongodb.js";

export async function getDashboardStatistics() {
    const db = getDatabase();

    const clients = db.collection("clients");
    const accounts = db.collection("accounts");
    const transactions = db.collection("transactions");

    const [
        totalClients,
        activeClients,
        totalAccounts,
        activeAccounts,
        totalTransactions,
        statusGroups,
        completedVolumeGroups
    ] = await Promise.all([
        clients.countDocuments(),
        clients.countDocuments({ status: "Active" }),
        accounts.countDocuments(),
        accounts.countDocuments({ status: "Active" }),
        transactions.countDocuments(),
        transactions.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]).toArray(),
        transactions.aggregate([
            {
                $match: {
                    status: "Completed",
                    transactionType: "Transfer",
                    currency: { $in: ["CAD", "USD"] }
                }
            },
            {
                $group: {
                    _id: "$currency",
                    volumeMinor: { $sum: "$amountMinor" }
                }
            }
        ]).toArray()
    ]);

    return {
        totalClients,
        activeClients,
        totalAccounts,
        activeAccounts,
        totalTransactions,
        statusGroups,
        completedVolumeGroups
    };
}

export async function findRecentTransactions(limit = 5) {
    const db = getDatabase();

    return db.collection("transactions")
        .find({})
        .sort({
            createdAt: -1,
            transactionId: 1
        })
        .limit(limit)
        .toArray();
}

export async function findRecentProcessingActivity(limit = 5) {
    const db = getDatabase();

    return db.collection("transactions")
        .find({})
        .sort({
            updatedAt: -1,
            transactionId: 1
        })
        .limit(limit)
        .toArray();
}

export async function findDashboardAccounts(accountIds) {
    if (accountIds.length === 0) {
        return [];
    }

    const db = getDatabase();

    return db.collection("accounts")
        .find(
            {
                accountId: {
                    $in: accountIds
                }
            },
            {
                projection: {
                    _id: 0,
                    accountId: 1,
                    accountNumber: 1
                }
            }
        )
        .toArray();
}

export async function getDashboardGrowthStatistics() {
    const db = getDatabase();

    const now = new Date();

    const monthStart = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        1
    ));

    const weekStart = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
    ));

    const daysSinceMonday = (weekStart.getUTCDay() + 6) % 7;

    weekStart.setUTCDate(
        weekStart.getUTCDate() - daysSinceMonday
    );

    const [
        newClientsThisMonth,
        newAccountsThisMonth,
        completedTransactionsThisWeek
    ] = await Promise.all([
        db.collection("clients").countDocuments({
            createdAt: {
                $gte: monthStart,
                $lte: now
            }
        }),

        db.collection("accounts").countDocuments({
            createdAt: {
                $gte: monthStart,
                $lte: now
            }
        }),

        db.collection("transactions").countDocuments({
            status: "Completed",
            processedAt: {
                $gte: weekStart,
                $lte: now
            }
        })
    ]);

    return {
        newClientsThisMonth,
        newAccountsThisMonth,
        completedTransactionsThisWeek
    };
}
