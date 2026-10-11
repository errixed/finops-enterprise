import { findAllClients } from "../repositories/client.repository.js";
import { findAllAccounts } from "../repositories/account.repository.js";
import { findAllTransactions } from "../repositories/transaction.repository.js";

export async function getDashboardSummary() {
    const [clients, accounts, transactions] = await Promise.all([
        findAllClients(),
        findAllAccounts(),
        findAllTransactions()
    ]);

    const transactionStatuses = {
        Pending: 0,
        Completed: 0,
        Rejected: 0
    };

    for (const transaction of transactions) {
        if (Object.hasOwn(transactionStatuses, transaction.status)) {
            transactionStatuses[transaction.status]++;
        }
    }

    const recentTransactions = [...transactions]
        .sort((a, b) => {
            const difference =
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime();

            return difference ||
                a.transactionId.localeCompare(b.transactionId);
        })
        .slice(0, 5);

    const accountMap = new Map(
        accounts.map(account => [
            account.accountId,
            account.accountNumber
        ])
    );

    return {
        totalClients: clients.length,
        activeClients: clients.filter(
            client => client.status === "Active"
        ).length,
        activeAccounts: accounts.filter(
            account => account.status === "Active"
        ).length,
        totalTransactions: transactions.length,
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