import "dotenv/config";

export const PORT = Number(process.env.PORT) || 3000;

export const FRONTEND_ORIGIN =
    process.env.FRONTEND_ORIGIN || "http://localhost:3001";

export const MONGODB_URI =
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/finops_enterprise?replicaSet=rs0";

export const MONGODB_DB_NAME =
    process.env.MONGODB_DB_NAME || "finops_enterprise";

export const ENUMS = Object.freeze({
    CLIENT_INDUSTRIES: [
        "Manufacturing",
        "Construction",
        "Transportation",
        "Technology",
        "Financial Services",
        "Retail",
        "Wholesale Distribution",
        "Healthcare",
        "Energy"
    ],

    CLIENT_COUNTRIES: [
        "Canada",
        "United States"
    ],

    CLIENT_STATUSES: [
        "Active",
        "Inactive",
        "Suspended"
    ],

    ACCOUNT_TYPES: [
        "Operating",
        "Savings",
        "Investment"
    ],

    CURRENCIES: [
        "CAD",
        "USD"
    ],

    ACCOUNT_STATUSES: [
        "Active",
        "Frozen",
        "Closed"
    ],

    TRANSACTION_TYPES: [
        "Transfer"
    ],

    TRANSACTION_STATUSES: [
        "Pending",
        "Processing",
        "Completed",
        "Rejected"
    ]
});