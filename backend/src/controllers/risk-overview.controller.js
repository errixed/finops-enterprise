import { getDatabase } from "../config/mongodb.js";

const LEVELS = ["Low", "Medium", "High", "Critical"];

const AMOUNT_BANDS = [
    { label: "≤ 100,000", min: 0, max: 10000000 },
    { label: "100,001 – 500,000", min: 10000000, max: 50000000 },
    { label: "500,001 – 1,000,000", min: 50000000, max: 100000000 },
    { label: "> 1,000,000", min: 100000000, max: null }
];

function toMinorNumber(value) {
    if (value == null) return 0;
    if (typeof value.toNumber === "function") return value.toNumber();
    return Number(value);
}

function amountBand(value) {
    const amount = toMinorNumber(value);

    if (amount <= AMOUNT_BANDS[0].max) return 0;
    if (amount <= AMOUNT_BANDS[1].max) return 1;
    if (amount <= AMOUNT_BANDS[2].max) return 2;
    return 3;
}

function dateKey(value) {
    return new Date(value).toISOString().slice(0, 10);
}

export async function getRiskOverview(req, res, next) {
    try {
        const db = getDatabase();
        const now = new Date();
        const start = new Date(now);

        start.setUTCDate(start.getUTCDate() - 29);
        start.setUTCHours(0, 0, 0, 0);

        const [assessments, transactions, workflows] = await Promise.all([
            db.collection("risk_assessments")
                .find({})
                .sort({ assessedAt: -1 })
                .toArray(),
            db.collection("transactions")
                .find({})
                .toArray(),
            db.collection("approval_workflows")
                .find({})
                .toArray()
        ]);

        const sourceIds = [
            ...new Set(transactions.map(t => t.sourceAccountId).filter(Boolean))
        ];

        const accounts = sourceIds.length
            ? await db.collection("accounts")
                .find({ accountId: { $in: sourceIds } })
                .project({
                    _id: 0,
                    accountId: 1,
                    clientId: 1
                })
                .toArray()
            : [];

        const clientIds = [
            ...new Set(accounts.map(a => a.clientId).filter(Boolean))
        ];

        const clients = clientIds.length
            ? await db.collection("clients")
                .find({ clientId: { $in: clientIds } })
                .project({
                    _id: 0,
                    clientId: 1,
                    companyName: 1
                })
                .toArray()
            : [];

        const transactionMap = new Map(
            transactions.map(t => [t.transactionId, t])
        );

        const accountMap = new Map(
            accounts.map(a => [a.accountId, a])
        );

        const clientMap = new Map(
            clients.map(c => [c.clientId, c])
        );

        const workflowMap = new Map();

        for (const workflow of workflows) {
            const previous = workflowMap.get(workflow.transactionId);

            if (
                !previous ||
                new Date(workflow.createdAt) > new Date(previous.createdAt)
            ) {
                workflowMap.set(workflow.transactionId, workflow);
            }
        }

        const latestAssessmentMap = new Map();

        for (const assessment of assessments) {
            if (!latestAssessmentMap.has(assessment.transactionId)) {
                latestAssessmentMap.set(assessment.transactionId, assessment);
            }
        }

        const latestAssessments = [...latestAssessmentMap.values()];

        const counts = {
            Low: 0,
            Medium: 0,
            High: 0,
            Critical: 0
        };

        const riskFactors = new Map();
        const heatMap = AMOUNT_BANDS.map((band, index) => ({
            label: band.label,
            index,
            counts: {
                Low: 0,
                Medium: 0,
                High: 0,
                Critical: 0
            }
        }));

        for (const assessment of latestAssessments) {
            if (LEVELS.includes(assessment.riskLevel)) {
                counts[assessment.riskLevel]++;
            }

            const transaction = transactionMap.get(assessment.transactionId);

            if (transaction && LEVELS.includes(assessment.riskLevel)) {
                heatMap[amountBand(transaction.amountMinor)]
                    .counts[assessment.riskLevel]++;
            }

            for (const rule of assessment.triggeredRules ?? []) {
                const key = rule.ruleId;
                const existing = riskFactors.get(key);

                if (existing) {
                    existing.count++;
                } else {
                    riskFactors.set(key, {
                        ruleId: key,
                        label: rule.reason || key,
                        count: 1
                    });
                }
            }
        }

        const trendMap = new Map();

        for (const assessment of assessments) {
            const date = new Date(assessment.assessedAt);

            if (date < start || date > now) continue;

            const key = dateKey(date);
            const previous = trendMap.get(key) ?? {
                sum: 0,
                count: 0
            };

            previous.sum += assessment.riskScore;
            previous.count++;

            trendMap.set(key, previous);
        }

        const trend = [];

        for (let index = 0; index < 30; index++) {
            const date = new Date(start);
            date.setUTCDate(start.getUTCDate() + index);

            const key = dateKey(date);
            const record = trendMap.get(key);

            trend.push({
                date: key,
                score: record
                    ? Number((record.sum / record.count).toFixed(1))
                    : null,
                count: record?.count ?? 0
            });
        }

        const highRiskTransactions = latestAssessments
            .filter(a => ["High", "Critical"].includes(a.riskLevel))
            .map(assessment => {
                const transaction = transactionMap.get(
                    assessment.transactionId
                );

                if (!transaction) return null;

                const account = accountMap.get(
                    transaction.sourceAccountId
                );

                const client = clientMap.get(account?.clientId);
                const workflow = workflowMap.get(transaction.transactionId);

                return {
                    transactionId: transaction.transactionId,
                    referenceNumber: transaction.referenceNumber ??
                        transaction.transactionId,
                    clientName: client?.companyName ?? "Unknown client",
                    amountMinor: String(transaction.amountMinor ?? 0),
                    currency: transaction.currency,
                    riskLevel: assessment.riskLevel,
                    riskScore: assessment.riskScore,
                    status: transaction.status,
                    approvalStatus: workflow?.status ??
                        transaction.approvalStatus ?? null,
                    assessedAt: new Date(
                        assessment.assessedAt
                    ).toISOString(),
                    createdAt: new Date(
                        transaction.createdAt
                    ).toISOString()
                };
            })
            .filter(Boolean)
            .sort((a, b) =>
                b.riskScore - a.riskScore ||
                new Date(b.assessedAt) - new Date(a.assessedAt)
            )
            .slice(0, 5);

        const alerts = latestAssessments
            .filter(a => ["High", "Critical"].includes(a.riskLevel))
            .flatMap(assessment =>
                (assessment.triggeredRules ?? []).map(rule => ({
                    id: `${assessment.assessmentId}:${rule.ruleId}`,
                    assessmentId: assessment.assessmentId,
                    transactionId: assessment.transactionId,
                    label: rule.reason || rule.ruleId,
                    ruleId: rule.ruleId,
                    riskLevel: assessment.riskLevel,
                    occurredAt: new Date(
                        assessment.assessedAt
                    ).toISOString()
                }))
            )
            .sort((a, b) =>
                new Date(b.occurredAt) - new Date(a.occurredAt)
            )
            .slice(0, 5);

        const inReview = workflows.filter(w =>
            ["Pending", "InReview", "Escalated"].includes(w.status)
        ).length;

        const blocked = transactions.filter(t =>
            t.status === "Rejected"
        ).length;

        const cleared = transactions.filter(t =>
            t.status === "Completed"
        ).length;

        const total = latestAssessments.length;
        const highCritical = counts.High + counts.Critical;

        const overallRiskExposure = total
            ? Math.round(
                latestAssessments.reduce(
                    (sum, a) => sum + a.riskScore, 0
                ) / total
            )
            : null;

        const topFactors = [...riskFactors.values()]
            .sort((a, b) =>
                b.count - a.count ||
                a.ruleId.localeCompare(b.ruleId)
            )
            .slice(0, 5);

        res.json({
            generatedAt: now.toISOString(),
            summary: {
                overallRiskExposure,
                totalAssessments: total,
                highCritical,
                highCriticalPercentage: total
                    ? highCritical / total * 100
                    : 0,
                inReview,
                blocked,
                cleared,
                totalTransactions: transactions.length
            },
            distribution: counts,
            trend,
            topFactors,
            heatMap,
            highRiskTransactions,
            alerts
        });
    } catch (error) {
        next(error);
    }
}