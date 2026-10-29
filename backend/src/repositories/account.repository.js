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

export async function modifyAccountBalance({
    accountId,
    expectedStatus = "Active",
    minimumBalanceMinor = 0,
    deltaMinor,
    session
}) {
    if (
        !Number.isSafeInteger(deltaMinor) ||
        !Number.isSafeInteger(minimumBalanceMinor) ||
        minimumBalanceMinor < 0
    ) {
        throw new RangeError(
            "Invalid account balance operation"
        );
    }

    if (!session?.inTransaction()) {
        throw new Error(
            "Balance changes require an active MongoDB transaction"
        );
    }

    const maximumBalanceMinor = BigInt(
        Number.MAX_SAFE_INTEGER
    );

    const delta = BigInt(deltaMinor);

    const minimum = BigInt(minimumBalanceMinor);

    const lowerBound = delta < 0n
        ? -delta > minimum
            ? -delta
            : minimum
        : minimum;

    const upperBound = delta > 0n
        ? maximumBalanceMinor - delta
        : maximumBalanceMinor;

    if (lowerBound > upperBound) {
        return false;
    }

    const filter = {
        accountId,
        status: expectedStatus,
        balanceMinor: {
            $gte: Long.fromBigInt(lowerBound),
            $lte: Long.fromBigInt(upperBound)
        }
    };

    const result = await accounts().updateOne(
        filter,
        {
            $inc: {
                balanceMinor: Long.fromBigInt(delta)
            }
        },
        { session }
    );

    return result.modifiedCount === 1;
}