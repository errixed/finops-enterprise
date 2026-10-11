import { randomUUID } from "node:crypto";
import { readJsonFile, updateJsonFile } from "./json.repository.js";

const FILE = "accounts.json";

export async function findAllAccounts() {
    return readJsonFile(FILE);
}

export async function findAccountById(accountId) {
    const accounts = await readJsonFile(FILE);

    return accounts.find(
        account => account.accountId === accountId
    ) ?? null;
}

export async function insertAccount(accountData) {
    let newAccount;

    await updateJsonFile(FILE, accounts => {
        const accountId = randomUUID();
        const accountNumber = `ACC-${randomUUID().toUpperCase()}`;

        if (
            accounts.some(account =>
                account.accountId === accountId ||
                account.accountNumber === accountNumber
            )
        ) {
            const error = new Error("Account identifier collision");
            error.statusCode = 409;
            throw error;
        }

        newAccount = {
            ...accountData,
            accountId,
            accountNumber
        };

        accounts.push(newAccount);

        return accounts;
    });

    return newAccount;
}

export async function findAccountsByClientId(clientId) {
    const accounts = await readJsonFile(FILE);

    return accounts.filter(
        account => account.clientId === clientId
    );
}