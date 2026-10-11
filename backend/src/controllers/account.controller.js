import {
    createAccount,
    getAllAccounts,
    getAccountById,
    ACCOUNT_OPTIONS
} from "../services/account.service.js";

export async function listAccounts(req, res, next) {
    try {
        const accounts = await getAllAccounts(req.query);
        res.status(200).json(accounts);
    } catch (error) {
        next(error);
    }
}

export async function getAccount(req, res, next) {
    try {
        const account = await getAccountById(req.params.id);
        res.status(200).json(account);
    } catch (error) {
        next(error);
    }
}

export async function registerAccount(req, res, next) {
    try {
        const account = await createAccount(req.body);
        res.status(201).json(account);
    } catch (error) {
        next(error);
    }
}

export function getAccountOptions(req, res) {
    res.status(200).json(ACCOUNT_OPTIONS);
}