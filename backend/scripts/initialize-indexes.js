import { getDatabase } from "../src/config/mongodb.js";

export async function initializeClientIndexes() {
    const collection = getDatabase().collection("clients");

    await collection.createIndexes([
        {
            key: { clientId: 1 },
            name: "idx_client_id_unique",
            unique: true
        },
        {
            key: { registrationNumberNormalized: 1 },
            name: "idx_registration_normalized_unique",
            unique: true
        },
        {
            key: { companyName: 1 },
            name: "idx_company_name"
        },
        {
            key: { industry: 1 },
            name: "idx_client_industry"
        },
        {
            key: { status: 1 },
            name: "idx_client_status"
        }
    ]);

    console.log("Client indexes initialized.");
}

export async function initializeAccountIndexes() {
    const collection = getDatabase().collection("accounts");

    await collection.createIndexes([
        {
            key: { accountId: 1 },
            name: "idx_account_id_unique",
            unique: true
        },
        {
            key: { accountNumber: 1 },
            name: "idx_account_number_unique",
            unique: true
        },
        {
            key: { clientId: 1 },
            name: "idx_account_client_id"
        },
        {
            key: { currency: 1 },
            name: "idx_account_currency"
        },
        {
            key: { accountType: 1 },
            name: "idx_account_type"
        },
        {
            key: { status: 1 },
            name: "idx_account_status"
        }
    ]);

    console.log("Account indexes initialized.");
}

export async function initializeTransactionIndexes() {
    const collection = getDatabase().collection("transactions");

    await collection.createIndexes([
        {
            key: { transactionId: 1 },
            name: "idx_transaction_id_unique",
            unique: true
        },
        {
            key: { referenceNumber: 1 },
            name: "idx_reference_number_unique",
            unique: true
        },
        {
            key: { idempotencyKey: 1 },
            name: "idx_idempotency_key_unique",
            unique: true,
            partialFilterExpression: {
                isLegacy: false,
                idempotencyKey: { $type: "string" }
            }
        },
        {
            key: { sourceAccountId: 1 },
            name: "idx_source_account"
        },
        {
            key: { destinationAccountId: 1 },
            name: "idx_destination_account"
        },
        {
            key: { status: 1 },
            name: "idx_transaction_status"
        },
        {
            key: { createdAt: -1 },
            name: "idx_transaction_created_at"
        }
    ]);

    console.log("Transaction indexes initialized.");
}

export async function initializeIndexes() {
    await initializeClientIndexes();
    await initializeAccountIndexes();
    await initializeTransactionIndexes();

    console.log("All MongoDB indexes initialized.");
}