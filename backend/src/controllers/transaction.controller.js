import {
    getAllTransactions,
    getTransactionById,
    initiateTransaction
} from "../services/transaction.service.js";
import {
    processTransaction
} from "../services/transaction-processing.service.js";

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

export async function createTransaction(req, res, next) {
    try {
        const result = await initiateTransaction(
            req.body,
            req.get("Idempotency-Key")
        );

        if (result.created) {
            res.location(
                `/api/v1/transactions/${result.transaction.transactionId}`
            );
        }

        res.status(result.created ? 201 : 200).json({
            data: result.transaction
        });
    } catch (error) {
        next(error);
    }
}

export async function processTransactionRequest(req, res, next) {
    try {
        if (
            req.body &&
            Object.keys(req.body).length > 0
        ) {
            const error = new Error(
                "Transaction processing does not accept a request body"
            );

            error.statusCode = 400;
            error.code = "INVALID_REQUEST_BODY";

            throw error;
        }

        const transaction = await processTransaction(
            req.params.id
        );

        res.status(200).json({
            data: transaction
        });
    } catch (error) {
        next(error);
    }
}