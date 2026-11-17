import {
    getTransactionDirectoryData
} from "../repositories/transaction-directory.repository.js";

const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];
const APPROVAL_STATUSES = [
    "Pending",
    "InReview",
    "Escalated",
    "Approved",
    "Rejected",
    "Cancelled"
];

const TRANSACTION_STATUSES = [
    "Pending",
    "Processing",
    "Completed",
    "Rejected"
];

function validateDate(value) {
    if (!value) return true;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
}

export async function transactionDirectory(req, res, next) {
    try {
        const filters = req.query;

        const invalid = (
            !validateDate(filters.dateFrom) ||
            !validateDate(filters.dateTo) ||
            (
                filters.dateFrom &&
                filters.dateTo &&
                filters.dateFrom > filters.dateTo
            ) ||
            (
                filters.status &&
                !TRANSACTION_STATUSES.includes(filters.status)
            ) ||
            (
                filters.riskLevel &&
                !RISK_LEVELS.includes(filters.riskLevel)
            ) ||
            (
                filters.approvalStatus &&
                !APPROVAL_STATUSES.includes(filters.approvalStatus)
            )
        );

        if (invalid) {
            return res.status(400).json({
                error: {
                    message: "Invalid transaction directory filters"
                }
            });
        }

        for (const [key, value] of Object.entries(filters)) {
            if (
                !["page", "pageSize"].includes(key) &&
                typeof value !== "string"
            ) {
                return res.status(400).json({
                    error: {
                        message: `Invalid ${key} filter`
                    }
                });
            }
        }

        const result = await getTransactionDirectoryData(filters);

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}