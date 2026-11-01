import { getDatabase } from "../config/mongodb.js";

export async function getDashboardStatistics() {
    const db = getDatabase();

    const clients = db.collection("clients");
    const accounts = db.collection("accounts");
    const transactions = db.collection("transactions");

    const [
        totalClients,
        activeClients,
        activeAccounts,
        totalTransactions,
        statusGroups,
        completedVolumeGroups
    ] = await Promise.all([
        clients.countDocuments(),
        clients.countDocuments({ status: "Active" }),
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