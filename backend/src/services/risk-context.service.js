import {
    findAccountById
} from "../repositories/account.repository.js";

import {
    findClientById
} from "../repositories/client.repository.js";

import {
    getRecentCompletedOutgoingActivity
} from "../repositories/transaction.repository.js";

export async function buildRiskContext({
    sourceAccountId,
    destinationAccountId,
    amountMinor,
    currency,
    periodHours = 24,
    asOf = new Date(),
    session
}) {
    if (
        !Number.isSafeInteger(amountMinor) ||
        amountMinor <= 0 ||
        !["CAD", "USD"].includes(currency)
    ) {
        throw new Error("Invalid transaction risk inputs");
    }

    const sourceAccount = await findAccountById(
        sourceAccountId,
        { session }
    );

    const destinationAccount = await findAccountById(
        destinationAccountId,
        { session }
    );

    if (!sourceAccount || !destinationAccount) {
        throw new Error("Risk assessment accounts not found");
    }

    if (
        sourceAccount.currency !== currency ||
        destinationAccount.currency !== currency
    ) {
        throw new Error("Risk assessment currency mismatch");
    }

    const sourceClient = await findClientById(
        sourceAccount.clientId,
        { session }
    );

    const destinationClient = await findClientById(
        destinationAccount.clientId,
        { session }
    );

    if (!sourceClient || !destinationClient) {
        throw new Error("Risk assessment clients not found");
    }

    const activity = await getRecentCompletedOutgoingActivity({
        sourceAccountId,
        currency,
        periodHours,
        asOf,
        session
    });

    return {
        amountMinor,
        currency,
        sourceBalanceMinor: sourceAccount.balanceMinor,
        sourceAccountStatus: sourceAccount.status,
        destinationAccountStatus: destinationAccount.status,
        sourceClientStatus: sourceClient.status,
        destinationClientStatus: destinationClient.status,
        recentTransactionCount: activity.recentTransactionCount,
        recentTransferVolumeMinor:
            activity.recentTransferVolumeMinor
    };
}