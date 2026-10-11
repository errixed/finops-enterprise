
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = __dirname;

export const PORT = Number(process.env.PORT) || 3000;

export const FRONTEND_ORIGIN =
    process.env.FRONTEND_ORIGIN || "http://localhost:3001";

export const PATHS = Object.freeze({
    DATA_DIR: path.join(ROOT_DIR, "data"),
    CLIENTS_FILE: path.join(ROOT_DIR, "data", "clients.json"),
    ACCOUNTS_FILE: path.join(ROOT_DIR, "data", "accounts.json"),
    TRANSACTIONS_FILE: path.join(ROOT_DIR, "data", "transactions.json")
});

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
        "Completed",
        "Rejected"
    ]
});
