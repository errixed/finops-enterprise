import { Long } from "mongodb";
import { getMongoClient } from "../config/mongodb.js";

import {
    findTransactionForProcessing,
    updateTransactionStatus,
    findTransactionById
} from "../repositories/transaction.repository.js";

import {
    findAccountForProcessing,
    updateProcessingBalance
} from "../repositories/account.repository.js";

import {
    isEligibleForProcessing,
    TRANSACTION_REJECTION_CODES
} from "../utils/transaction-lifecycle.js";

const MAX_BALANCE = BigInt(Number.MAX_SAFE_INTEGER);

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function processingError(
    message,
    statusCode = 409,
    code = "TRANSACTION_NOT_ELIGIBLE"
) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
}

function asBigInt(value) {
    if (Long.isLong(value)) {
        return value.toBigInt();
    }

    if (typeof value === "bigint") {
        return value;
    }

    if (Number.isSafeInteger(value)) {
        return BigInt(value);
    }

    throw new RangeError("Invalid monetary value");
}

function asBalance(value) {
    const balance = asBigInt(value);

    if (balance < 0n || balance > MAX_BALANCE) {
        throw new RangeError("Invalid stored account balance");
    }

    return balance;
}

function asAmount(value) {
    return asBigInt(value);
}

async function changeStatus({
    transactionId,
    expectedStatus,
    status,
    session,
    rejectionCode = null,
    rejectionReason = null
}) {
    const changed = await updateTransactionStatus({
        transactionId,
        expectedStatus,
        status,
        rejectionCode,
        rejectionReason,
        processedAt:
            status === "Completed" || status === "Rejected"
                ? new Date()
                : null,
        session
    });

    if (!changed) {
        throw processingError(
            "Transaction status changed during processing",
            409,
            "TRANSACTION_STATE_CONFLICT"
        );
    }
}

async function rejectTransaction(
    transactionId,
    code,
    reason,
    session
) {
    if (
        !Object.values(TRANSACTION_REJECTION_CODES).includes(code)
    ) {
        throw new Error("Invalid transaction rejection code");
    }

    if (
        typeof reason !== "string" ||
        !reason.trim()
    ) {
        throw new Error(
            "Transaction rejection reason is required"
        );
    }

    await changeStatus({
        transactionId,
        expectedStatus: "Processing",
        status: "Rejected",
        rejectionCode: code,
        rejectionReason: reason,
        session
    });

    return "Rejected";
}

async function executeTransfer(transactionId, session) {
    const transaction = await findTransactionForProcessing(
        transactionId,
        session
    );

    if (!transaction) {
        throw processingError(
            "Transaction not found",
            404,
            "TRANSACTION_NOT_FOUND"
        );
    }

    if (!isEligibleForProcessing(transaction)) {
        throw processingError(
            "The transaction is not eligible for processing",
            409,
            "TRANSACTION_ALREADY_PROCESSED"
        );
    }

    await changeStatus({
        transactionId,
        expectedStatus: "Pending",
        status: "Processing",
        session
    });

    const source = await findAccountForProcessing(
        transaction.sourceAccountId,
        session
    );

    const destination = await findAccountForProcessing(
        transaction.destinationAccountId,
        session
    );

    if (!source || !destination) {
        return rejectTransaction(
            transactionId,
            TRANSACTION_REJECTION_CODES.ACCOUNT_NOT_FOUND,
            "Source or destination account no longer exists",
            session
        );
    }

    if (source.accountId === destination.accountId) {
        return rejectTransaction(
            transactionId,
            TRANSACTION_REJECTION_CODES.BUSINESS_RULE_VIOLATION,
            "Source and destination must be different accounts",
            session
        );
    }

    if (source.status !== "Active") {
        return rejectTransaction(
            transactionId,
            TRANSACTION_REJECTION_CODES.SOURCE_ACCOUNT_INACTIVE,
            "Source account is not Active",
            session
        );
    }

    if (destination.status !== "Active") {
        return rejectTransaction(
            transactionId,
            TRANSACTION_REJECTION_CODES.DESTINATION_ACCOUNT_INACTIVE,
            "Destination account is not Active",
            session
        );
    }

    if (
        source.currency !== destination.currency ||
        transaction.currency !== source.currency
    ) {
        return rejectTransaction(
            transactionId,
            TRANSACTION_REJECTION_CODES.CURRENCY_MISMATCH,
            "Transaction and account currencies do not match",
            session
        );
    }

    const amount = asAmount(transaction.amountMinor);
    const sourceBefore = asBalance(source.balanceMinor);
    const destinationBefore = asBalance(destination.balanceMinor);

    if (amount <= 0n || amount > MAX_BALANCE) {
        return rejectTransaction(
            transactionId,
            TRANSACTION_REJECTION_CODES.BUSINESS_RULE_VIOLATION,
            "Transfer amount must be a positive safe integer",
            session
        );
    }

    if (sourceBefore < amount) {
        return rejectTransaction(
            transactionId,
            TRANSACTION_REJECTION_CODES.INSUFFICIENT_FUNDS,
            "Source account has insufficient funds",
            session
        );
    }

    if (destinationBefore + amount > MAX_BALANCE) {
        return rejectTransaction(
            transactionId,
            TRANSACTION_REJECTION_CODES.BUSINESS_RULE_VIOLATION,
            "Destination account balance would exceed the supported range",
            session
        );
    }

    const sourceAfter = sourceBefore - amount;
    const destinationAfter = destinationBefore + amount;

    if (
        sourceBefore + destinationBefore !==
        sourceAfter + destinationAfter
    ) {
        throw new Error(
            "Financial balance conservation check failed"
        );
    }

    const debited = await updateProcessingBalance({
        accountId: source.accountId,
        expectedBalanceMinor: sourceBefore,
        deltaMinor: -Number(amount),
        session
    });

    if (!debited) {
        throw processingError(
            "Source account changed during processing",
            409,
            "ACCOUNT_STATE_CONFLICT"
        );
    }

    const credited = await updateProcessingBalance({
        accountId: destination.accountId,
        expectedBalanceMinor: destinationBefore,
        deltaMinor: Number(amount),
        session
    });

    if (!credited) {
        throw processingError(
            "Destination account changed during processing",
            409,
            "ACCOUNT_STATE_CONFLICT"
        );
    }

    await changeStatus({
        transactionId,
        expectedStatus: "Processing",
        status: "Completed",
        session
    });

    return "Completed";
}

export async function processTransaction(transactionId) {
    if (
        typeof transactionId !== "string" ||
        !UUID_PATTERN.test(transactionId)
    ) {
        throw processingError(
            "Invalid transaction ID",
            400,
            "INVALID_TRANSACTION_ID"
        );
    }

    const session = getMongoClient().startSession();

    try {
        const outcome = await session.withTransaction(
            () => executeTransfer(transactionId, session),
            {
                readConcern: {
                    level: "snapshot"
                },
                writeConcern: {
                    w: "majority"
                },
                readPreference: "primary"
            }
        );

        if (
            outcome !== "Completed" &&
            outcome !== "Rejected"
        ) {
            throw new Error(
                "Transaction processing returned an invalid outcome"
            );
        }

        const transaction = await findTransactionById(
            transactionId
        );

        if (
            !transaction ||
            transaction.status !== outcome
        ) {
            throw new Error(
                "Committed transaction outcome could not be verified"
            );
        }

        return transaction;
    } finally {
        await session.endSession();
    }
}