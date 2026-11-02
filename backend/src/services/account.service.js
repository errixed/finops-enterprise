import {
    findAccountById,
    insertAccount,
    filterAccounts
} from "../repositories/account.repository.js";
import {
    findClientById
} from "../repositories/client.repository.js";
import {
    findTransactionsByAccountId
} from "../repositories/transaction.repository.js";
import { validateMinorUnits } from "../utils/money.js";
import { ENUMS } from "../../config.js";

const ACCOUNT_TYPES = ENUMS.ACCOUNT_TYPES;
const CURRENCIES = ENUMS.CURRENCIES;
const STATUSES = ENUMS.ACCOUNT_STATUSES;

function fail(message, statusCode = 400, field) {
    const error = new Error(message);
    error.statusCode = statusCode;

    if (field) {
        error.details = { field };
    }

    throw error;
}

export async function createAccount(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        fail("Invalid account data");
    }

    const allowed = [
        "clientId",
        "accountType",
        "currency",
        "balanceMinor"
    ];

    for (const field of Object.keys(input)) {
        if (!allowed.includes(field)) {
            fail(`${field} cannot be supplied`, 400, field);
        }
    }

    if (typeof input.clientId !== "string" || !input.clientId.trim()) {
        fail("Client ID is required", 400, "clientId");
    }

    if (!ACCOUNT_TYPES.includes(input.accountType)) {
        fail("Unsupported account type", 400, "accountType");
    }

    if (!CURRENCIES.includes(input.currency)) {
        fail("Unsupported currency", 400, "currency");
    }

    validateMinorUnits(input.balanceMinor);

    const client = await findClientById(input.clientId);

    if (!client) {
        fail("Corporate client not found", 404, "clientId");
    }

    if (client.status !== "Active") {
        fail(
            "Financial accounts can only be created for active clients",
            409,
            "clientId"
        );
    }

    return insertAccount({
        clientId: client.clientId,
        accountType: input.accountType,
        currency: input.currency,
        balanceMinor: input.balanceMinor,
        status: "Active",
        createdAt: new Date().toISOString()
    });
}

export async function getAllAccounts({
    clientId = "",
    accountType = "",
    currency = "",
    status = ""
} = {}) {
    if (
        (clientId && typeof clientId !== "string") ||
        (accountType && !ACCOUNT_TYPES.includes(accountType)) ||
        (currency && !CURRENCIES.includes(currency)) ||
        (status && !STATUSES.includes(status))
    ) {
        fail("Invalid account filter");
    }

    const accounts = await filterAccounts({
        clientId,
        accountType,
        currency,
        status
    });

    const clientIds = [
        ...new Set(accounts.map(account => account.clientId))
    ];

    const clientEntries = await Promise.all(
        clientIds.map(async id => [
            id,
            await findClientById(id)
        ])
    );

    const clientMap = new Map(clientEntries);

    return accounts.map(account => ({
        ...account,
        companyName:
            clientMap.get(account.clientId)?.companyName ??
            "Unknown client"
    }));
}

export async function getAccountById(accountId) {
    const account = await findAccountById(accountId);

    if (!account) {
        fail("Financial account not found", 404);
    }

    const [client, transactions] = await Promise.all([
        findClientById(account.clientId),
        findTransactionsByAccountId(accountId)
    ]);

    return {
        ...account,
        companyName:
            client?.companyName ?? "Unknown client",
        clientStatus:
            client?.status ?? "Unknown",
        transactions
    };
}

export const ACCOUNT_OPTIONS = {
    accountTypes: ACCOUNT_TYPES,
    currencies: CURRENCIES,
    statuses: STATUSES
};