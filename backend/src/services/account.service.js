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

function validateText(value, field, maxLength, required = true) {
    if (typeof value !== "string") {
        if (!required && value === undefined) return "";
        fail(`${field} must be a string`, 400, field);
    }

    const result = value.trim();

    if (required && !result) {
        fail(`${field} is required`, 400, field);
    }

    if (result.length > maxLength) {
        fail(`${field} cannot exceed ${maxLength} characters`, 400, field);
    }

    return result;
}

function validateDate(value) {
    if (typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        fail("A valid opening date is required", 400, "openDate");
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
    ) {
        fail("Invalid opening date", 400, "openDate");
    }

    const today = new Date().toISOString().slice(0, 10);

    if (value > today) {
        fail("Opening date cannot be in the future", 400, "openDate");
    }

    return value;
}

function validateBoolean(value, field, defaultValue = false) {
    if (value === undefined) return defaultValue;

    if (typeof value !== "boolean") {
        fail(`${field} must be a boolean`, 400, field);
    }

    return value;
}

export async function createAccount(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        fail("Invalid account data");
    }

    const allowed = new Set([
        "clientId",
        "accountType",
        "accountName",
        "currency",
        "purpose",
        "status",
        "openDate",
        "balanceMinor",
        "creditLimitMinor",
        "allowTransactions",
        "allowInternationalTransactions",
        "requireDualApproval",
        "temporaryAccount",
        "notes"
    ]);

    for (const field of Object.keys(input)) {
        if (!allowed.has(field)) {
            fail(`${field} cannot be supplied`, 400, field);
        }
    }

    const clientId = validateText(input.clientId, "clientId", 100);

    if (!ACCOUNT_TYPES.includes(input.accountType)) {
        fail("Unsupported account type", 400, "accountType");
    }

    if (!CURRENCIES.includes(input.currency)) {
        fail("Unsupported currency", 400, "currency");
    }

    const accountName = validateText(
        input.accountName,
        "accountName",
        120
    );

    const purpose = validateText(
        input.purpose,
        "purpose",
        250
    );

    const openDate = validateDate(input.openDate);

    const status = input.status ?? "Active";

    if (!STATUSES.includes(status)) {
        fail("Unsupported account status", 400, "status");
    }

    try {
        validateMinorUnits(input.balanceMinor);
    } catch {
        fail("Invalid initial balance", 400, "balanceMinor");
    }

    const creditLimitMinor = input.creditLimitMinor ?? null;

    if (creditLimitMinor !== null) {
        try {
            validateMinorUnits(creditLimitMinor);
        } catch {
            fail("Invalid credit limit", 400, "creditLimitMinor");
        }
    }

    const allowTransactions = validateBoolean(
        input.allowTransactions,
        "allowTransactions",
        true
    );

    const allowInternationalTransactions = validateBoolean(
        input.allowInternationalTransactions,
        "allowInternationalTransactions",
        false
    );

    const requireDualApproval = validateBoolean(
        input.requireDualApproval,
        "requireDualApproval"
    );

    const temporaryAccount = validateBoolean(
        input.temporaryAccount,
        "temporaryAccount"
    );

    const notes = validateText(
        input.notes ?? "",
        "notes",
        500,
        false
    );

    if (!allowTransactions && allowInternationalTransactions) {
        fail(
            "International transactions require transactions to be enabled",
            400,
            "allowInternationalTransactions"
        );
    }

    const client = await findClientById(clientId);

    if (!client) {
        fail("Client not found", 404, "clientId");
    }

    if (client.status !== "Active") {
        fail(
            "Accounts can only be created for active clients",
            409,
            "clientId"
        );
    }

    if (client.clientType === "Individual") {
        fail(
            "This workflow requires a corporate client",
            409,
            "clientId"
        );
    }

    return insertAccount({
        clientId: client.clientId,
        accountType: input.accountType,
        accountName,
        currency: input.currency,
        purpose,
        status,
        openDate,
        balanceMinor: input.balanceMinor,
        initialBalanceMinor: input.balanceMinor,
        creditLimitMinor,
        outstandingCreditMinor:
            creditLimitMinor === null ? null : 0,
        allowTransactions,
        allowInternationalTransactions,
        requireDualApproval,
        temporaryAccount,
        notes,
        version: 0,
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
        companyName: client?.companyName ?? "Unknown client",
        clientStatus: client?.status ?? "Unknown",
        transactions
    };
}

export const ACCOUNT_OPTIONS = {
    accountTypes: ACCOUNT_TYPES,
    currencies: CURRENCIES,
    statuses: STATUSES
};