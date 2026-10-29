import {
    getDashboardStatistics,
    findRecentTransactions,
    findDashboardAccounts
} from "../repositories/dashboard.repository.js";

import {
    serializeTransactionDocument
} from "../utils/transaction-document.js";

export async function getDashboardSummary() {
    const [
        statistics,
        recentDocuments
    ] = await Promise.all([
        getDashboardStatistics(),
        findRecentTransactions(5)
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

    const recentTransactions = recentDocuments.map(
        serializeTransactionDocument
    );

    const accountIds = [
        ...new Set(
            recentTransactions.flatMap(transaction => [
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

    return {
        totalClients: statistics.totalClients,
        activeClients: statistics.activeClients,
        activeAccounts: statistics.activeAccounts,
        totalTransactions: statistics.totalTransactions,

        pendingTransactions: transactionStatuses.Pending,
        completedTransactions: transactionStatuses.Completed,
        rejectedTransactions: transactionStatuses.Rejected,

        transactionStatuses,

        recentTransactions: recentTransactions.map(transaction => ({
            ...transaction,
            sourceAccountNumber:
                accountMap.get(transaction.sourceAccountId) ?? "Unknown",
            destinationAccountNumber:
                accountMap.get(transaction.destinationAccountId) ?? "Unknown"
        }))
    };
}