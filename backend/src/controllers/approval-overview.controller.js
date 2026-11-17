import { getDatabase } from "../config/mongodb.js";

const ACTIVE = ["Pending", "InReview", "Escalated"];
const FINAL = ["Approved", "Rejected"];
const PERIODS = [7, 30, 90];

function utcDate(value) {
    return new Date(value).toISOString().slice(0, 10);
}

function startOfDay(value) {
    const date = new Date(value);
    date.setUTCHours(0, 0, 0, 0);
    return date;
}

function shiftDays(value, days) {
    const date = new Date(value);
    date.setUTCDate(date.getUTCDate() + days);
    return date;
}

function percentageChange(current, previous) {
    if (previous === 0) return null;

    return Number(
        ((current - previous) / previous * 100).toFixed(1)
    );
}

function outcomeDate(workflow) {
    if (!FINAL.includes(workflow.status)) return null;

    const last = workflow.updatedAt ??
        workflow.completedAt ??
        workflow.createdAt;

    const date = new Date(last);

    return Number.isNaN(date.getTime()) ? null : date;
}

function workflowRisk(workflow, transaction) {
    return workflow.riskLevel ??
        transaction?.riskLevel ??
        "Unknown";
}

function meanHours(items) {
    const durations = items
        .map(item => {
            const start = new Date(item.createdAt);
            const end = outcomeDate(item);

            if (!end || Number.isNaN(start.getTime())) {
                return null;
            }

            const hours = (end - start) / 3600000;

            return hours >= 0 ? hours : null;
        })
        .filter(value => value !== null);

    if (!durations.length) return null;

    return Number((
        durations.reduce((sum, value) => sum + value, 0) /
        durations.length
    ).toFixed(1));
}

export async function getApprovalOverview(req, res, next) {
    try {
        const days = Number(req.query.days ?? 30);
        const filter = String(req.query.workflow ?? "all");

        if (
            !PERIODS.includes(days) ||
            !["all", "Pending", "InReview", "Escalated",
                "Approved", "Rejected", "Cancelled"].includes(filter)
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid approval overview filters"
                }
            });
        }

        const today = startOfDay(new Date());
        const endExclusive = shiftDays(today, 1);
        const start = shiftDays(today, -(days - 1));
        const previousStart = shiftDays(start, -days);

        const db = getDatabase();

        const workflows = await db.collection("approval_workflows")
            .find({})
            .toArray();

        const transactionIds = [...new Set(
            workflows.map(item => item.transactionId).filter(Boolean)
        )];

        const transactions = transactionIds.length
            ? await db.collection("transactions")
                .find({ transactionId: { $in: transactionIds } })
                .project({
                    _id: 0,
                    transactionId: 1,
                    amountMinor: 1,
                    currency: 1,
                    riskLevel: 1,
                    sourceAccountId: 1
                })
                .toArray()
            : [];

        const transactionMap = new Map(
            transactions.map(item => [item.transactionId, item])
        );

        const accountIds = [...new Set(
            transactions
                .map(item => item.sourceAccountId)
                .filter(Boolean)
        )];

        const accounts = accountIds.length
            ? await db.collection("accounts")
                .find({ accountId: { $in: accountIds } })
                .project({ accountId: 1, clientId: 1 })
                .toArray()
            : [];

        const accountMap = new Map(
            accounts.map(item => [item.accountId, item])
        );

        const clientIds = [...new Set(
            accounts.map(item => item.clientId).filter(Boolean)
        )];

        const clients = clientIds.length
            ? await db.collection("clients")
                .find({ clientId: { $in: clientIds } })
                .project({
                    clientId: 1,
                    companyName: 1,
                    clientName: 1
                })
                .toArray()
            : [];

        const clientMap = new Map(
            clients.map(item => [item.clientId, item])
        );

        const included = workflows.filter(item =>
            filter === "all" || item.status === filter
        );

        const current = included.filter(item =>
            new Date(item.createdAt) >= start &&
            new Date(item.createdAt) < endExclusive
        );

        const previous = included.filter(item =>
            new Date(item.createdAt) >= previousStart &&
            new Date(item.createdAt) < start
        );

        const endedCurrent = included.filter(item => {
            const ended = outcomeDate(item);
            return ended && ended >= start && ended < endExclusive;
        });

        const endedPrevious = included.filter(item => {
            const ended = outcomeDate(item);
            return ended && ended >= previousStart && ended < start;
        });

        const pending = included.filter(item =>
            ACTIVE.includes(item.status) &&
            new Date(item.createdAt) < endExclusive
        );

        const previousPending = included.filter(item =>
            ACTIVE.includes(item.status) &&
            new Date(item.createdAt) < start
        );

        const approved = endedCurrent.filter(item =>
            item.status === "Approved"
        );

        const rejected = endedCurrent.filter(item =>
            item.status === "Rejected"
        );

        const previousApproved = endedPrevious.filter(item =>
            item.status === "Approved"
        );

        const previousRejected = endedPrevious.filter(item =>
            item.status === "Rejected"
        );

        const averageHours = meanHours(endedCurrent);
        const previousAverageHours = meanHours(endedPrevious);

        const trend = Array.from({ length: days }, (_, index) => {
            const date = shiftDays(start, index);

            return {
                day: utcDate(date),
                Approved: 0,
                Pending: 0,
                Rejected: 0
            };
        });

        const trendMap = new Map(
            trend.map(item => [item.day, item])
        );

        for (const workflow of current) {
            if (!ACTIVE.includes(workflow.status)) continue;

            const day = utcDate(workflow.createdAt);
            const row = trendMap.get(day);

            if (row) row.Pending++;
        }

        for (const workflow of endedCurrent) {
            const ended = outcomeDate(workflow);
            const row = trendMap.get(utcDate(ended));

            if (row && FINAL.includes(workflow.status)) {
                row[workflow.status]++;
            }
        }

        const riskCounts = new Map();

        for (const workflow of current) {
            const risk = workflowRisk(
                workflow,
                transactionMap.get(workflow.transactionId)
            );

            riskCounts.set(risk, (riskCounts.get(risk) ?? 0) + 1);
        }

        const byWorkflow = [...riskCounts.entries()]
            .map(([name, count]) => ({
                name,
                count,
                percent: current.length
                    ? Number((count / current.length * 100).toFixed(1))
                    : 0
            }))
            .sort((a, b) => b.count - a.count);

        const decisionRows = await db.collection("approval_decisions")
            .find({
                decidedAt: {
                    $gte: start,
                    $lt: endExclusive
                }
            })
            .sort({ decidedAt: -1, decisionId: -1 })
            .limit(100)
            .toArray();

        const workflowById = new Map(
            workflows.map(item => [item.workflowId, item])
        );

        const recentDecisions = decisionRows
            .filter(item =>
                FINAL.includes(item.decision) &&
                workflowById.has(item.workflowId)
            )
            .slice(0, 5)
            .map(item => {
                const workflow = workflowById.get(item.workflowId);
                const transaction = transactionMap.get(
                    item.transactionId
                );
                const account = accountMap.get(
                    transaction?.sourceAccountId
                );
                const client = clientMap.get(account?.clientId);

                return {
                    decisionId: item.decisionId,
                    workflowId: item.workflowId,
                    transactionId: item.transactionId,
                    decision: item.decision,
                    actorId: item.actorId,
                    actorRole: item.actorRole,
                    decidedAt: item.decidedAt,
                    riskLevel: workflowRisk(workflow, transaction),
                    clientId: client?.clientId ?? null,
                    clientName: client?.companyName ??
                        client?.clientName ?? null,
                    amountMinor: transaction?.amountMinor ?? null,
                    currency: transaction?.currency ?? null
                };
            });

        const criticalPending = pending.filter(item =>
            workflowRisk(
                item,
                transactionMap.get(item.transactionId)
            ) === "Critical"
        ).length;

        const highPending = pending.filter(item =>
            workflowRisk(
                item,
                transactionMap.get(item.transactionId)
            ) === "High"
        ).length;

        res.json({
            period: {
                days,
                start: utcDate(start),
                end: utcDate(today)
            },
            filter,
            metrics: {
                pending: pending.length,
                approved: approved.length,
                rejected: rejected.length,
                averageDecisionHours: averageHours,
                changes: {
                    pending: null,
                    approved: percentageChange(
                        approved.length,
                        previousApproved.length
                    ),
                    rejected: percentageChange(
                        rejected.length,
                        previousRejected.length
                    ),
                    averageDecisionHours:
                        averageHours !== null &&
                            previousAverageHours !== null
                            ? percentageChange(
                                averageHours,
                                previousAverageHours
                            )
                            : null
                }
            },
            pendingRisk: {
                critical: criticalPending,
                high: highPending
            },
            trend,
            byWorkflow,
            recentDecisions
        });
    } catch (error) {
        next(error);
    }
}