import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
    connectMongoDB,
    getDatabase,
    getMongoClient,
    initializeCollections,
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
import { initializeValidators } from "./initialize-validators.js";
import { initializeIndexes } from "./initialize-indexes.js";
import {
    findMigrationByVersion,
    recordMigrationCompletion
} from "../src/repositories/migration.repository.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.resolve(directory, "../data");
const legacyDirectory = path.join(dataDirectory, "legacy");

const MIGRATION_VERSION = "assignment2_initial_migration_v1";

const definitions = [
    {
        name: "clients",
        id: "clientId",
        convert: toClientDocument,
        serialize: serializeClientDocument
    },
    {
        name: "accounts",
        id: "accountId",
        convert: toAccountDocument,
        serialize: serializeAccountDocument
    },
    {
        name: "transactions",
        id: "transactionId",
        convert: toTransactionDocument,
        serialize: serializeTransactionDocument
    }
];

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function loadSource() {
    const source = {};
    const hash = createHash("sha256");

    for (const definition of definitions) {
        const filename = `${definition.name}.json`;

        const original = await readFile(
            path.join(dataDirectory, filename),
            "utf8"
        );

        const legacy = await readFile(
            path.join(legacyDirectory, filename),
            "utf8"
        );

        assert(
            original === legacy,
            `${filename}: legacy copy differs from original`
        );

        const records = JSON.parse(legacy);

        assert(
            Array.isArray(records),
            `${filename} must contain an array`
        );

        hash.update(filename);
        hash.update(legacy);

        source[definition.name] = records;
    }

    return {
        source,
        checksum: hash.digest("hex")
    };
}

function validateSource(source) {
    const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    function unique(records, field, label, normalize = x => x) {
        const values = records.map(record => {
            const value = record[field];

            assert(
                typeof value === "string" && value.trim(),
                `${label}: invalid ${field}`
            );

            return normalize(value);
        });

        assert(
            new Set(values).size === values.length,
            `${label}: duplicate ${field}`
        );
    }

    for (const definition of definitions) {
        const records = source[definition.name];

        unique(records, definition.id, definition.name);

        for (const record of records) {
            assert(
                uuidPattern.test(record[definition.id]),
                `${definition.name}: invalid UUID`
            );
        }
    }

    unique(
        source.clients,
        "registrationNumber",
        "clients",
        value => value.trim().toUpperCase()
    );

    unique(source.accounts, "accountNumber", "accounts");

    unique(
        source.transactions,
        "referenceNumber",
        "transactions"
    );

    const clients = new Set(
        source.clients.map(record => record.clientId)
    );

    const accounts = new Map(
        source.accounts.map(record => [
            record.accountId,
            record
        ])
    );

    for (const account of source.accounts) {
        assert(
            clients.has(account.clientId),
            `Broken client relationship: ${account.accountNumber}`
        );

        assert(
            Number.isSafeInteger(account.balanceMinor) &&
            account.balanceMinor >= 0,
            `Invalid balance: ${account.accountNumber}`
        );
    }

    for (const transaction of source.transactions) {
        const from = accounts.get(transaction.sourceAccountId);
        const to = accounts.get(transaction.destinationAccountId);

        assert(
            from && to,
            `Broken account relationship: ${transaction.referenceNumber}`
        );

        assert(
            from.accountId !== to.accountId,
            `Identical transaction accounts: ${transaction.referenceNumber}`
        );

        assert(
            from.currency === transaction.currency &&
            to.currency === transaction.currency,
            `Currency mismatch: ${transaction.referenceNumber}`
        );

        assert(
            Number.isSafeInteger(transaction.amountMinor) &&
            transaction.amountMinor > 0,
            `Invalid amount: ${transaction.referenceNumber}`
        );

        assert(
            ["Pending", "Completed", "Rejected"].includes(transaction.status),
            `Invalid historical status: ${transaction.referenceNumber}`
        );
    }
}

function transform(source) {
    return {
        clients: source.clients.map(toClientDocument),

        accounts: source.accounts.map(toAccountDocument),

        transactions: source.transactions.map(record =>
            toTransactionDocument({
                ...record,
                isLegacy: true
            })
        )
    };
}

async function verifyDocuments(db, documents, session) {
    for (const definition of definitions) {
        const expected = documents[definition.name];
        const collection = db.collection(definition.name);

        for (const document of expected) {
            const stored = await collection.findOne(
                { [definition.id]: document[definition.id] },
                { session }
            );

            assert(
                stored !== null,
                `Missing ${definition.name}: ${document[definition.id]}`
            );

            const actualValue = definition.serialize(stored);
            const expectedValue = definition.serialize(document);

            assert(
                JSON.stringify(actualValue) ===
                JSON.stringify(expectedValue),
                `Data mismatch: ${definition.name}/${document[definition.id]}`
            );
        }
    }
}

async function runMigration() {
    let session;

    try {
        console.log("Validating Assignment 1 source data...");

        const { source, checksum } = await loadSource();

        // Reuse the full Assignment 1 dataset validator.
        execFileSync(
            process.execPath,
            [path.join(directory, "validate-data.js")],
            { stdio: "inherit" }
        );

        validateSource(source);

        const documents = transform(source);

        console.log("Connecting to MongoDB...");

        await connectMongoDB();

        const db = getDatabase();
        const client = getMongoClient();

        const replica = await db.admin().command({
            replSetGetStatus: 1
        });

        assert(
            replica.ok === 1 &&
            replica.members.some(
                member => member.stateStr === "PRIMARY"
            ),
            "MongoDB replica set is not ready"
        );

        await initializeCollections();
        await initializeValidators();
        await initializeIndexes();

        const migrations = db.collection("schema_migrations");

        await migrations.createIndex(
            { version: 1 },
            { unique: true }
        );

        const completed = await findMigrationByVersion(
            MIGRATION_VERSION
        );

        if (completed) {
            assert(
                completed.status === "Completed",
                "Migration record is not marked Completed"
            );

            assert(
                completed.checksum === checksum,
                "Migration conflict: source data has changed"
            );

            console.log(
                "Migration already completed. Skipping import."
            );

            return;
        }

        // Never silently merge into an unknown existing dataset.
        for (const definition of definitions) {
            const count = await db
                .collection(definition.name)
                .countDocuments();

            assert(
                count === 0,
                `Migration conflict: ${definition.name} is not empty`
            );
        }

        session = client.startSession();

        await session.withTransaction(async () => {
            // Recheck within the transaction to detect concurrent changes.
            for (const definition of definitions) {
                const count = await db
                    .collection(definition.name)
                    .countDocuments({}, { session });

                assert(
                    count === 0,
                    `Concurrent migration conflict: ${definition.name}`
                );
            }

            for (const definition of definitions) {
                const records = documents[definition.name];

                if (records.length > 0) {
                    await db
                        .collection(definition.name)
                        .insertMany(records, {
                            session,
                            ordered: true
                        });
                }
            }

            await verifyDocuments(db, documents, session);

            for (const definition of definitions) {
                const count = await db
                    .collection(definition.name)
                    .countDocuments({}, { session });

                assert(
                    count === documents[definition.name].length,
                    `Count mismatch: ${definition.name}`
                );
            }

            await recordMigrationCompletion({
                version: MIGRATION_VERSION,
                checksum,
                counts: {
                    clients: documents.clients.length,
                    accounts: documents.accounts.length,
                    transactions: documents.transactions.length
                },
                session
            });
        });

        console.log("Migration successfully completed.");
        console.log(`Clients: ${documents.clients.length}`);
        console.log(`Accounts: ${documents.accounts.length}`);
        console.log(`Transactions: ${documents.transactions.length}`);

    } finally {
        if (session) {
            await session.endSession();
        }

        await closeMongoDB();
    }
}

runMigration().catch(error => {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
});