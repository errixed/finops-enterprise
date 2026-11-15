export const DEFAULT_RISK_RULES = [
    { ruleId: "RISK-001", points: 15, threshold: 10000 },
    { ruleId: "RISK-002", points: 20, threshold: 50000 },
    { ruleId: "RISK-003", points: 25, threshold: 100000 },
    { ruleId: "RISK-004", points: 15, threshold: 5 },
    { ruleId: "RISK-005", points: 20, threshold: 100000 },
    { ruleId: "RISK-006", points: 15, threshold: 50 },
    { ruleId: "RISK-007", points: 30 },
    { ruleId: "RISK-008", points: 30 }
];


export const DEFAULT_RISK_THRESHOLDS = [
    { level: "Low", min: 0, max: 24 },
    { level: "Medium", min: 25, max: 49 },
    { level: "High", min: 50, max: 74 },
    { level: "Critical", min: 75, max: 100 }
];

const VALID_LEVELS = [
    "Low",
    "Medium",
    "High",
    "Critical"
];

export function validateRiskPolicy(policy) {
    if (
        !policy ||
        !Array.isArray(policy.rules) ||
        !Array.isArray(policy.thresholds)
    ) {
        throw new Error("Invalid risk policy");
    }

    const levels = ["Low", "Medium", "High", "Critical"];
    const thresholds = policy.thresholds;

    if (thresholds.length !== levels.length) {
        throw new Error("Four risk thresholds are required");
    }

    for (let i = 0; i < thresholds.length; i++) {
        const current = thresholds[i];

        if (
            current.level !== levels[i] ||
            !Number.isInteger(current.min) ||
            !Number.isInteger(current.max) ||
            current.min < 0 ||
            current.max > 100 ||
            current.min > current.max
        ) {
            throw new Error("Invalid risk threshold");
        }

        if (i === 0 && current.min !== 0) {
            throw new Error("Risk thresholds must start at zero");
        }

        if (i > 0) {
            const previous = thresholds[i - 1];

            if (current.min !== previous.max + 1) {
                throw new Error(
                    "Risk thresholds contain gaps or overlaps"
                );
            }
        }
    }

    if (thresholds[thresholds.length - 1].max !== 100) {
        throw new Error("Risk thresholds must end at 100");
    }

    const ruleIds = new Set();

    for (const rule of policy.rules) {
        const defaultRule = DEFAULT_RISK_RULES.find(
            item => item.ruleId === rule.ruleId
        );

        if (!defaultRule || ruleIds.has(rule.ruleId)) {
            throw new Error("Invalid or duplicate risk rule");
        }

        if (
            !Number.isInteger(rule.points) ||
            rule.points < 0 ||
            rule.points > 100
        ) {
            throw new Error("Invalid risk rule points");
        }

        const requiresThreshold = [
            "RISK-001",
            "RISK-002",
            "RISK-003",
            "RISK-004",
            "RISK-005",
            "RISK-006"
        ].includes(rule.ruleId);

        if (
            requiresThreshold &&
            (!Number.isSafeInteger(rule.threshold) ||
                rule.threshold <= 0)
        ) {
            throw new Error(
                `Invalid threshold for ${rule.ruleId}`
            );
        }

        if (
            !requiresThreshold &&
            Object.hasOwn(rule, "threshold")
        ) {
            throw new Error(
                `Unexpected threshold for ${rule.ruleId}`
            );
        }

        if (
            rule.ruleId === "RISK-006" &&
            rule.threshold > 100
        ) {
            throw new Error("Invalid balance percentage threshold");
        }

        if (
            ["RISK-001", "RISK-002", "RISK-003", "RISK-005"]
                .includes(rule.ruleId) &&
            !Number.isSafeInteger(rule.threshold * 100)
        ) {
            throw new Error(
                "Threshold exceeds supported monetary range"
            );
        }

        ruleIds.add(rule.ruleId);
    }

    for (const defaultRule of DEFAULT_RISK_RULES) {
        if (!ruleIds.has(defaultRule.ruleId)) {
            throw new Error(
                `Missing required risk rule: ${defaultRule.ruleId}`
            );
        }
    }

    return true;
}


export function evaluateTransactionRisk(context, policy) {
    validateRiskPolicy(policy);

    const {
        amountMinor,
        currency,
        sourceBalanceMinor,
        sourceAccountStatus,
        destinationAccountStatus,
        sourceClientStatus,
        destinationClientStatus,
        recentTransactionCount,
        recentTransferVolumeMinor
    } = context;

    for (const amount of [
        amountMinor,
        sourceBalanceMinor,
        recentTransferVolumeMinor
    ]) {
        if (!Number.isSafeInteger(amount) || amount < 0) {
            throw new Error("Invalid financial amount");
        }
    }

    if (amountMinor === 0) {
        throw new Error("Transfer amount must be positive");
    }

    if (!["CAD", "USD"].includes(currency)) {
        throw new Error("Unsupported currency");
    }

    if (
        !Number.isSafeInteger(recentTransactionCount) ||
        recentTransactionCount < 0
    ) {
        throw new Error("Invalid transaction count");
    }

    for (const status of [
        sourceAccountStatus,
        destinationAccountStatus
    ]) {
        if (!["Active", "Frozen", "Closed"].includes(status)) {
            throw new Error("Invalid account status");
        }
    }

    for (const status of [
        sourceClientStatus,
        destinationClientStatus
    ]) {
        if (!["Active", "Inactive", "Suspended"].includes(status)) {
            throw new Error("Invalid client status");
        }
    }

    const triggeredRules = [];

    for (const rule of policy.rules) {
        const { ruleId, points, threshold } = rule;

        let triggered = false;
        let reason = "";
        let evaluatedInput = null;

        switch (ruleId) {
            case "RISK-001":
            case "RISK-002":
            case "RISK-003":
                triggered = amountMinor >= threshold * 100;
                evaluatedInput = amountMinor;
                reason = `Transfer amount is at least ${threshold} ${currency}`;
                break;

            case "RISK-004":
                triggered = recentTransactionCount >= threshold;
                evaluatedInput = recentTransactionCount;
                reason = "High outgoing transaction frequency";
                break;

            case "RISK-005":
                triggered = recentTransferVolumeMinor >= threshold * 100;
                evaluatedInput = recentTransferVolumeMinor;
                reason = "High outgoing transfer volume";
                break;

            case "RISK-006":
                triggered =
                    BigInt(amountMinor) * 100n >
                    BigInt(sourceBalanceMinor) * BigInt(threshold);
                evaluatedInput = {
                    amountMinor,
                    sourceBalanceMinor
                };
                reason = "Transfer exceeds configured balance percentage";
                break;

            case "RISK-007":
                triggered = sourceClientStatus !== "Active";
                evaluatedInput = sourceClientStatus;
                reason = "Source client is not active";
                break;

            case "RISK-008":
                triggered = destinationClientStatus !== "Active";
                evaluatedInput = destinationClientStatus;
                reason = "Destination client is not active";
                break;
        }

        if (triggered) {
            triggeredRules.push({
                ruleId,
                points,
                reason,
                evaluatedInput
            });
        }
    }

    const score = Math.min(
        100,
        triggeredRules.reduce(
            (total, rule) => total + rule.points,
            0
        )
    );

    const level = policy.thresholds.find(
        threshold =>
            score >= threshold.min &&
            score <= threshold.max
    );

    if (!level) {
        throw new Error("Risk classification failed");
    }

    return {
        policyId: policy.policyId,
        policyVersion: policy.version,
        riskScore: score,
        riskLevel: level.level,
        approvalRequired: level.level !== "Low",
        triggeredRules
    };
}