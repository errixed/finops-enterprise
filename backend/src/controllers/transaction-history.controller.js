import { getDatabase } from "../config/mongodb.js";
import {
    getTransactionDirectoryData,
    getTransactionHistoryStatistics
} from "../repositories/transaction-directory.repository.js";

const allowedStatuses = new Set([
    "Pending",
    "Processing",
    "Completed",
    "Rejected"
]);

const allowedRisk = new Set([
    "Low",
    "Medium",
    "High",
    "Critical"
]);

const allowedApprovals = new Set([
    "Pending",
    "InReview",
    "Escalated",
    "Approved",
    "Rejected",
    "Cancelled",
    "NotRequired"
]);

function validDate(value) {
    if (!value) return true;

    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
}

export async function transactionHistory(req, res, next) {
    try {
        const filters = req.query;
        const allowedKeys = new Set([
            "page",
            "pageSize",
            "search",
            "clientId",
            "accountId",
            "transactionType",
            "status",
            "riskLevel",
            "approvalStatus",
            "dateFrom",
            "dateTo"
        ]);

        for (const [key, value] of Object.entries(filters)) {
            if (!allowedKeys.has(key) || typeof value !== "string") {
                return res.status(400).json({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: `Invalid filter: ${key}`
                    }
                });
            }
        }

        if (
            !validDate(filters.dateFrom) ||
            !validDate(filters.dateTo) ||
            (filters.dateFrom && filters.dateTo &&
                filters.dateFrom > filters.dateTo) ||
            (filters.status && !allowedStatuses.has(filters.status)) ||
            (filters.riskLevel && !allowedRisk.has(filters.riskLevel)) ||
            (filters.approvalStatus &&
                !allowedApprovals.has(filters.approvalStatus))
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid transaction history filters"
                }
            });
        }

        const [directory, statistics] = await Promise.all([
            getTransactionDirectoryData(filters),
            getTransactionHistoryStatistics(filters)
        ]);

        res.json({
            ...directory,
            statistics
        });
    } catch (error) {
        next(error);
    }
}

export async function transactionDocumentHistory(req, res, next) {
    try {
        const transactionId = req.params.id;

        const exists = await getDatabase()
            .collection("transactions")
            .findOne(
                { transactionId },
                { projection: { _id: 1 } }
            );

        if (!exists) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Transaction not found"
                }
            });
        }

        const events = await getDatabase()
            .collection("transaction_document_events")
            .find({ transactionId })
            .sort({ occurredAt: 1 })
            .limit(500)
            .toArray();

        res.json({
            data: events.map(({ _id, ...event }) => ({
                ...event,
                occurredAt: new Date(event.occurredAt).toISOString()
            }))
        });
    } catch (error) {
        next(error);
    }
}