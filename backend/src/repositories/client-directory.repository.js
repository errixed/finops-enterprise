import {
    getCollection
} from "./mongodb.repository.js";

const DAY = 86400000;

function toDate(value) {
    return value ? new Date(value) : null;
}

function moneyGroups(accounts) {
    const balances = new Map();

    for (const account of accounts) {
        const currency = account.currency;
        const minor = account.balanceMinor;

        const amount = typeof minor?.toBigInt === "function"
            ? minor.toBigInt()
            : BigInt(minor ?? 0);

        balances.set(
            currency,
            (balances.get(currency) ?? 0n) + amount
        );
    }

    return [...balances.entries()].map(([currency, amount]) => ({
        currency,
        balanceMinor: amount.toString()
    }));
}

export async function getClientOperationalReport(clientId) {
    const accounts = await getCollection("accounts")
        .find({ clientId })
        .project({
            _id: 0,
            accountId: 1,
            accountNumber: 1,
            status: 1,
            currency: 1,
            balanceMinor: 1
        })
        .toArray();

    const accountIds = accounts.map(a => a.accountId);

    if (!accountIds.length) {
        return {
            recentTransactions: [],
            accountCount: 0,
            activeAccountCount: 0,
            balancesByCurrency: [],
            transactionCount: 0,
            transactionTrend: [],
            latestRisk: null,
            riskDistribution: [],
            pendingApprovals: [],
            highRiskTransactions: []
        };
    }

    const transactions = await getCollection("transactions")
        .find({
            sourceAccountId: { $in: accountIds }
        })

        .project({
            _id: 0,
            transactionId: 1,
            referenceNumber: 1,
            sourceAccountId: 1,
            destinationAccountId: 1,
            amountMinor: 1,
            currency: 1,
            transactionType: 1,
            status: 1,
            description: 1,
            createdAt: 1,
            updatedAt: 1,
            processedAt: 1
        })

        .sort({ createdAt: -1 })
        .toArray();

    const transactionIds = transactions.map(
        t => t.transactionId
    );

    const [assessments, workflows] = transactionIds.length
        ? await Promise.all([
            getCollection("risk_assessments")
                .find({
                    transactionId: { $in: transactionIds }
                })
                .project({
                    _id: 0,
                    assessmentId: 1,
                    transactionId: 1,
                    riskScore: 1,
                    riskLevel: 1,
                    assessedAt: 1
                })
                .sort({ assessedAt: -1 })
                .toArray(),

            getCollection("approval_workflows")
                .find({
                    transactionId: { $in: transactionIds }
                })
                .project({
                    _id: 0,
                    workflowId: 1,
                    transactionId: 1,
                    status: 1,
                    currentStage: 1,
                    createdAt: 1
                })
                .toArray()
        ])
        : [[], []];

    const latestAssessments = new Map();

    for (const assessment of assessments) {
        if (!latestAssessments.has(assessment.transactionId)) {
            latestAssessments.set(
                assessment.transactionId,
                assessment
            );
        }
    }

    const transactionMap = new Map(
        transactions.map(t => [t.transactionId, t])
    );

    const riskDistribution = {
        Low: 0,
        Medium: 0,
        High: 0,
        Critical: 0
    };

    for (const assessment of latestAssessments.values()) {
        if (Object.hasOwn(riskDistribution, assessment.riskLevel)) {
            riskDistribution[assessment.riskLevel]++;
        }
    }

    const mostRecentRisk = [...latestAssessments.values()]
        .sort((a, b) =>
            new Date(b.assessedAt) - new Date(a.assessedAt)
        )[0] ?? null;

    const pendingApprovals = workflows
        .filter(w => ["Pending", "InReview", "Escalated"]
            .includes(w.status))
        .map(workflow => ({
            ...workflow,
            transaction: transactionMap.get(workflow.transactionId) ?? null
        }));

    const highRiskTransactions = transactions
        .map(transaction => ({
            ...transaction,
            assessment: latestAssessments.get(
                transaction.transactionId
            ) ?? null
        }))
        .filter(item => ["High", "Critical"]
            .includes(item.assessment?.riskLevel))
        .slice(0, 10);

    const now = new Date();
    const trend = [];

    for (let offset = 5; offset >= 0; offset--) {
        const from = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth() - offset,
            1
        ));

        const to = new Date(Date.UTC(
            from.getUTCFullYear(),
            from.getUTCMonth() + 1,
            1
        ));

        const monthTransactions = transactions.filter(t => {
            const date = toDate(t.createdAt);
            return date && date >= from && date < to;
        });

        const volumeByCurrency = {};

        for (const transaction of monthTransactions) {
            const amount = BigInt(transaction.amountMinor ?? 0);
            const currency = transaction.currency;

            volumeByCurrency[currency] = (
                BigInt(volumeByCurrency[currency] ?? "0") + amount
            ).toString();
        }

        trend.push({
            month: from.toISOString().slice(0, 7),
            count: monthTransactions.length,
            volumeByCurrency
        });
    }

    return {

        recentTransactions: transactions.slice(0, 10).map(transaction => ({
            transactionId: transaction.transactionId,
            referenceNumber: transaction.referenceNumber,
            transactionType: transaction.transactionType ?? "Transfer",
            amountMinor: String(transaction.amountMinor ?? 0),
            currency: transaction.currency,
            status: transaction.status,
            createdAt: transaction.createdAt,
            processedAt: transaction.processedAt ?? null
        })),

        accountCount: accounts.length,
        activeAccountCount: accounts.filter(
            a => a.status === "Active"
        ).length,
        balancesByCurrency: moneyGroups(accounts),
        transactionCount: transactions.length,
        transactionTrend: trend,
        latestRisk: mostRecentRisk,
        riskDistribution: Object.entries(riskDistribution)
            .map(([level, count]) => ({ level, count })),
        pendingApprovals,
        highRiskTransactions
    };
}

export async function getClientDirectoryMetrics() {
    const clients = getCollection("clients");
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - DAY * 30);

    const [
        totalClients,
        activeClients,
        corporateClients,
        individualClients,
        newClients30Days,
        clientsDueForReview
    ] = await Promise.all([
        clients.countDocuments({}),
        clients.countDocuments({ status: "Active" }),
        clients.countDocuments({ clientType: "Corporate" }),
        clients.countDocuments({ clientType: "Individual" }),
        clients.countDocuments({
            createdAt: { $gte: thirtyDaysAgo, $lte: now }
        }),
        clients.countDocuments({
            nextReviewAt: { $ne: null, $lte: now }
        })
    ]);

    const highRiskClientIds = await getCollection("accounts")
        .aggregate([
            {
                $lookup: {
                    from: "transactions",
                    localField: "accountId",
                    foreignField: "sourceAccountId",
                    as: "transactions"
                }
            },
            { $unwind: "$transactions" },
            {
                $lookup: {
                    from: "risk_assessments",
                    localField: "transactions.transactionId",
                    foreignField: "transactionId",
                    as: "assessments"
                }
            },
            { $unwind: "$assessments" },
            {
                $sort: {
                    "assessments.assessedAt": -1
                }
            },
            {
                $group: {
                    _id: "$transactions.transactionId",
                    clientId: { $first: "$clientId" },
                    riskLevel: {
                        $first: "$assessments.riskLevel"
                    }
                }
            },
            {
                $match: {
                    riskLevel: { $in: ["High", "Critical"] }
                }
            },
            { $group: { _id: "$clientId" } }
        ]).toArray();

    return {
        totalClients,
        activeClients,
        corporateClients,
        individualClients,
        unclassifiedClients: Math.max(
            0,
            totalClients - corporateClients - individualClients
        ),
        highRiskClients: highRiskClientIds.length,
        newClients30Days,
        clientsDueForReview
    };
}