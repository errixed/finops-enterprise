import { randomUUID } from "node:crypto";
import { Long } from "mongodb";

import {
    getCollection,
    handleDuplicateKey
} from "./mongodb.repository.js";

import {
    toAccountDocument,
    serializeAccountDocument
} from "../utils/account-document.js";

function accounts() {
    return getCollection("accounts");
}

export async function findAccountById(accountId, options = {}) {
    const document = await accounts().findOne(
        { accountId },
        options
    );

    return serializeAccountDocument(document);
}

export async function findAccountsByClientId(clientId) {
    const documents = await accounts()
        .find({ clientId })
        .toArray();

    return documents.map(serializeAccountDocument);
}

export async function filterAccounts({
    clientId = "",
    accountType = "",
    currency = "",
    status = ""
} = {}) {
    const filter = {};

    if (clientId) filter.clientId = clientId;
    if (accountType) filter.accountType = accountType;
    if (currency) filter.currency = currency;
    if (status) filter.status = status;

    const documents = await accounts()
        .find(filter)
        .toArray();

    return documents.map(serializeAccountDocument);
}

export async function countAccounts(filter = {}) {
    return accounts().countDocuments(filter);
}

export async function insertAccount(accountData) {
    const account = {
        ...accountData,
        accountId: randomUUID(),
        accountNumber: `ACC-${randomUUID().toUpperCase()}`
    };

    const document = toAccountDocument(account);

    try {
        await accounts().insertOne(document);
        return serializeAccountDocument(document);
    } catch (error) {
        handleDuplicateKey(
            error,
            "Account identifier collision"
        );
    }
}

export async function findAccountForProcessing(accountId, session) {
    if (!session?.inTransaction()) {
        throw new Error("An active MongoDB transaction is required");
    }

    return accounts().findOne({ accountId }, { session });
}

export async function updateProcessingBalance({
    accountId,
    expectedBalanceMinor,
    deltaMinor,
    session
}) {
    if (!session?.inTransaction()) {
        throw new Error(
            "An active MongoDB transaction is required"
        );
    }

    if (
        typeof expectedBalanceMinor !== "bigint" ||
        !Number.isSafeInteger(deltaMinor)
    ) {
        throw new RangeError(
            "Invalid account balance operation"
        );
    }

    const current = expectedBalanceMinor;
    const delta = BigInt(deltaMinor);
    const updated = current + delta;
    const maximum = BigInt(Number.MAX_SAFE_INTEGER);

    if (
        current < 0n ||
        current > maximum ||
        updated < 0n ||
        updated > maximum
    ) {
        return false;
    }

    const result = await accounts().updateOne(
        {
            accountId,
            status: "Active",
            balanceMinor: Long.fromBigInt(current)
        },
        {
            $inc: {
                balanceMinor: Long.fromBigInt(delta)
            }
        },
        { session }
    );

    return result.modifiedCount === 1;
}