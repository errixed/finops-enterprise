import {
    getDashboardStatistics,
    getDashboardGrowthStatistics,
    findRecentTransactions,
    findRecentProcessingActivity,
    findDashboardAccounts
} from "../repositories/dashboard.repository.js";
import {
    checkDatabaseConnection,
    checkMongoPrimaryReady
} from "../repositories/mongodb.repository.js";
import {
    serializeTransactionDocument
} from "../utils/transaction-document.js";

function toSafeVolumeMinor(value) {
    const amount = typeof value?.toBigInt === "function"
        ? value.toBigInt()
        : BigInt(value ?? 0);

    if (
        amount < 0n ||
        amount > BigInt(Number.MAX_SAFE_INTEGER)
    ) {
        throw new RangeError(
            "Completed transaction volume exceeds the supported range"
        );
    }

    return Number(amount);
}

export async function getDashboardSummary() {
    const [
        statistics,
        growthStatistics,
        recentDocuments,
        activityDocuments
    ] = await Promise.all([
        getDashboardStatistics(),
        getDashboardGrowthStatistics(),
        findRecentTransactions(5),
        findRecentProcessingActivity(5)
    ]);
    const transactionStatuses = {
        Pending: 0,
        Processing: 0,
        Completed: 0,
        Rejected: 0
    };

    for (const group of statistics.statusGroups) {
        if (Object.hasOwn(transactionStatuses, group._id)) {
            transactionStatuses[group._id] = group.count;
        }
    }

    const completedVolumes = {
        CAD: 0,
        USD: 0
    };

    for (const group of statistics.completedVolumeGroups) {
        if (Object.hasOwn(completedVolumes, group._id)) {
            completedVolumes[group._id] = toSafeVolumeMinor(
                group.volumeMinor
            );
        }
    }

    const recentTransactions = recentDocuments.map(
        serializeTransactionDocument
    );

    const recentProcessingActivity = activityDocuments.map(
        serializeTransactionDocument
    );

    const accountIds = [
        ...new Set(
            [
                ...recentTransactions,
                ...recentProcessingActivity
            ].flatMap(transaction => [
                transaction.sourceAccountId,
                transaction.destinationAccountId
            ])
        )
    ];

    const relatedAccounts = await findDashboardAccounts(
        accountIds
    );

    const accountMap = new Map(
        relatedAccounts.map(account => [
            account.accountId,
            account.accountNumber
        ])
    );

    function enrichTransactions(transactions) {
        return transactions.map(transaction => ({
            ...transaction,
            sourceAccountNumber:
                accountMap.get(transaction.sourceAccountId) ?? "Unknown",
            destinationAccountNumber:
                accountMap.get(transaction.destinationAccountId) ?? "Unknown"
        }));
    }

    return {
        totalClients: statistics.totalClients,
        activeClients: statistics.activeClients,
        totalAccounts: statistics.totalAccounts,
        activeAccounts: statistics.activeAccounts,
        totalTransactions: statistics.totalTransactions,

        growthStatistics,

        pendingTransactions: transactionStatuses.Pending,
        processingTransactions: transactionStatuses.Processing,
        completedTransactions: transactionStatuses.Completed,
        rejectedTransactions: transactionStatuses.Rejected,

        transactionStatuses,
        completedVolumes,

        recentTransactions: enrichTransactions(recentTransactions),
        recentProcessingActivity: enrichTransactions(
            recentProcessingActivity
        )
    };
}

export async function checkApplicationHealth() {
    const connected = await checkDatabaseConnection();

    if (!connected) {
        const error = new Error("Database service unavailable");

        error.statusCode = 503;
        error.code = "SERVICE_UNAVAILABLE";

        throw error;
    }

    await checkMongoPrimaryReady();

    return {
        status: "ok",
        timestamp: new Date().toISOString()
    };
}