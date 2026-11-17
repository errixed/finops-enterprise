import {
    getAccountReporting,
    getAccountActivityDates,
    getStatement
} from "../services/account-operations.service.js";
import {
    getAllAccounts
} from "../services/account.service.js";

export async function accountReport(req, res, next) {
    try {
        const months = Number(req.query.months ?? 6);

        const result = await getAccountReporting(
            req.params.id,
            months
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function accountsWithActivity(req, res, next) {
    try {
        const accounts = await getAllAccounts(req.query);

        const result = await getAccountActivityDates(accounts);

        res.json(result);
    } catch (error) {
        next(error);
    }
}

function csvCell(value) {
    let text = String(value ?? "");

    if (/^[=+\-@\t\r]/.test(text)) {
        text = `'${text}`;
    }

    return `"${text.replaceAll('"', '""')}"`;
}

export async function downloadAccountStatement(req, res, next) {
    try {
        const statement = await getStatement(
            req.params.id,
            req.query.from,
            req.query.to
        );

        const headers = [
            "Date",
            "Reference",
            "Description",
            "Direction",
            "Amount Minor",
            "Currency"
        ];

        const rows = statement.entries.map(entry => [
            entry.date,
            entry.referenceNumber,
            entry.description,
            entry.direction,
            entry.amountMinor,
            entry.currency
        ]);

        const csv = [
            headers,
            ...rows
        ].map(row => row.map(csvCell).join(","))
         .join("\r\n");

        res.setHeader(
            "Content-Type",
            "text/csv; charset=utf-8"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="account-${req.params.id}-statement.csv"`
        );

        res.status(200).send("\uFEFF" + csv);
    } catch (error) {
        next(error);
    }
}