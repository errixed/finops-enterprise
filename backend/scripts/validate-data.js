import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.resolve(__dirname, "../data");

function validate(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function loadDataset(fileName) {
    const filePath = path.join(dataDirectory, fileName);
    const content = await readFile(filePath, "utf8");
    const records = JSON.parse(content);

    validate(
        Array.isArray(records),
        `${fileName} must contain a JSON array`
    );

    validate(
        records.every(record =>
            record !== null &&
            typeof record === "object" &&
            !Array.isArray(record)
        ),
        `${fileName} must contain objects`
    );

    return records;
}

function validateUnique(records, field, entity) {
    const values = records.map(record => record[field]);

    validate(
        values.every(value =>
            typeof value === "string" && value.trim().length > 0
        ),
        `${entity}: missing or invalid ${field}`
    );

    validate(
        new Set(values).size === values.length,
        `${entity}: duplicate ${field}`
    );
}

function validateUUID(value, field) {
    validate(
        typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
        `Invalid ${field}: ${value}`
    );
}

function validateTimestamp(value, field) {
    validate(
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) &&
        !Number.isNaN(Date.parse(value)),
        `Invalid UTC timestamp for ${field}`
    );
}

async function main() {
    const [clients, accounts, transactions] = await Promise.all([
        loadDataset("clients.json"),
        loadDataset("accounts.json"),
        loadDataset("transactions.json")
    ]);

    validate(clients.length >= 10, "At least 10 clients required");
    validate(accounts.length >= 20, "At least 20 accounts required");
    validate(transactions.length >= 50, "At least 50 transactions required");

    validateUnique(clients, "clientId", "Clients");
    validateUnique(clients, "registrationNumber", "Clients");
    validateUnique(accounts, "accountId", "Accounts");
    validateUnique(accounts, "accountNumber", "Accounts");
    validateUnique(transactions, "transactionId", "Transactions");
    validateUnique(transactions, "referenceNumber", "Transactions");

    const registrationNumbers = clients.map(client =>
        client.registrationNumber.trim().toLowerCase()
    );

    validate(
        new Set(registrationNumbers).size === registrationNumbers.length,
        "Duplicate normalized client registration numbers"
    );

    const industries = new Set(clients.map(client => client.industry));

    validate(
        industries.size >= 5,
        "At least five industries are required"
    );

    const inactiveClients = clients.filter(client =>
        ["Inactive", "Suspended"].includes(client.status)
    );

    validate(
        inactiveClients.length >= 2,
        "At least two inactive or suspended clients are required"
    );

    const restrictedAccounts = accounts.filter(account =>
        ["Frozen", "Closed"].includes(account.status)
    );

    validate(
        restrictedAccounts.length >= 2,
        "At least two frozen or closed accounts are required"
    );

    const clientIds = new Set();

    for (const client of clients) {
        validateUUID(client.clientId, "clientId");

        validate(
            typeof client.companyName === "string" &&
            client.companyName.trim().length >= 2 &&
            client.companyName.trim().length <= 150,
            `Invalid company name for ${client.clientId}`
        );

        validate(
            typeof client.registrationNumber === "string" &&
            client.registrationNumber.trim().length >= 5 &&
            client.registrationNumber.trim().length <= 30,
            `Invalid registration number for ${client.clientId}`
        );

        validate(
            ["Canada", "United States"].includes(client.country),
            `Invalid country for ${client.clientId}`
        );

        validate(
            ["Active", "Inactive", "Suspended"].includes(client.status),
            `Invalid client status for ${client.clientId}`
        );

        validate(
            typeof client.contactEmail === "string" &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.contactEmail),
            `Invalid email for ${client.clientId}`
        );

        validate(
            client.contactPhone === undefined ||
            client.contactPhone === null ||
            (
                typeof client.contactPhone === "string" &&
                client.contactPhone.length <= 30
            ),
            `Invalid phone for ${client.clientId}`
        );

        validateTimestamp(client.createdAt, "client.createdAt");
        validateTimestamp(client.updatedAt, "client.updatedAt");

        clientIds.add(client.clientId);
    }

    const accountMap = new Map();
    const accountCounts = new Map();

    for (const account of accounts) {
        validateUUID(account.accountId, "accountId");
        validateUUID(account.clientId, "account.clientId");

        validate(
            clientIds.has(account.clientId),
            `Account ${account.accountNumber} references a missing client`
        );

        validate(
            ["Operating", "Savings", "Investment"].includes(account.accountType),
            `Invalid account type: ${account.accountNumber}`
        );

        validate(
            ["CAD", "USD"].includes(account.currency),
            `Invalid currency: ${account.accountNumber}`
        );

        validate(
            Number.isSafeInteger(account.balanceMinor) &&
            account.balanceMinor >= 0,
            `Invalid balance: ${account.accountNumber}`
        );

        validate(
            ["Active", "Frozen", "Closed"].includes(account.status),
            `Invalid account status: ${account.accountNumber}`
        );

        validateTimestamp(account.createdAt, "account.createdAt");

        accountMap.set(account.accountId, account);

        accountCounts.set(
            account.clientId,
            (accountCounts.get(account.clientId) ?? 0) + 1
        );
    }

    validate(
        accounts.some(account => account.currency === "CAD") &&
        accounts.some(account => account.currency === "USD"),
        "Accounts must include both CAD and USD"
    );

    validate(
        [...accountCounts.values()].some(count => count >= 2),
        "At least one client must have multiple accounts"
    );

    validate(
        new Set(accounts.map(account => account.balanceMinor)).size >= 2,
        "Accounts must have different balances"
    );

    const statuses = new Set();
    const amounts = [];

    for (const transaction of transactions) {
        validateUUID(transaction.transactionId, "transactionId");
        validateUUID(transaction.sourceAccountId, "sourceAccountId");
        validateUUID(transaction.destinationAccountId, "destinationAccountId");

        const source = accountMap.get(transaction.sourceAccountId);
        const destination = accountMap.get(transaction.destinationAccountId);

        validate(
            source && destination,
            `Missing account for transaction ${transaction.referenceNumber}`
        );

        validate(
            source.accountId !== destination.accountId,
            `Identical source and destination: ${transaction.referenceNumber}`
        );

        validate(
            source.currency === transaction.currency &&
            destination.currency === transaction.currency,
            `Currency mismatch: ${transaction.referenceNumber}`
        );

        validate(
            Number.isSafeInteger(transaction.amountMinor) &&
            transaction.amountMinor > 0,
            `Invalid transaction amount: ${transaction.referenceNumber}`
        );

        validate(
            transaction.transactionType === "Transfer",
            `Invalid transaction type: ${transaction.referenceNumber}`
        );

        validate(
            ["Pending", "Completed", "Rejected"].includes(transaction.status),
            `Invalid transaction status: ${transaction.referenceNumber}`
        );

        validate(
            typeof transaction.description === "string" &&
            transaction.description.length <= 250,
            `Invalid description: ${transaction.referenceNumber}`
        );

        validateTimestamp(transaction.createdAt, "transaction.createdAt");

        statuses.add(transaction.status);
        amounts.push(transaction.amountMinor);
    }

    for (const status of ["Pending", "Completed", "Rejected"]) {
        validate(
            statuses.has(status),
            `Missing transaction status: ${status}`
        );
    }

    validate(
        amounts.some(amount => amount <= 100000) &&
        amounts.some(amount => amount >= 10000000),
        "Transactions must include both low-value and high-value transfers"
    );

    console.log("Dataset validation passed.");
    console.log(`Corporate clients: ${clients.length}`);
    console.log(`Industries: ${industries.size}`);
    console.log(`Inactive/Suspended clients: ${inactiveClients.length}`);
    console.log(`Financial accounts: ${accounts.length}`);
    console.log(`Frozen/Closed accounts: ${restrictedAccounts.length}`);
    console.log(`Transactions: ${transactions.length}`);

    for (const status of ["Pending", "Completed", "Rejected"]) {
        console.log(
            `${status} transactions: ${transactions.filter(t => t.status === status).length
            }`
        );
    }

    console.log("Referential integrity: Passed");
    console.log("Unique identifiers: Passed");
    console.log("Currency consistency: Passed");
}

main().catch(error => {
    console.error(`Dataset validation failed: ${error.message}`);
    process.exitCode = 1;
});
