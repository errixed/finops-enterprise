import { Long } from "mongodb";
import { validateMinorUnits } from "./money.js";

export function toAccountDocument(account) {
    validateMinorUnits(account.balanceMinor);

    const createdAt = new Date(account.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
        throw new Error("Invalid createdAt timestamp");
    }

    return {
        ...account,
        balanceMinor: Long.fromBigInt(
            BigInt(account.balanceMinor)
        ),
        createdAt
    };
}

export function serializeAccountDocument(document) {
    if (!document) {
        return null;
    }

    const { _id, ...account } = document;

    const balance = Long.isLong(account.balanceMinor)
        ? account.balanceMinor.toBigInt()
        : typeof account.balanceMinor === "bigint"
            ? account.balanceMinor
            : BigInt(
                validateMinorUnits(account.balanceMinor)
            );

    if (
        balance < 0n ||
        balance > BigInt(Number.MAX_SAFE_INTEGER)
    ) {
        throw new RangeError(
            "Account balance exceeds the supported safe integer range"
        );
    }

    const createdAt = new Date(account.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
        throw new Error("Invalid createdAt timestamp");
    }

    return {
        ...account,
        balanceMinor: Number(balance),
        createdAt: createdAt.toISOString()
    };
}