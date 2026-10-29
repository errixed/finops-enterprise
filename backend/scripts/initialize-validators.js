import { ENUMS } from "../config.js";
import { getDatabase } from "../src/config/mongodb.js";

const UUID_PATTERN =
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$";

const EMAIL_PATTERN =
    "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

const clientValidator = {
    $jsonSchema: {
        bsonType: "object",
        required: [
            "clientId",
            "companyName",
            "registrationNumber",
            "registrationNumberNormalized",
            "industry",
            "country",
            "contactEmail",
            "status",
            "createdAt",
            "updatedAt"
        ],
        properties: {
            clientId: {
                bsonType: "string",
                pattern: UUID_PATTERN
            },
            companyName: {
                bsonType: "string",
                minLength: 2,
                maxLength: 150
            },
            registrationNumber: {
                bsonType: "string",
                minLength: 5,
                maxLength: 30
            },
            registrationNumberNormalized: {
                bsonType: "string",
                minLength: 5,
                maxLength: 30
            },
            industry: {
                enum: ENUMS.CLIENT_INDUSTRIES
            },
            country: {
                enum: ENUMS.CLIENT_COUNTRIES
            },
            contactEmail: {
                bsonType: "string",
                pattern: EMAIL_PATTERN
            },
            contactPhone: {
                bsonType: ["string", "null"]
            },
            status: {
                enum: ENUMS.CLIENT_STATUSES
            },
            createdAt: {
                bsonType: "date"
            },
            updatedAt: {
                bsonType: "date"
            }
        }
    }
};

const accountValidator = {
    $jsonSchema: {
        bsonType: "object",
        required: [
            "accountId",
            "clientId",
            "accountNumber",
            "accountType",
            "currency",
            "balanceMinor",
            "status",
            "createdAt"
        ],
        properties: {
            accountId: {
                bsonType: "string",
                pattern: UUID_PATTERN
            },
            clientId: {
                bsonType: "string",
                pattern: UUID_PATTERN
            },
            accountNumber: {
                bsonType: "string",
                minLength: 1
            },
            accountType: {
                enum: ENUMS.ACCOUNT_TYPES
            },
            currency: {
                enum: ENUMS.CURRENCIES
            },
            balanceMinor: {
                bsonType: "long",
                minimum: 0,
                maximum: MAX_SAFE_INTEGER
            },
            status: {
                enum: ENUMS.ACCOUNT_STATUSES
            },
            createdAt: {
                bsonType: "date"
            }
        }
    }
};

const transactionValidator = {
    $jsonSchema: {
        bsonType: "object",
        required: [
            "transactionId",
            "referenceNumber",
            "sourceAccountId",
            "destinationAccountId",
            "amountMinor",
            "currency",
            "transactionType",
            "status",
            "description",
            "isLegacy",
            "createdAt",
            "updatedAt",
            "processedAt"
        ],
        properties: {
            transactionId: {
                bsonType: "string",
                pattern: UUID_PATTERN
            },
            referenceNumber: {
                bsonType: "string",
                minLength: 1
            },
            idempotencyKey: {
                bsonType: "string",
                minLength: 1
            },
            requestFingerprint: {
                bsonType: "string",
                minLength: 1
            },
            sourceAccountId: {
                bsonType: "string",
                pattern: UUID_PATTERN
            },
            destinationAccountId: {
                bsonType: "string",
                pattern: UUID_PATTERN
            },
            amountMinor: {
                bsonType: "long",
                minimum: 1,
                maximum: MAX_SAFE_INTEGER
            },
            currency: {
                enum: ENUMS.CURRENCIES
            },
            transactionType: {
                enum: ENUMS.TRANSACTION_TYPES
            },
            status: {
                enum: ENUMS.TRANSACTION_STATUSES
            },
            description: {
                bsonType: "string",
                maxLength: 250
            },
            isLegacy: {
                bsonType: "bool"
            },
            rejectionCode: {
                enum: [
                    null,
                    "INSUFFICIENT_FUNDS",
                    "SOURCE_ACCOUNT_INACTIVE",
                    "DESTINATION_ACCOUNT_INACTIVE",
                    "CURRENCY_MISMATCH",
                    "ACCOUNT_NOT_FOUND",
                    "BUSINESS_RULE_VIOLATION"
                ]
            },
            rejectionReason: {
                bsonType: ["string", "null"]
            },
            createdAt: {
                bsonType: "date"
            },
            updatedAt: {
                bsonType: "date"
            },
            processedAt: {
                bsonType: ["date", "null"]
            }
        },
        oneOf: [
            {
                properties: {
                    isLegacy: { enum: [true] }
                }
            },
            {
                required: [
                    "idempotencyKey",
                    "requestFingerprint"
                ],
                properties: {
                    isLegacy: { enum: [false] }
                }
            }
        ]
    }
};

async function applyValidator(name, validator) {
    const database = getDatabase();

    const collections = await database
        .listCollections(
            { name },
            { nameOnly: true }
        )
        .toArray();

    if (collections.length === 0) {
        await database.createCollection(name, {
            validator,
            validationLevel: "strict",
            validationAction: "error"
        });
    } else {
        await database.command({
            collMod: name,
            validator,
            validationLevel: "strict",
            validationAction: "error"
        });
    }

    console.log(`Validator initialized: ${name}`);
}

export async function initializeValidators() {
    await applyValidator("clients", clientValidator);
    await applyValidator("accounts", accountValidator);
    await applyValidator("transactions", transactionValidator);

    console.log("MongoDB validators initialized.");
}