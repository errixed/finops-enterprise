import {
    getAllTransactions,
    getTransactionById
} from "../services/transaction.service.js";

export async function listTransactions(req, res, next) {
    try {
        const result = await getAllTransactions(req.query);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

export async function getTransaction(req, res, next) {
    try {
        const transaction = await getTransactionById(req.params.id);
        res.status(200).json(transaction);
    } catch (error) {
        next(error);
    }
}