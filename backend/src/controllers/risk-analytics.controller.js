import { getDatabase } from "../config/mongodb.js";

const LEVELS = ["Low", "Medium", "High", "Critical"];

const RULE_NAMES = {
    "RISK-001": "Transfer Amount ≥ 10,000",
    "RISK-002": "Transfer Amount ≥ 50,000",
    "RISK-003": "Transfer Amount ≥ 100,000",
    "RISK-004": "Recent Transaction Frequency",
    "RISK-005": "Recent Outgoing Transfer Volume",
    "RISK-006": "Source Balance Utilization",
    "RISK-007": "Source Client Status",
    "RISK-008": "Destination Client Status"
};

function emptyCounts() {
    return { Low: 0, Medium: 0, High: 0, Critical: 0 };
}

function addCount(counts, level) {
    if (LEVELS.includes(level)) counts[level]++;
}

function total(counts) {
    return LEVELS.reduce((sum, level) => sum + counts[level], 0);
}

function average(rows) {
    return rows.length
        ? Number((
            rows.reduce((sum, row) => sum + row.riskScore, 0) /
            rows.length
        ).toFixed(1))
        : null;
}

function difference(current, previous) {
    return previous > 0
        ? Number((((current - previous) / previous) * 100).toFixed(1))
        : null;
}

function utcDay(date) {
    return new Date(date).toISOString().slice(0, 10);
}

function daysBefore(day, count) {
    const date = new Date(`${day}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - count);
    return utcDay(date);
}

function validDay(value) {
    if (typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) &&
        utcDay(date) === value;
}

function riskGroup(level) {
    return ["High", "Critical"].includes(level);
}

export async function getRiskAnalytics(req, res, next) {
    try {
        const period = String(req.query.period ?? "30");
        const policy = String(req.query.policy ?? "all");

        if (!["7", "30", "90"].includes(period) ||
            policy.length > 150 ||
            Object.keys(req.query).some(
                key => !["period", "policy"].includes(key)
            )) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid analytics filters"
                }
            });
        }

        const countDays = Number(period);
        const today = utcDay(new Date());
        const endExclusive = daysBefore(today, -1);
        const startDay = daysBefore(today, countDays - 1);
        const previousStart = daysBefore(startDay, countDays);

        const start = new Date(`${startDay}T00:00:00.000Z`);
        const end = new Date(`${endExclusive}T00:00:00.000Z`);
        const earlier = new Date(
            `${previousStart}T00:00:00.000Z`
        );

        if (!validDay(startDay)) {
            throw new Error("Invalid reporting date");
        }

        const db = getDatabase();

        const [assessments, policies] = await Promise.all([
            db.collection("risk_assessments")
                .find({
                    assessedAt: {
                        $gte: earlier,
                        $lt: end
                    }
                })
                .sort({
                    assessedAt: -1,
                    assessmentId: -1
                })
                .toArray(),
            db.collection("risk_policies")
                .find({})
                .project({
                    _id: 1,
                    policyId: 1,
                    version: 1,
                    status: 1,
                    currency: 1,
                    rules: 1
                })
                .sort({ policyId: 1, version: -1 })
                .toArray()
        ]);

        const policyOptions = policies.map(item => ({
            key: `${item.policyId}:${item.version}`,
            label: `${item.policyId} v${item.version} (${item.status})`,
            policyId: item.policyId,
            version: item.version,
            status: item.status,
            currency: item.currency
        }));

        if (
            policy !== "all" &&
            !policyOptions.some(option => option.key === policy)
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Unknown policy version"
                }
            });
        }

        const filtered = assessments.filter(item =>
            (policy === "all" ||
                `${item.policyId}:${item.policyVersion}` === policy) &&
            LEVELS.includes(item.riskLevel) &&
            Number.isFinite(item.riskScore)
        );

        const current = filtered.filter(item =>
            new Date(item.assessedAt) >= start
        );

        const previous = filtered.filter(item =>
            new Date(item.assessedAt) < start
        );

        const transactionIds = [...new Set(
            current.map(item => item.transactionId).filter(Boolean)
        )];

        const transactions = transactionIds.length
            ? await db.collection("transactions")
                .find({ transactionId: { $in: transactionIds } })
                .project({
                    _id: 0,
                    transactionId: 1,
                    sourceAccountId: 1
                })
                .toArray()
            : [];

        const accountIds = [...new Set(
            transactions.map(item => item.sourceAccountId).filter(Boolean)
        )];

        const accounts = accountIds.length
            ? await db.collection("accounts")
                .find({ accountId: { $in: accountIds } })
                .project({
                    _id: 0,
                    accountId: 1,
                    clientId: 1
                })
                .toArray()
            : [];

        const clientIds = [...new Set(
            accounts.map(item => item.clientId).filter(Boolean)
        )];

        const clients = clientIds.length
            ? await db.collection("clients")
                .find({ clientId: { $in: clientIds } })
                .project({
                    _id: 0,
                    clientId: 1,
                    industry: 1,
                    country: 1
                })
                .toArray()
            : [];

        const transactionMap = new Map(
            transactions.map(item => [item.transactionId, item])
        );

        const accountMap = new Map(
            accounts.map(item => [item.accountId, item])
        );

        const clientMap = new Map(
            clients.map(item => [item.clientId, item])
        );

        const getClient = assessment => {
            const transaction = transactionMap.get(
                assessment.transactionId
            );
            const account = accountMap.get(
                transaction?.sourceAccountId
            );
            return clientMap.get(account?.clientId);
        };

        const counts = emptyCounts();
        const previousCounts = emptyCounts();

        current.forEach(item => addCount(counts, item.riskLevel));
        previous.forEach(item => addCount(previousCounts, item.riskLevel));

        const high = counts.High + counts.Critical;
        const previousHigh =
            previousCounts.High + previousCounts.Critical;

        const periodDays = Array.from(
            { length: countDays },
            (_, index) => daysBefore(startDay, -index)
        );

        const trendMap = new Map(
            periodDays.map(day => [day, {
                day,
                counts: emptyCounts(),
                scoreSum: 0,
                assessments: 0
            }])
        );

        const industryMap = new Map();
        const countryMap = new Map();
        const ruleMap = new Map();

        for (const assessment of current) {
            const trend = trendMap.get(utcDay(assessment.assessedAt));

            if (trend) {
                addCount(trend.counts, assessment.riskLevel);
                trend.scoreSum += assessment.riskScore;
                trend.assessments++;
            }

            const client = getClient(assessment);

            const industry = client?.industry?.trim() ||
                "Not recorded";

            const country = client?.country?.trim() ||
                "Not recorded";

            if (!industryMap.has(industry)) {
                industryMap.set(industry, emptyCounts());
            }

            if (!countryMap.has(country)) {
                countryMap.set(country, emptyCounts());
            }

            addCount(industryMap.get(industry), assessment.riskLevel);
            addCount(countryMap.get(country), assessment.riskLevel);

            for (const rule of assessment.triggeredRules ?? []) {
                if (!ruleMap.has(rule.ruleId)) {
                    ruleMap.set(rule.ruleId, {
                        ruleId: rule.ruleId,
                        triggered: 0,
                        name: null
                    });
                }

                ruleMap.get(rule.ruleId).triggered++;
            }
        }

        const ruleNames = new Map();

        for (const item of policies) {
            for (const rule of item.rules ?? []) {
                if (rule.name) {
                    ruleNames.set(rule.ruleId, rule.name);
                }
            }
        }

        const industries = [...industryMap.entries()]
            .map(([name, values]) => ({
                name,
                ...values,
                total: total(values)
            }))
            .sort((a, b) => b.total - a.total);

        const jurisdictions = [...countryMap.entries()]
            .map(([name, values]) => ({
                name,
                ...values,
                assessments: total(values),
                highRisk: values.High + values.Critical,
                riskRate: total(values)
                    ? Number((
                        (values.High + values.Critical) /
                        total(values) * 100
                    ).toFixed(1))
                    : 0
            }))
            .sort((a, b) => b.assessments - a.assessments);

        const triggers = [...ruleMap.values()]
            .map(item => ({
                ...item,
                name: ruleNames.get(item.ruleId) ??
                    RULE_NAMES[item.ruleId] ??
                    item.ruleId,
                percent: current.length
                    ? Number((
                        item.triggered / current.length * 100
                    ).toFixed(1))
                    : 0
            }))
            .sort((a, b) => b.triggered - a.triggered)
            .slice(0, 10);

        res.json({
            period: {
                days: countDays,
                start: startDay,
                end: today,
                previousStart,
                previousEnd: startDay
            },
            policies: policyOptions,
            selectedPolicy: policy,
            metrics: {
                assessments: current.length,
                highRisk: high,
                mediumRisk: counts.Medium,
                lowRisk: counts.Low,
                criticalRisk: counts.Critical,
                averageScore: average(current),
                changes: {
                    assessments: difference(
                        current.length, previous.length
                    ),
                    highRisk: difference(high, previousHigh),
                    mediumRisk: difference(
                        counts.Medium, previousCounts.Medium
                    ),
                    lowRisk: difference(
                        counts.Low, previousCounts.Low
                    ),
                    averageScore: average(current) != null &&
                        average(previous) != null
                        ? Number((
                            average(current) - average(previous)
                        ).toFixed(1))
                        : null
                }
            },
            distribution: counts,
            trend: [...trendMap.values()].map(item => ({
                day: item.day,
                ...item.counts,
                averageScore: item.assessments
                    ? Number((
                        item.scoreSum / item.assessments
                    ).toFixed(1))
                    : null
            })),
            industries,
            jurisdictions,
            triggers
        });
    } catch (error) {
        next(error);
    }
}