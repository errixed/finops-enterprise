import {
    findTransactionById,
    searchTransactions
} from "../repositories/transaction.repository.js";
import {
    findAccountById
} from "../repositories/account.repository.js";
import { ENUMS } from "../../config.js";

const STATUSES = ENUMS.TRANSACTION_STATUSES;

function fail(message, statusCode = 400, field) {
    const error = new Error(message);
    error.statusCode = statusCode;

    if (field) {
        error.details = { field };
    }

    throw error;
}

function parseDate(value, field) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        fail(`Invalid ${field}. Expected YYYY-MM-DD`, 400, field);
    }

    const timestamp = Date.parse(`${value}T00:00:00.000Z`);

    if (
        !Number.isFinite(timestamp) ||
        new Date(timestamp).toISOString().slice(0, 10) !== value
    ) {
        fail(`Invalid ${field}`, 400, field);
    }

    return value;
}

function validateTransactions(transactions, accounts) {
    const accountMap = new Map(
        accounts.map(account => [account.accountId, account])
    );

    const ids = new Set();
    const references = new Set();

    for (const transaction of transactions) {
        const source = accountMap.get(transaction.sourceAccountId);
        const destination = accountMap.get(transaction.destinationAccountId);

        const valid =
            typeof transaction.transactionId === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transaction.transactionId) &&
            typeof transaction.referenceNumber === "string" &&
            transaction.referenceNumber.length > 0 &&
            !ids.has(transaction.transactionId) &&
            !references.has(transaction.referenceNumber) &&
            source &&
            destination &&
            source.accountId !== destination.accountId &&
            typeof source.accountId === "string" &&
            typeof destination.accountId === "string" &&
            Number.isSafeInteger(transaction.amountMinor) &&
            transaction.amountMinor > 0 &&
            ["CAD", "USD"].includes(transaction.currency) &&
            source.currency === transaction.currency &&
            destination.currency === transaction.currency &&
            transaction.transactionType === "Transfer" &&
            STATUSES.includes(transaction.status) &&
            typeof transaction.description === "string" &&
            transaction.description.length <= 250 &&
            typeof transaction.createdAt === "string" &&
            !Number.isNaN(Date.parse(transaction.createdAt)) &&
            /^\d{4}-\d{2}-\d{2}T.*Z$/.test(transaction.createdAt);

        if (!valid) {
            fail(
                `Invalid stored transaction: ${transaction.referenceNumber ?? "unknown"}`,
                500
            );
        }

        ids.add(transaction.transactionId);
        references.add(transaction.referenceNumber);
    }
}

export async function getAllTransactions({
    search = "",
    sourceAccountId = "",
    status = "",
    dateFrom = "",
    dateTo = "",
    page = 1,
    pageSize = 10
} = {}) {
    const currentPage = Number(page);
    const currentPageSize = Number(pageSize);

    if (
        !Number.isInteger(currentPage) ||
        currentPage < 1 ||
        !Number.isInteger(currentPageSize) ||
        currentPageSize < 1 ||
        currentPageSize > 100
    ) {
        fail("Invalid pagination parameters", 400);
    }

    if (
        typeof search !== "string" ||
        typeof sourceAccountId !== "string" ||
        typeof status !== "string"
    ) {
        fail("Invalid transaction filters", 400);
    }

    if (status && !STATUSES.includes(status)) {
        fail("Unsupported transaction status", 400, "status");
    }

    const from = dateFrom
        ? parseDate(dateFrom, "dateFrom")
        : "";

    const to = dateTo
        ? parseDate(dateTo, "dateTo")
        : "";

    if (from && to && from > to) {
        fail(
            "Start date cannot be after end date",
            400,
            "dateFrom"
        );
    }

    const result = await searchTransactions({
        search,
        sourceAccountId,
        status,
        dateFrom: from,
        dateTo: to,
        page: currentPage,
        pageSize: currentPageSize
    });

    const ids = [
        ...new Set(
            result.data.flatMap(transaction => [
                transaction.sourceAccountId,
                transaction.destinationAccountId
            ])
        )
    ];

    const entries = await Promise.all(
        ids.map(async id => [
            id,
            await findAccountById(id)
        ])
    );

    const accountMap = new Map(entries);

    return {
        ...result,
        data: result.data.map(transaction => ({
            ...transaction,
            sourceAccountNumber:
                accountMap.get(transaction.sourceAccountId)
                    ?.accountNumber ?? "Unknown",
            destinationAccountNumber:
                accountMap.get(transaction.destinationAccountId)
                    ?.accountNumber ?? "Unknown"
        }))
    };
}

export async function getTransactionById(transactionId) {
    const transaction = await findTransactionById(transactionId);

    if (!transaction) {
        fail("Transaction not found", 404);
    }

    const [source, destination] = await Promise.all([
        findAccountById(transaction.sourceAccountId),
        findAccountById(transaction.destinationAccountId)
    ]);

    if (!source || !destination) {
        fail("Transaction account relationship is invalid", 500);
    }

    return {
        ...transaction,
        sourceAccount: {
            accountId: source.accountId,
            accountNumber: source.accountNumber,
            clientId: source.clientId,
            currency: source.currency
        },
        destinationAccount: {
            accountId: destination.accountId,
            accountNumber: destination.accountNumber,
            clientId: destination.clientId,
            currency: destination.currency
        }
    };
}

export const TRANSACTION_STATUSES = STATUSES;