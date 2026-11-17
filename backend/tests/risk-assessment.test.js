
import test from "node:test";
import assert from "node:assert/strict";

import {
    DEFAULT_RISK_RULES,
    DEFAULT_RISK_THRESHOLDS,
    validateCustomRule,
    validateRiskPolicy,
    evaluateTransactionRisk
} from "../src/services/risk-assessment.service.js";

function createPolicy(overrides = {}) {
    return {
        policyId: "POLICY-001",
        version: 1,
        rules: structuredClone(DEFAULT_RISK_RULES),
        thresholds: structuredClone(DEFAULT_RISK_THRESHOLDS),
        ...overrides
    };
}

function createContext(overrides = {}) {
    return {
        amountMinor: 10000,
        currency: "CAD",
        sourceBalanceMinor: 100000000,
        sourceAccountStatus: "Active",
        destinationAccountStatus: "Active",
        sourceClientStatus: "Active",
        destinationClientStatus: "Active",
        recentTransactionCount: 0,
        recentTransferVolumeMinor: 0,
        ...overrides
    };
}

test("Default risk policy is valid", () => {
    assert.equal(validateRiskPolicy(createPolicy()), true);
});

test("Low-risk transaction does not require approval", () => {
    const result = evaluateTransactionRisk(
        createContext(),
        createPolicy()
    );

    assert.equal(result.riskScore, 0);
    assert.equal(result.riskLevel, "Low");
    assert.equal(result.approvalRequired, false);
    assert.deepEqual(result.triggeredRules, []);
});

test("Medium-risk transaction requires approval", () => {
    const result = evaluateTransactionRisk(
        createContext({ amountMinor: 5000000 }),
        createPolicy()
    );

    assert.equal(result.riskScore, 35);
    assert.equal(result.riskLevel, "Medium");
    assert.equal(result.approvalRequired, true);

    assert.deepEqual(
        result.triggeredRules.map(rule => rule.ruleId),
        ["RISK-001", "RISK-002"]
    );
});

test("High-risk transaction requires approval", () => {
    const result = evaluateTransactionRisk(
        createContext({ amountMinor: 10000000 }),
        createPolicy()
    );

    assert.equal(result.riskScore, 60);
    assert.equal(result.riskLevel, "High");
    assert.equal(result.approvalRequired, true);
});

test("Critical-risk score is capped at 100", () => {
    const result = evaluateTransactionRisk(
        createContext({
            amountMinor: 10000000,
            sourceClientStatus: "Suspended",
            destinationClientStatus: "Inactive",
            recentTransactionCount: 10,
            recentTransferVolumeMinor: 20000000
        }),
        createPolicy()
    );

    assert.equal(result.riskScore, 100);
    assert.equal(result.riskLevel, "Critical");
    assert.equal(result.approvalRequired, true);
});

test("Amount threshold is inclusive", () => {
    const result = evaluateTransactionRisk(
        createContext({ amountMinor: 1000000 }),
        createPolicy()
    );

    assert.equal(
        result.triggeredRules.some(
            rule => rule.ruleId === "RISK-001"
        ),
        true
    );
});

test("Amount below threshold does not trigger rule", () => {
    const result = evaluateTransactionRisk(
        createContext({ amountMinor: 999999 }),
        createPolicy()
    );

    assert.equal(
        result.triggeredRules.some(
            rule => rule.ruleId === "RISK-001"
        ),
        false
    );
});

test("High transaction frequency triggers RISK-004", () => {
    const result = evaluateTransactionRisk(
        createContext({ recentTransactionCount: 5 }),
        createPolicy()
    );

    assert.equal(result.riskScore, 15);
    assert.equal(result.triggeredRules[0].ruleId, "RISK-004");
});

test("Transfer volume triggers RISK-005", () => {
    const result = evaluateTransactionRisk(
        createContext({
            recentTransferVolumeMinor: 10000000
        }),
        createPolicy()
    );

    assert.equal(
        result.triggeredRules.some(
            rule => rule.ruleId === "RISK-005"
        ),
        true
    );
});

test("Transfer exceeding balance percentage triggers RISK-006", () => {
    const result = evaluateTransactionRisk(
        createContext({
            amountMinor: 6000,
            sourceBalanceMinor: 10000
        }),
        createPolicy()
    );

    assert.equal(
        result.triggeredRules.some(
            rule => rule.ruleId === "RISK-006"
        ),
        true
    );
});

test("Transfer exactly at balance percentage does not trigger RISK-006", () => {
    const result = evaluateTransactionRisk(
        createContext({
            amountMinor: 5000,
            sourceBalanceMinor: 10000
        }),
        createPolicy()
    );

    assert.equal(
        result.triggeredRules.some(
            rule => rule.ruleId === "RISK-006"
        ),
        false
    );
});

test("Inactive source client triggers RISK-007", () => {
    const result = evaluateTransactionRisk(
        createContext({
            sourceClientStatus: "Inactive"
        }),
        createPolicy()
    );

    assert.equal(result.riskScore, 30);
    assert.equal(result.riskLevel, "Medium");
});

test("Suspended destination client triggers RISK-008", () => {
    const result = evaluateTransactionRisk(
        createContext({
            destinationClientStatus: "Suspended"
        }),
        createPolicy()
    );

    assert.equal(result.riskScore, 30);
});

test("Assessment preserves policy reference", () => {
    const result = evaluateTransactionRisk(
        createContext(),
        createPolicy()
    );

    assert.equal(result.policyId, "POLICY-001");
    assert.equal(result.policyVersion, 1);
});

test("Valid custom amount rule is accepted", () => {
    assert.equal(
        validateCustomRule({
            ruleId: "CUSTOM-AMOUNT",
            name: "Large Transfer",
            field: "amount",
            operator: "gte",
            value: 1000,
            points: 20
        }),
        true
    );
});

test("Custom amount rule triggers correctly", () => {
    const policy = createPolicy();

    policy.rules.push({
        ruleId: "CUSTOM-AMOUNT",
        name: "Custom Amount",
        field: "amount",
        operator: "gte",
        value: 1000,
        points: 25
    });

    const result = evaluateTransactionRisk(
        createContext({ amountMinor: 100000 }),
        policy
    );

    assert.equal(result.riskScore, 25);
    assert.equal(result.riskLevel, "Medium");
    assert.equal(result.triggeredRules[0].ruleId, "CUSTOM-AMOUNT");
});

test("Custom greater-than rule excludes equal values", () => {
    const policy = createPolicy();

    policy.rules.push({
        ruleId: "CUSTOM-FREQUENCY",
        name: "Frequent Transactions",
        field: "recentCount",
        operator: "gt",
        value: 3,
        points: 20
    });

    const equal = evaluateTransactionRisk(
        createContext({ recentTransactionCount: 3 }),
        policy
    );

    const greater = evaluateTransactionRisk(
        createContext({ recentTransactionCount: 4 }),
        policy
    );

    assert.equal(equal.riskScore, 0);
    assert.equal(greater.riskScore, 20);
});

test("Custom account status rule triggers", () => {
    const policy = createPolicy();

    policy.rules.push({
        ruleId: "CUSTOM-ACCOUNT",
        name: "Frozen Account",
        field: "sourceAccountStatus",
        operator: "eq",
        value: "Frozen",
        points: 40
    });

    const result = evaluateTransactionRisk(
        createContext({
            sourceAccountStatus: "Frozen"
        }),
        policy
    );

    assert.equal(result.riskScore, 40);
    assert.equal(result.riskLevel, "Medium");
});

test("Custom balance percentage uses strict comparison", () => {
    const policy = createPolicy();

    policy.rules.push({
        ruleId: "CUSTOM-BALANCE",
        name: "Balance Usage",
        field: "balancePercent",
        operator: "gt",
        value: 25,
        points: 20
    });

    const equal = evaluateTransactionRisk(
        createContext({
            amountMinor: 2500,
            sourceBalanceMinor: 10000
        }),
        policy
    );

    const greater = evaluateTransactionRisk(
        createContext({
            amountMinor: 2501,
            sourceBalanceMinor: 10000
        }),
        policy
    );

    assert.equal(
        equal.triggeredRules.some(
            rule => rule.ruleId === "CUSTOM-BALANCE"
        ),
        false
    );

    assert.equal(
        greater.triggeredRules.some(
            rule => rule.ruleId === "CUSTOM-BALANCE"
        ),
        true
    );
});

test("Invalid custom rule IDs are rejected", () => {
    assert.throws(
        () => validateCustomRule({
            ruleId: "INVALID",
            name: "Test",
            field: "amount",
            operator: "gte",
            value: 100,
            points: 20
        }),
        /Custom rule ID/
    );
});

test("Invalid custom rule points are rejected", () => {
    assert.throws(
        () => validateCustomRule({
            ruleId: "CUSTOM-TEST",
            name: "Test",
            field: "amount",
            operator: "gte",
            value: 100,
            points: 101
        }),
        /points/
    );
});

test("Unsupported custom operators are rejected", () => {
    assert.throws(
        () => validateCustomRule({
            ruleId: "CUSTOM-TEST",
            name: "Test",
            field: "amount",
            operator: "eq",
            value: 100,
            points: 20
        }),
        /unsupported condition/
    );
});

test("Custom rules cannot use threshold property", () => {
    assert.throws(
        () => validateCustomRule({
            ruleId: "CUSTOM-TEST",
            name: "Test",
            field: "amount",
            operator: "gte",
            value: 100,
            threshold: 100,
            points: 20
        }),
        /use value/
    );
});

test("Invalid risk threshold gaps are rejected", () => {
    const policy = createPolicy();

    policy.thresholds[1].min = 30;

    assert.throws(
        () => validateRiskPolicy(policy),
        /gaps or overlaps/
    );
});

test("Risk threshold overlaps are rejected", () => {
    const policy = createPolicy();

    policy.thresholds[1].min = 20;

    assert.throws(
        () => validateRiskPolicy(policy),
        /gaps or overlaps/
    );
});

test("Missing seeded risk rules are rejected", () => {
    const policy = createPolicy();

    policy.rules.pop();

    assert.throws(
        () => validateRiskPolicy(policy),
        /Missing required seeded rule/
    );
});

test("Duplicate risk rules are rejected", () => {
    const policy = createPolicy();

    policy.rules.push({ ...policy.rules[0] });

    assert.throws(
        () => validateRiskPolicy(policy),
        /Duplicate risk rule/
    );
});

test("Invalid threshold percentages are rejected", () => {
    const policy = createPolicy();

    policy.rules.find(
        rule => rule.ruleId === "RISK-006"
    ).threshold = 101;

    assert.throws(
        () => validateRiskPolicy(policy),
        /Invalid balance percentage/
    );
});

test("Zero transfer amount is rejected", () => {
    assert.throws(
        () => evaluateTransactionRisk(
            createContext({ amountMinor: 0 }),
            createPolicy()
        ),
        /positive/
    );
});

test("Negative financial amount is rejected", () => {
    assert.throws(
        () => evaluateTransactionRisk(
            createContext({ amountMinor: -1 }),
            createPolicy()
        ),
        /Invalid financial amount/
    );
});

test("Unsafe financial integers are rejected", () => {
    assert.throws(
        () => evaluateTransactionRisk(
            createContext({
                amountMinor: Number.MAX_SAFE_INTEGER + 1
            }),
            createPolicy()
        ),
        /Invalid financial amount/
    );
});

test("Unsupported currency is rejected", () => {
    assert.throws(
        () => evaluateTransactionRisk(
            createContext({ currency: "EUR" }),
            createPolicy()
        ),
        /Unsupported currency/
    );
});

test("Negative transaction count is rejected", () => {
    assert.throws(
        () => evaluateTransactionRisk(
            createContext({ recentTransactionCount: -1 }),
            createPolicy()
        ),
        /Invalid transaction count/
    );
});

test("Invalid client status is rejected", () => {
    assert.throws(
        () => evaluateTransactionRisk(
            createContext({
                sourceClientStatus: "Unknown"
            }),
            createPolicy()
        ),
        /Invalid client status/
    );
});

test("Invalid account status is rejected", () => {
    assert.throws(
        () => evaluateTransactionRisk(
            createContext({
                destinationAccountStatus: "Unknown"
            }),
            createPolicy()
        ),
        /Invalid account status/
    );
});
