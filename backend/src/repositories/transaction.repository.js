import { readJsonFile } from "./json.repository.js";

const FILE = "transactions.json";

export async function findAllTransactions() {
    return readJsonFile(FILE);
}

export async function findTransactionById(transactionId) {
    const transactions = await readJsonFile(FILE);

    return transactions.find(
        transaction => transaction.transactionId === transactionId
    ) ?? null;
}