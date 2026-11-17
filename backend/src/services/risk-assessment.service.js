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

export const CUSTOM_RULE_FIELDS = {
    amount: {
        kind: "money",
        operators: ["gte", "gt"]
    },
    recentCount: {
        kind: "number",
        operators: ["gte", "gt"]
    },
    recentVolume: {
        kind: "money",
        operators: ["gte", "gt"]
    },
    balancePercent: {
        kind: "percentage",
        operators: ["gte", "gt"]
    },
    sourceClientStatus: {
        kind: "clientStatus",
        operators: ["eq", "ne"]
    },
    destinationClientStatus: {
        kind: "clientStatus",
        operators: ["eq", "ne"]
    },
    sourceAccountStatus: {
        kind: "accountStatus",
        operators: ["eq", "ne"]
    },
    destinationAccountStatus: {
        kind: "accountStatus",
        operators: ["eq", "ne"]
    }
};

const CLIENT_STATUSES = ["Active", "Inactive", "Suspended"];
const ACCOUNT_STATUSES = ["Active", "Frozen", "Closed"];
const REQUIRED_THRESHOLD_RULES = new Set([
    "RISK-001",
    "RISK-002",
    "RISK-003",
    "RISK-004",
    "RISK-005",
    "RISK-006"
]);

const MONETARY_RULES = new Set([
    "RISK-001",
    "RISK-002",
    "RISK-003",
    "RISK-005"
]);

function validPoints(points) {
    return Number.isInteger(points) &&
        points >= 0 &&
        points <= 100;
}

export function validateCustomRule(rule) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
        throw new Error("Invalid custom rule");
    }

    if (!/^CUSTOM-[A-Z0-9-]{1,48}$/.test(rule.ruleId ?? "")) {
        throw new Error("Custom rule ID must start with CUSTOM-");
    }

    if (
        typeof rule.name !== "string" ||
        !rule.name.trim() ||
        rule.name.length > 120
    ) {
        throw new Error(`${rule.ruleId}: invalid custom rule name`);
    }

    if (!validPoints(rule.points)) {
        throw new Error(`${rule.ruleId}: points must be 0–100`);
    }

    const definition = CUSTOM_RULE_FIELDS[rule.field];

    if (
        !definition ||
        !definition.operators.includes(rule.operator)
    ) {
        throw new Error(`${rule.ruleId}: unsupported condition`);
    }

    if (Object.hasOwn(rule, "threshold")) {
        throw new Error(
            `${rule.ruleId}: custom rules use value, not threshold`
        );
    }

    if (definition.kind === "clientStatus") {
        if (!CLIENT_STATUSES.includes(rule.value)) {
            throw new Error(`${rule.ruleId}: invalid client status`);
        }
    } else if (definition.kind === "accountStatus") {
        if (!ACCOUNT_STATUSES.includes(rule.value)) {
            throw new Error(`${rule.ruleId}: invalid account status`);
        }
    } else {
        if (
            !Number.isSafeInteger(rule.value) ||
            rule.value < 0
        ) {
            throw new Error(`${rule.ruleId}: invalid numeric value`);
        }

        if (
            definition.kind === "percentage" &&
            rule.value > 100
        ) {
            throw new Error(`${rule.ruleId}: percentage exceeds 100`);
        }

        if (
            definition.kind === "money" &&
            !Number.isSafeInteger(rule.value * 100)
        ) {
            throw new Error(`${rule.ruleId}: monetary value too large`);
        }
    }

    return true;
}

export function validateRiskPolicy(policy) {
    if (
        !policy ||
        !Array.isArray(policy.rules) ||
        !Array.isArray(policy.thresholds)
    ) {
        throw new Error("Invalid risk policy");
    }

    const levels = ["Low", "Medium", "High", "Critical"];

    if (policy.thresholds.length !== 4) {
        throw new Error("Four risk thresholds are required");
    }

    for (let i = 0; i < 4; i++) {
        const current = policy.thresholds[i];

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

        if (
            i > 0 &&
            current.min !== policy.thresholds[i - 1].max + 1
        ) {
            throw new Error("Risk thresholds contain gaps or overlaps");
        }
    }

    if (policy.thresholds[3].max !== 100) {
        throw new Error("Risk thresholds must end at 100");
    }

    const ruleIds = new Set();

    if (policy.rules.length > 58) {
        throw new Error("A policy supports up to 50 custom rules");
    }

    for (const rule of policy.rules) {
        if (ruleIds.has(rule.ruleId)) {
            throw new Error(`Duplicate risk rule: ${rule.ruleId}`);
        }

        const seeded = DEFAULT_RISK_RULES.find(
            item => item.ruleId === rule.ruleId
        );

        if (seeded) {
            if (!validPoints(rule.points)) {
                throw new Error(`${rule.ruleId}: invalid points`);
            }

            if (REQUIRED_THRESHOLD_RULES.has(rule.ruleId)) {
                if (
                    !Number.isSafeInteger(rule.threshold) ||
                    rule.threshold <= 0
                ) {
                    throw new Error(`${rule.ruleId}: invalid threshold`);
                }

                if (
                    rule.ruleId === "RISK-006" &&
                    rule.threshold > 100
                ) {
                    throw new Error("Invalid balance percentage");
                }

                if (
                    MONETARY_RULES.has(rule.ruleId) &&
                    !Number.isSafeInteger(rule.threshold * 100)
                ) {
                    throw new Error("Monetary threshold too large");
                }
            } else if (Object.hasOwn(rule, "threshold")) {
                throw new Error(`${rule.ruleId}: unexpected threshold`);
            }
        } else {
            validateCustomRule(rule);
        }

        ruleIds.add(rule.ruleId);
    }

    for (const seeded of DEFAULT_RISK_RULES) {
        if (!ruleIds.has(seeded.ruleId)) {
            throw new Error(`Missing required seeded rule: ${seeded.ruleId}`);
        }
    }

    return true;
}

function compareNumber(actual, operator, target) {
    switch (operator) {
        case "gte": return actual >= target;
        case "gt": return actual > target;
        case "eq": return actual === target;
        case "ne": return actual !== target;
        default: throw new Error("Invalid rule operator");
    }
}

function evaluateCustomRule(rule, context) {
    const fields = {
        amount: context.amountMinor,
        recentCount: context.recentTransactionCount,
        recentVolume: context.recentTransferVolumeMinor,
        sourceClientStatus: context.sourceClientStatus,
        destinationClientStatus: context.destinationClientStatus,
        sourceAccountStatus: context.sourceAccountStatus,
        destinationAccountStatus: context.destinationAccountStatus
    };

    if (rule.field === "balancePercent") {
        const left = BigInt(context.amountMinor) * BigInt(100);
        const right = BigInt(context.sourceBalanceMinor) *
            BigInt(rule.value);

        return {
            triggered: rule.operator === "gt"
                ? left > right
                : left >= right,
            evaluatedInput: {
                amountMinor: context.amountMinor,
                sourceBalanceMinor: context.sourceBalanceMinor
            }
        };
    }

    const kind = CUSTOM_RULE_FIELDS[rule.field].kind;

    if (kind === "money") {
        const actualMinor = rule.field === "amount"
            ? context.amountMinor
            : context.recentTransferVolumeMinor;

        return {
            triggered: compareNumber(
                BigInt(actualMinor),
                rule.operator,
                BigInt(rule.value) * BigInt(100)
            ),
            evaluatedInput: actualMinor
        };
    }

    const actual = fields[rule.field];

    return {
        triggered: compareNumber(actual, rule.operator, rule.value),
        evaluatedInput: actual
    };
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
        if (!ACCOUNT_STATUSES.includes(status)) {
            throw new Error("Invalid account status");
        }
    }

    for (const status of [
        sourceClientStatus,
        destinationClientStatus
    ]) {
        if (!CLIENT_STATUSES.includes(status)) {
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
                    BigInt(amountMinor) * BigInt(100) >
                    BigInt(sourceBalanceMinor) * BigInt(threshold);
                evaluatedInput = { amountMinor, sourceBalanceMinor };
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

            default: {
                const result = evaluateCustomRule(rule, context);
                triggered = result.triggered;
                evaluatedInput = result.evaluatedInput;
                reason = `${rule.name}: ${rule.field} ${rule.operator} ${rule.value}`;
            }
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

    const classification = policy.thresholds.find(
        item => score >= item.min && score <= item.max
    );

    if (!classification) {
        throw new Error("Risk classification failed");
    }

    return {
        policyId: policy.policyId,
        policyVersion: policy.version,
        riskScore: score,
        riskLevel: classification.level,
        approvalRequired: classification.level !== "Low",
        triggeredRules
    };
}