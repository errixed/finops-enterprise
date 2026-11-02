import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import {
    connectMongoDB,
    getDatabase,
    closeMongoDB
} from "../src/config/mongodb.js";

import {
    toClientDocument,
    serializeClientDocument
} from "../src/utils/client-document.js";

import {
    toAccountDocument,
    serializeAccountDocument
} from "../src/utils/account-document.js";

import {
    toTransactionDocument,
    serializeTransactionDocument
} from "../src/utils/transaction-document.js";

const baseDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../data/legacy"
);

const version = "assignment2_initial_migration_v1";

async function main() {
    try {
        const datasets = {};
        const hash = createHash("sha256");

        for (const name of ["clients", "accounts", "transactions"]) {
            const content = await readFile(
                path.join(baseDirectory, `${name}.json`),
                "utf8"
            );

            datasets[name] = JSON.parse(content);

            hash.update(`${name}.json`);
            hash.update(content);
        }

        await connectMongoDB();

        const db = getDatabase();

        const migration = await db
            .collection("schema_migrations")
            .findOne({ version });

        if (
            !migration ||
            migration.status !== "Completed" ||
            migration.checksum !== hash.digest("hex")
        ) {
            throw new Error(
                "Successful migration record not found or source changed"
            );
        }

        const definitions = [
            ["clients", "clientId", toClientDocument, serializeClientDocument],
            ["accounts", "accountId", toAccountDocument, serializeAccountDocument],
            [
                "transactions",
                "transactionId",
                record => toTransactionDocument({
                    ...record,
                    isLegacy: true
                }),
                serializeTransactionDocument
            ]
        ];

        for (const [name, id, convert, serialize] of definitions) {
            const collection = db.collection(name);

            for (const source of datasets[name]) {
                const expected = serialize(convert(source));

                const stored = await collection.findOne({
                    [id]: source[id]
                });

                if (!stored) {
                    throw new Error(
                        `Missing ${name}: ${source[id]}`
                    );
                }

                const actual = serialize(stored);

                if (
                    JSON.stringify(actual) !==
                    JSON.stringify(expected)
                ) {
                    throw new Error(
                        `Data mismatch: ${name}/${source[id]}`
                    );
                }
            }

            console.log(
                `${name}: ${datasets[name].length} source records verified`
            );
        }

        const clientIds = new Set(
            datasets.clients.map(client => client.clientId)
        );

        const accountMap = new Map(
            datasets.accounts.map(account => [
                account.accountId,
                account
            ])
        );

        for (const account of datasets.accounts) {
            if (!clientIds.has(account.clientId)) {
                throw new Error(
                    `Invalid client reference: ${account.accountNumber}`
                );
            }
        }

        for (const transaction of datasets.transactions) {
            const from = accountMap.get(transaction.sourceAccountId);
            const to = accountMap.get(transaction.destinationAccountId);

            if (
                !from ||
                !to ||
                from.accountId === to.accountId ||
                from.currency !== transaction.currency ||
                to.currency !== transaction.currency
            ) {
                throw new Error(
                    `Invalid transaction reference: ${transaction.referenceNumber}`
                );
            }
        }

        console.log("Client-account relationships: Passed");
        console.log("Account-transaction relationships: Passed");
        console.log("Original balances and amounts: Passed");
        console.log("Original identifiers and statuses: Passed");
        console.log("Migration verification successful.");

    } finally {
        await closeMongoDB();
    }
}

main().catch(error => {
    console.error("Verification failed:", error.message);
    process.exitCode = 1;
});