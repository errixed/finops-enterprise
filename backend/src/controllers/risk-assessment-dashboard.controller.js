import { getDatabase } from "../config/mongodb.js";
import { DEFAULT_RISK_RULES } from "../services/risk-assessment.service.js";

const LEVELS = ["Low", "Medium", "High", "Critical"];

const RULE_NAMES = {
    "RISK-001": "Transaction Amount Threshold",
    "RISK-002": "Recent Transfer Volume",
    "RISK-003": "Recent Transfer Volume Threshold",
    "RISK-004": "Transaction Frequency",
    "RISK-005": "Source Account Balance",
    "RISK-006": "Balance Utilization",
    "RISK-007": "Account Status Risk",
    "RISK-008": "Client Status Risk"
};

function serializeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function moneyValue(value) {
    if (value == null) return "0";
    return value.toString();
}

export async function getRiskAssessmentDashboard(req, res, next) {
    try {
        const page = Number(req.query.page ?? 1);
        const pageSize = Number(req.query.pageSize ?? 10);
        const search = String(req.query.search ?? "").trim();

        if (
            !Number.isInteger(page) ||
            page < 1 ||
            !Number.isInteger(pageSize) ||
            pageSize < 1 ||
            pageSize > 100 ||
            search.length > 150
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid dashboard parameters"
                }
            });
        }

        const db = getDatabase();

        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        start.setUTCDate(start.getUTCDate() - 29);

        const assessments = await db.collection("risk_assessments")
            .find({})
            .sort({ assessedAt: -1, assessmentId: -1 })
            .toArray();

        const latestByTransaction = new Map();

        for (const assessment of assessments) {
            if (!latestByTransaction.has(assessment.transactionId)) {
                latestByTransaction.set(assessment.transactionId, assessment);
            }
        }

        const latest = [...latestByTransaction.values()];

        const transactionIds = latest.map(item => item.transactionId);

        const [transactions, workflows] = await Promise.all([
            db.collection("transactions")
                .find({ transactionId: { $in: transactionIds } })
                .toArray(),
            db.collection("approval_workflows")
                .find({ transactionId: { $in: transactionIds } })
                .toArray()
        ]);

        const transactionMap = new Map(
            transactions.map(item => [item.transactionId, item])
        );

        const workflowMap = new Map();

        for (const workflow of workflows) {
            const existing = workflowMap.get(workflow.transactionId);

            if (
                !existing ||
                new Date(workflow.createdAt) > new Date(existing.createdAt)
            ) {
                workflowMap.set(workflow.transactionId, workflow);
            }
        }

        const accountIds = [...new Set(
            transactions.map(item => item.sourceAccountId).filter(Boolean)
        )];

        const accounts = await db.collection("accounts")
            .find({ accountId: { $in: accountIds } })
            .project({
                _id: 0,
                accountId: 1,
                clientId: 1
            })
            .toArray();

        const accountMap = new Map(
            accounts.map(item => [item.accountId, item])
        );

        const clientIds = [...new Set(
            accounts.map(item => item.clientId).filter(Boolean)
        )];

        const clients = await db.collection("clients")
            .find({ clientId: { $in: clientIds } })
            .project({
                _id: 0,
                clientId: 1,
                companyName: 1
            })
            .toArray();

        const clientMap = new Map(
            clients.map(item => [item.clientId, item])
        );

        const rows = latest.map(assessment => {
            const transaction = transactionMap.get(assessment.transactionId);
            const account = accountMap.get(transaction?.sourceAccountId);
            const client = clientMap.get(account?.clientId);
            const workflow = workflowMap.get(assessment.transactionId);

            return {
                assessmentId: assessment.assessmentId,
                transactionId: assessment.transactionId,
                referenceNumber: transaction?.referenceNumber ??
                    assessment.transactionId,
                clientId: account?.clientId ?? null,
                clientName: client?.companyName ?? "Client unavailable",
                amountMinor: moneyValue(transaction?.amountMinor),
                currency: transaction?.currency ?? "CAD",
                transactionType: transaction?.transactionType ?? "Transfer",
                transactionStatus: transaction?.status ?? "Unknown",
                riskScore: assessment.riskScore,
                riskLevel: assessment.riskLevel,
                approvalRequired: assessment.approvalRequired,
                approvalStatus: workflow?.status ??
                    transaction?.approvalStatus ?? null,
                policyId: assessment.policyId,
                policyVersion: assessment.policyVersion,
                assessedAt: serializeDate(assessment.assessedAt),
                createdAt: serializeDate(transaction?.createdAt),
                triggeredRules: assessment.triggeredRules ?? []
            };
        });

        const filtered = search
            ? rows.filter(row =>
                [
                    row.referenceNumber,
                    row.transactionId,
                    row.clientName,
                    row.clientId,
                    row.amountMinor
                ].some(value =>
                    String(value ?? "").toLowerCase()
                        .includes(search.toLowerCase())
                )
            )
            : rows;

        const recent = rows.filter(row =>
            row.assessedAt &&
            new Date(row.assessedAt) >= start
        );

        const highCritical = recent.filter(row =>
            ["High", "Critical"].includes(row.riskLevel)
        ).length;

        const inReview = recent.filter(row =>
            ["Pending", "InReview", "Escalated"]
                .includes(row.approvalStatus)
        ).length;

        const completed = recent.filter(row =>
            row.transactionStatus === "Completed"
        ).length;

        const averageScore = recent.length
            ? Math.round(
                recent.reduce(
                    (sum, row) => sum + row.riskScore,
                    0
                ) / recent.length
            )
            : null;

        const offset = (page - 1) * pageSize;

        res.json({
            data: filtered.slice(offset, offset + pageSize),
            pagination: {
                page,
                pageSize,
                total: filtered.length,
                totalPages: Math.ceil(filtered.length / pageSize)
            },
            statistics: {
                assessments: recent.length,
                highCritical,
                inReview,
                completed,
                averageScore
            },
            rules: DEFAULT_RISK_RULES.map(rule => ({
                ruleId: rule.ruleId,
                name: RULE_NAMES[rule.ruleId] ?? rule.ruleId,
                points: rule.points
            }))
        });
    } catch (error) {
        next(error);
    }
}