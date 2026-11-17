import { getDatabase } from "../config/mongodb.js";

const LEVELS = ["Low", "Medium", "High", "Critical"];
const REVIEW = ["Pending", "InReview", "Escalated"];

function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
}

function getStatus(transaction, workflow) {
    if (transaction?.status === "Rejected" ||
        workflow?.status === "Rejected") {
        return "Blocked";
    }

    if (transaction?.status === "Completed") {
        return "Resolved";
    }

    if (workflow && REVIEW.includes(workflow.status)) {
        return "In Review";
    }

    if (workflow?.status === "Approved") {
        return "Approved";
    }

    return "Open";
}

function iso(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getWindow(period, now) {
    const days = period === "7" ? 7
        : period === "90" ? 90
        : period === "365" ? 365
        : period === "all" ? null : 30;

    if (days === null) return null;

    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    return start;
}

export async function getRiskAlerts(req, res, next) {
    try {
        const {
            riskLevel = "",
            ruleId = "",
            status = "",
            clientId = "",
            period = "30",
            page = "1",
            pageSize = "10"
        } = req.query;

        const params = [
            riskLevel, ruleId, status, clientId, period, page, pageSize
        ];

        const allowedKeys = new Set([
            "riskLevel", "ruleId", "status", "clientId",
            "period", "page", "pageSize"
        ]);

        if (
            Object.keys(req.query).some(key => !allowedKeys.has(key)) ||
            params.some(value => typeof value !== "string") ||
            (riskLevel && !LEVELS.includes(riskLevel)) ||
            (status && !["Open", "In Review", "Approved", "Blocked", "Resolved"].includes(status)) ||
            !["7", "30", "90", "365", "all"].includes(period) ||
            !/^[1-9]\d*$/.test(page) ||
            !/^[1-9]\d*$/.test(pageSize) ||
            Number(pageSize) > 100
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid risk alert filters"
                }
            });
        }

        const now = new Date();
        const windowStart = getWindow(period, now);
        const db = getDatabase();

        const assessmentMatch = windowStart
            ? { assessedAt: { $gte: windowStart } }
            : {};

        const assessments = await db.collection("risk_assessments")
            .find(assessmentMatch)
            .sort({ assessedAt: -1, assessmentId: -1 })
            .toArray();

        const transactionIds = [...new Set(
            assessments.map(a => a.transactionId).filter(Boolean)
        )];

        const [transactions, workflows] = await Promise.all([
            db.collection("transactions")
                .find({ transactionId: { $in: transactionIds } })
                .toArray(),
            db.collection("approval_workflows")
                .find({ transactionId: { $in: transactionIds } })
                .toArray()
        ]);

        const transactionMap = new Map(
            transactions.map(t => [t.transactionId, t])
        );

        const workflowMap = new Map();

        for (const workflow of workflows) {
            const previous = workflowMap.get(workflow.transactionId);
            if (!previous ||
                new Date(workflow.createdAt) > new Date(previous.createdAt)) {
                workflowMap.set(workflow.transactionId, workflow);
            }
        }

        const accountIds = [...new Set(
            transactions.map(t => t.sourceAccountId).filter(Boolean)
        )];

        const accounts = await db.collection("accounts")
            .find({ accountId: { $in: accountIds } })
            .project({ _id: 0, accountId: 1, clientId: 1 })
            .toArray();

        const accountMap = new Map(
            accounts.map(a => [a.accountId, a])
        );

        const clientIds = [...new Set(
            accounts.map(a => a.clientId).filter(Boolean)
        )];

        const clients = await db.collection("clients")
            .find({ clientId: { $in: clientIds } })
            .project({ _id: 0, clientId: 1, companyName: 1 })
            .toArray();

        const clientMap = new Map(
            clients.map(c => [c.clientId, c])
        );

        const latest = new Map();

        for (const assessment of assessments) {
            if (!latest.has(assessment.transactionId)) {
                latest.set(assessment.transactionId, assessment);
            }
        }

        const alerts = [];

        for (const assessment of latest.values()) {
            const transaction = transactionMap.get(assessment.transactionId);
            const workflow = workflowMap.get(assessment.transactionId);
            const account = accountMap.get(transaction?.sourceAccountId);
            const client = clientMap.get(account?.clientId);
            const alertStatus = getStatus(transaction, workflow);

            for (const [index, rule] of (assessment.triggeredRules ?? []).entries()) {
                alerts.push({
                    alertId: `${assessment.assessmentId}:${rule.ruleId}:${index}`,
                    assessmentId: assessment.assessmentId,
                    transactionId: assessment.transactionId,
                    referenceNumber: transaction?.referenceNumber ??
                        assessment.transactionId,
                    clientId: account?.clientId ?? null,
                    clientName: client?.companyName ?? "Client unavailable",
                    ruleId: rule.ruleId,
                    description: rule.reason || rule.ruleId,
                    riskLevel: assessment.riskLevel,
                    riskScore: assessment.riskScore,
                    status: alertStatus,
                    assessedAt: iso(assessment.assessedAt),
                    amountMinor: String(transaction?.amountMinor ?? 0),
                    currency: transaction?.currency ?? null
                });
            }
        }

        const inPeriod = alerts.filter(alert =>
            alert.assessedAt !== null
        );

        const filtered = inPeriod.filter(alert =>
            (!riskLevel || alert.riskLevel === riskLevel) &&
            (!ruleId || alert.ruleId === ruleId) &&
            (!status || alert.status === status) &&
            (!clientId || alert.clientId === clientId)
        );

        filtered.sort((a, b) =>
            b.assessedAt.localeCompare(a.assessedAt) ||
            a.alertId.localeCompare(b.alertId)
        );

        const total = filtered.length;
        const offset = (Number(page) - 1) * Number(pageSize);

        const ruleCounts = new Map();

        for (const alert of filtered) {
            const record = ruleCounts.get(alert.ruleId) ?? {
                ruleId: alert.ruleId,
                ruleName: alert.description,
                count: 0
            };
            record.count++;
            ruleCounts.set(alert.ruleId, record);
        }

        const rules = [...ruleCounts.values()].sort(
            (a, b) => b.count - a.count ||
                a.ruleId.localeCompare(b.ruleId)
        );

        const trendStart = new Date(now);
        trendStart.setUTCHours(0, 0, 0, 0);
        trendStart.setUTCDate(trendStart.getUTCDate() - 29);

        const daily = new Map();

        for (const alert of filtered) {
            const date = alert.assessedAt.slice(0, 10);

            if (alert.assessedAt < trendStart.toISOString()) continue;

            const record = daily.get(date) ?? {
                Low: 0, Medium: 0, High: 0, Critical: 0
            };

            record[alert.riskLevel]++;
            daily.set(date, record);
        }

        const trend = Array.from({ length: 30 }, (_, index) => {
            const date = new Date(trendStart);
            date.setUTCDate(date.getUTCDate() + index);

            const key = date.toISOString().slice(0, 10);
            return {
                date: key,
                ...(daily.get(key) ?? {
                    Low: 0, Medium: 0, High: 0, Critical: 0
                })
            };
        });

        const active = filtered.filter(a =>
            ["Open", "In Review", "Approved"].includes(a.status)
        ).length;

        const review = filtered.filter(a => a.status === "In Review").length;
        const blocked = filtered.filter(a => a.status === "Blocked").length;
        const resolved = filtered.filter(a => a.status === "Resolved").length;

        res.json({
            data: filtered.slice(offset, offset + Number(pageSize)),
            pagination: {
                page: Number(page),
                pageSize: Number(pageSize),
                total,
                totalPages: Math.ceil(total / Number(pageSize))
            },
            summary: {
                active,
                inReview: review,
                blocked,
                resolved,
                total
            },
            rules,
            trend,
            ruleOptions: [...new Set(
                alerts.map(a => a.ruleId)
            )].sort()
        });
    } catch (error) {
        next(error);
    }
}