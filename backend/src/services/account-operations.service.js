
import {
    findAccountById
} from "../repositories/account.repository.js";

import {
    initializeAccountHistory,
    getAccountHistory,
    getAccountAuditHistory,
    getAccountLastActivityMap,
    getAccountStatementRecords
} from "../repositories/account-operations.repository.js";

function fail(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
}

export async function getAccountFinancialReport(accountId) {
    const account = await findAccountById(accountId);

    if (!account) {
        fail("Account not found", 404);
    }

    const creditLimitMinor = account.creditLimitMinor ?? null;
    const outstandingCreditMinor = account.outstandingCreditMinor ?? null;

    if (
        creditLimitMinor !== null &&
        (!Number.isSafeInteger(creditLimitMinor) || creditLimitMinor < 0)
    ) {
        fail("Invalid stored credit limit", 500);
    }

    if (
        outstandingCreditMinor !== null &&
        (!Number.isSafeInteger(outstandingCreditMinor) ||
            outstandingCreditMinor < 0)
    ) {
        fail("Invalid stored outstanding credit", 500);
    }

    const hasCreditFacility = creditLimitMinor !== null;

    const hasUsageData =
        hasCreditFacility && outstandingCreditMinor !== null;

    const availableLimitMinor = hasUsageData
        ? Math.max(0, creditLimitMinor - outstandingCreditMinor)
        : null;

    const utilizationPercent =
        hasUsageData && creditLimitMinor > 0
            ? Number(
                (
                    outstandingCreditMinor /
                    creditLimitMinor * 100
                ).toFixed(2)
            )
            : null;

    return {
        accountId,
        currency: account.currency,
        status: account.status,
        balanceMinor: account.balanceMinor,
        creditLimitMinor,
        outstandingCreditMinor,
        availableLimitMinor,
        utilizationPercent
    };
}

export async function getAccountReporting(accountId, months = 6) {
    const account = await findAccountById(accountId);

    if (!account) {
        fail("Account not found", 404);
    }

    const [history, audit, financial] = await Promise.all([
        getAccountHistory(accountId, months),
        getAccountAuditHistory(accountId, 100),
        getAccountFinancialReport(accountId)
    ]);

    return {
        history,
        audit,
        financial
    };
}

export async function getAccountActivityDates(accounts) {
    const map = await getAccountLastActivityMap(
        accounts.map(account => account.accountId)
    );

    return accounts.map(account => ({
        ...account,
        lastActivityAt:
            map.get(account.accountId)?.toISOString() ??
            account.updatedAt ??
            account.createdAt
    }));
}

export async function getStatement(accountId, dateFrom, dateTo) {
    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom ?? "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dateTo ?? "")
    ) {
        fail("Valid from and to dates are required");
    }

    const from = new Date(`${dateFrom}T00:00:00.000Z`);
    const to = new Date(`${dateTo}T00:00:00.000Z`);

    if (
        Number.isNaN(from.getTime()) ||
        Number.isNaN(to.getTime()) ||
        from > to
    ) {
        fail("Invalid statement date range");
    }

    const endExclusive = new Date(
        to.getTime() + 86400000
    );

    if (
        endExclusive.getTime() - from.getTime() >
        366 * 86400000
    ) {
        fail("Statements are limited to one year");
    }

    return getAccountStatementRecords(
        accountId,
        from,
        endExclusive
    );
}

export { initializeAccountHistory };
