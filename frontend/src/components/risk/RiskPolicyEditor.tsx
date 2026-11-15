"use client";

import { FormEvent, useState } from "react";

import {
    PolicyConfiguration,
    RiskLevel,
    RiskRule
} from "@/services/risk-policies";

const RULE_LABELS: Record<string, string> = {
    "RISK-001": "Transfer amount threshold 1",
    "RISK-002": "Transfer amount threshold 2",
    "RISK-003": "Transfer amount threshold 3",
    "RISK-004": "Recent transaction count",
    "RISK-005": "Recent transfer volume",
    "RISK-006": "Percentage of source balance",
    "RISK-007": "Inactive or suspended client",
    "RISK-008": "Frozen or closed account"
};

const LEVELS: RiskLevel[] = [
    "Low",
    "Medium",
    "High",
    "Critical"
];

const MONETARY_RULES = new Set([
    "RISK-001",
    "RISK-002",
    "RISK-003",
    "RISK-005"
]);

export function validatePolicyConfiguration(
    configuration: PolicyConfiguration
): string | null {
    const { rules, thresholds } = configuration;

    if (
        rules.length !== 8 ||
        new Set(rules.map(rule => rule.ruleId)).size !== 8
    ) {
        return "All eight unique risk rules are required.";
    }

    for (const rule of rules) {
        if (!Object.hasOwn(RULE_LABELS, rule.ruleId)) {
            return `Unknown rule: ${rule.ruleId}`;
        }

        if (
            !Number.isInteger(rule.points) ||
            rule.points < 0 ||
            rule.points > 100
        ) {
            return `${rule.ruleId}: points must be a whole number from 0 to 100.`;
        }

        const requiresThreshold =
            !["RISK-007", "RISK-008"].includes(rule.ruleId);

        if (requiresThreshold) {
            if (
                !Number.isSafeInteger(rule.threshold) ||
                (rule.threshold ?? 0) <= 0
            ) {
                return `${rule.ruleId}: threshold must be a positive safe integer.`;
            }

            if (
                rule.ruleId === "RISK-006" &&
                (rule.threshold ?? 0) > 100
            ) {
                return "RISK-006 cannot exceed 100%.";
            }

            if (
                MONETARY_RULES.has(rule.ruleId) &&
                !Number.isSafeInteger(
                    (rule.threshold ?? 0) * 100
                )
            ) {
                return `${rule.ruleId}: monetary threshold is too large.`;
            }
        } else if ("threshold" in rule) {
            return `${rule.ruleId} must not have a threshold.`;
        }
    }

    if (thresholds.length !== 4) {
        return "Exactly four risk classification ranges are required.";
    }

    for (let index = 0; index < LEVELS.length; index++) {
        const item = thresholds[index];

        if (
            item.level !== LEVELS[index] ||
            !Number.isInteger(item.min) ||
            !Number.isInteger(item.max) ||
            item.min < 0 ||
            item.max > 100 ||
            item.min > item.max
        ) {
            return `Invalid ${LEVELS[index]} risk range.`;
        }

        if (index === 0 && item.min !== 0) {
            return "Low risk must start at 0.";
        }

        if (
            index > 0 &&
            item.min !== thresholds[index - 1].max + 1
        ) {
            return "Risk ranges cannot contain gaps or overlaps.";
        }
    }

    if (thresholds[3].max !== 100) {
        return "Critical risk must end at 100.";
    }

    return null;
}

interface Props {
    initial: PolicyConfiguration;
    submitLabel: string;
    submitting: boolean;
    error?: string;
    onSubmit: (
        configuration: PolicyConfiguration
    ) => Promise<void>;
}

export default function RiskPolicyEditor({
    initial,
    submitLabel,
    submitting,
    error,
    onSubmit
}: Props) {
    const [configuration, setConfiguration] =
        useState<PolicyConfiguration>(() =>
            structuredClone(initial)
        );

    const [validationError, setValidationError] =
        useState("");

    function updateRule(
        ruleId: string,
        field: "points" | "threshold",
        raw: string
    ) {
        const value = Number(raw);

        setConfiguration(previous => ({
            ...previous,
            rules: previous.rules.map(rule =>
                rule.ruleId === ruleId
                    ? { ...rule, [field]: value }
                    : rule
            )
        }));
    }

    function updateThreshold(
        level: RiskLevel,
        field: "min" | "max",
        raw: string
    ) {
        const value = Number(raw);

        setConfiguration(previous => ({
            ...previous,
            thresholds: previous.thresholds.map(item =>
                item.level === level
                    ? { ...item, [field]: value }
                    : item
            )
        }));
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        const issue = validatePolicyConfiguration(
            configuration
        );

        setValidationError(issue ?? "");

        if (issue) return;

        await onSubmit(configuration);
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="risk-policy-editor"
        >
            <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <h2>Risk Rule Configuration</h2>
                </div>

                <p className="risk-policy-help">
                    Configure each rule's point contribution and
                    applicable threshold. All eight rules are required.
                </p>

                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th>Rule</th>
                                <th>Description</th>
                                <th>Points</th>
                                <th>Threshold</th>
                            </tr>
                        </thead>

                        <tbody>
                            {configuration.rules.map(rule => {
                                const hasThreshold =
                                    !["RISK-007", "RISK-008"]
                                        .includes(rule.ruleId);

                                return (
                                    <tr key={rule.ruleId}>
                                        <td>
                                            <strong>{rule.ruleId}</strong>
                                        </td>

                                        <td>
                                            {RULE_LABELS[rule.ruleId]}
                                        </td>

                                        <td>
                                            <input
                                                aria-label={`${rule.ruleId} points`}
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={1}
                                                required
                                                value={rule.points}
                                                onChange={event =>
                                                    updateRule(
                                                        rule.ruleId,
                                                        "points",
                                                        event.target.value
                                                    )
                                                }
                                            />
                                        </td>

                                        <td>
                                            {hasThreshold ? (
                                                <label className="risk-policy-threshold">
                                                    <input
                                                        aria-label={`${rule.ruleId} threshold`}
                                                        type="number"
                                                        min={1}
                                                        max={
                                                            rule.ruleId === "RISK-006"
                                                                ? 100
                                                                : undefined
                                                        }
                                                        step={1}
                                                        required
                                                        value={rule.threshold ?? 0}
                                                        onChange={event =>
                                                            updateRule(
                                                                rule.ruleId,
                                                                "threshold",
                                                                event.target.value
                                                            )
                                                        }
                                                    />
                                                    {rule.ruleId === "RISK-006"
                                                        ? "%"
                                                        : MONETARY_RULES.has(
                                                            rule.ruleId
                                                        )
                                                            ? "currency units"
                                                            : "transactions"}
                                                </label>
                                            ) : (
                                                "Not applicable"
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <h2>Risk Classification Thresholds</h2>
                </div>

                <p className="risk-policy-help">
                    Classification ranges must cover 0–100
                    without gaps or overlaps.
                </p>

                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th>Classification</th>
                                <th>Minimum Score</th>
                                <th>Maximum Score</th>
                            </tr>
                        </thead>

                        <tbody>
                            {configuration.thresholds.map(item => (
                                <tr key={item.level}>
                                    <td>
                                        <span
                                            className={`risk-assessment-level ${item.level.toLowerCase()}`}
                                        >
                                            {item.level}
                                        </span>
                                    </td>

                                    <td>
                                        <input
                                            aria-label={`${item.level} minimum`}
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={1}
                                            required
                                            value={item.min}
                                            onChange={event =>
                                                updateThreshold(
                                                    item.level,
                                                    "min",
                                                    event.target.value
                                                )
                                            }
                                        />
                                    </td>

                                    <td>
                                        <input
                                            aria-label={`${item.level} maximum`}
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={1}
                                            required
                                            value={item.max}
                                            onChange={event =>
                                                updateThreshold(
                                                    item.level,
                                                    "max",
                                                    event.target.value
                                                )
                                            }
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {(validationError || error) && (
                <div
                    className="risk-policy-error"
                    role="alert"
                >
                    {validationError || error}
                </div>
            )}

            <div className="risk-policy-actions">
                <button
                    type="submit"
                    className="risk-policy-primary-button"
                    disabled={submitting}
                >
                    {submitting ? "Saving..." : submitLabel}
                </button>
            </div>
        </form>
    );
}