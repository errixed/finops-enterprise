import express from "express";
import { getDatabase } from "../config/mongodb.js";

const router = express.Router();

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function invalid(message) {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
}

router.get("/", async (req, res, next) => {
    try {
        const type = String(req.query.type ?? "");
        const search = String(req.query.q ?? "").trim();

        if (
            !["assessments", "transactions", "actors", "rules"].includes(type) ||
            search.length > 100
        ) {
            invalid("Invalid lookup parameters");
        }

        const db = getDatabase();
        const pattern = new RegExp(escapeRegex(search), "i");

        if (type === "assessments") {
            const query = search
                ? {
                    $or: [
                        { assessmentId: pattern },
                        { transactionId: pattern }
                    ]
                }
                : {};

            const rows = await db.collection("risk_assessments")
                .find(query)
                .sort({ assessedAt: -1 })
                .limit(40)
                .toArray();

            return res.json(rows.map(row => ({
                assessmentId: row.assessmentId,
                transactionId: row.transactionId,
                riskScore: row.riskScore,
                riskLevel: row.riskLevel,
                assessedAt: row.assessedAt,
                triggeredRules: row.triggeredRules ?? []
            })));
        }

        if (type === "transactions") {
            const query = search
                ? {
                    $or: [
                        { transactionId: pattern },
                        { referenceNumber: pattern },
                        { sourceAccountId: pattern },
                        { destinationAccountId: pattern }
                    ]
                }
                : {};

            const rows = await db.collection("transactions")
                .find(query)
                .sort({ createdAt: -1 })
                .limit(40)
                .toArray();

            return res.json(rows.map(row => ({
                transactionId: row.transactionId,
                sourceAccountId: row.sourceAccountId,
                destinationAccountId: row.destinationAccountId,
                amountMinor: row.amountMinor ?? null,
                amount: row.amount ?? null,
                currency: row.currency ?? "",
                createdAt: row.createdAt,
                referenceNumber: row.referenceNumber ?? ""
            })));
        }

        if (type === "actors") {
            const rows = await db.collection("workflow_actors")
                .find({})
                .limit(100)
                .toArray();

            return res.json(rows
                .map(row => ({
                    actorId: row.actorId,
                    name: row.name ??
                        row.displayName ??
                        row.actorName ??
                        row.actorId,
                    role: row.role ?? ""
                }))
                .filter(row =>
                    !search ||
                    pattern.test(row.actorId) ||
                    pattern.test(row.name)
                ));
        }

        const policies = await db.collection("risk_policies")
            .find({ status: "Active" })
            .sort({ version: -1 })
            .limit(10)
            .toArray();

        const rules = new Map();

        for (const policy of policies) {
            for (const rule of policy.rules ?? []) {
                if (!rules.has(rule.ruleId)) {
                    rules.set(rule.ruleId, {
                        ruleId: rule.ruleId,
                        name: rule.name ?? rule.ruleId
                    });
                }
            }
        }

        return res.json([...rules.values()]
            .filter(rule =>
                !search ||
                pattern.test(rule.ruleId) ||
                pattern.test(rule.name)
            ));
    } catch (error) {
        next(error);
    }
});

export default router;