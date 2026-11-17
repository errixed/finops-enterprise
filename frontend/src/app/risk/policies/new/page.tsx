"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROUTES } from "../../../../../config";
import { Icon } from "@/components/ui";
import {
    type RiskPolicy,
    type RiskRule,
    type RiskThreshold,
    type PolicyCurrency,
    createRiskPolicy,
    getRiskPolicies
} from "@/services/risk-policies";
import { validatePolicyConfiguration } from "@/components/risk/RiskPolicyEditor";
import CustomRulesManager from "@/components/risk/CustomRulesManager";
import "./create-policy.css";

type Step = 1 | 2 | 3;
type RuleKey = "points" | "threshold";

const DEFAULT_RULES: RiskRule[] = [
    { ruleId: "RISK-001", points: 15, threshold: 10000 },
    { ruleId: "RISK-002", points: 20, threshold: 50000 },
    { ruleId: "RISK-003", points: 25, threshold: 100000 },
    { ruleId: "RISK-004", points: 15, threshold: 5 },
    { ruleId: "RISK-005", points: 20, threshold: 100000 },
    { ruleId: "RISK-006", points: 15, threshold: 50 },
    { ruleId: "RISK-007", points: 30 },
    { ruleId: "RISK-008", points: 30 }
];

const DEFAULT_THRESHOLDS: RiskThreshold[] = [
    { level: "Low", min: 0, max: 24 },
    { level: "Medium", min: 25, max: 49 },
    { level: "High", min: 50, max: 74 },
    { level: "Critical", min: 75, max: 100 }
];

const RULES: Record<string, {
    name: string;
    description: string;
    unit: string;
    monetary: boolean;
}> = {
    "RISK-001": {
        name: "Transfer Amount Threshold 1",
        description: "Transaction amount meets or exceeds the first limit",
        unit: "currency units",
        monetary: true
    },
    "RISK-002": {
        name: "Transfer Amount Threshold 2",
        description: "Transaction amount meets or exceeds the second limit",
        unit: "currency units",
        monetary: true
    },
    "RISK-003": {
        name: "Transfer Amount Threshold 3",
        description: "Transaction amount meets or exceeds the third limit",
        unit: "currency units",
        monetary: true
    },
    "RISK-004": {
        name: "Recent Transaction Count",
        description: "Number of recent transactions exceeds a limit",
        unit: "transactions",
        monetary: false
    },
    "RISK-005": {
        name: "Recent Transfer Volume",
        description: "Recent total transfer volume exceeds a limit",
        unit: "currency units",
        monetary: true
    },
    "RISK-006": {
        name: "Percentage of Source Balance",
        description: "Transfer uses too much of the source account balance",
        unit: "%",
        monetary: false
    },
    "RISK-007": {
        name: "Inactive or Suspended Client",
        description: "A participating client is inactive or suspended",
        unit: "condition",
        monetary: false
    },
    "RISK-008": {
        name: "Frozen or Closed Account",
        description: "A participating account is frozen or closed",
        unit: "condition",
        monetary: false
    }
};

const STEPS = [
    "Policy Information",
    "Configure Rules",
    "Review & Create"
] as const;

function localDate() {
    const now = new Date();
    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("-");
}

function formatDate(value: string) {
    if (!value) return "—";
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-CA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    });
}

function policyIdentifier(name: string, currency: PolicyCurrency) {
    const slug = name
        .normalize("NFKD")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 33)
        .replace(/-+$/g, "");

    return `RISK-POLICY-${slug || "CUSTOM"}-${currency}`;
}
function indicativeRiskLevel(
    points: number,
    thresholds: RiskThreshold[]
): RiskThreshold["level"] | "Unclassified" {
    const match = thresholds.find(
        threshold =>
            points >= threshold.min &&
            points <= threshold.max
    );

    return match?.level ?? "Unclassified";
}
function ruleCondition(rule: RiskRule, currency: string) {
    const info = RULES[rule.ruleId];

    if (!info) return "Unknown rule";
    if (rule.threshold === undefined) return info.description;

    if (info.monetary) {
        return `≥ ${rule.threshold.toLocaleString("en-CA")} ${currency}`;
    }

    if (rule.ruleId === "RISK-006") {
        return `≥ ${rule.threshold}% of source balance`;
    }

    return `≥ ${rule.threshold} transactions`;
}

function Panel({
    title,
    icon,
    action,
    children
}: {
    title: string;
    icon: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="cp-panel">
            <header className="cp-panel-header">
                <h2>
                    <Icon name={icon} size={24} />
                    {title}
                </h2>
                {action}
            </header>
            <div className="cp-panel-body">{children}</div>
        </section>
    );
}

function Row({
    label,
    children
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="cp-detail-row">
            <span>{label}</span>
            <strong>{children}</strong>
        </div>
    );
}

export default function NewRiskPolicyPage() {
    const router = useRouter();

    const [step, setStep] = useState<Step>(1);
    const [policies, setPolicies] = useState<RiskPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [policyName, setPolicyName] = useState(
        "Transaction Risk Assessment Policy"
    );
    const [description, setDescription] = useState("");
    const [currency, setCurrency] = useState<PolicyCurrency>("CAD");
    const [baseId, setBaseId] = useState("");
    const [effectiveDate, setEffectiveDate] = useState(localDate());

    const [rules, setRules] = useState<RiskRule[]>(
        () => structuredClone(DEFAULT_RULES)
    );
    const [customRules, setCustomRules] = useState<RiskRule[]>([]);

    const policyRules = useMemo(
        () => [...rules, ...customRules],
        [rules, customRules]
    );
    const [thresholds, setThresholds] = useState<RiskThreshold[]>(
        () => structuredClone(DEFAULT_THRESHOLDS)
    );

    const submitting = useRef(false);

    useEffect(() => {
        let active = true;

        getRiskPolicies()
            .then(data => {
                if (!active) return;

                setPolicies(data);
            })
            .catch(err => {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load policy versions."
                    );
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const baseOptions = useMemo(
        () => [...policies]
            .filter(policy => policy.currency === currency)
            .sort((a, b) =>
                a.policyId.localeCompare(b.policyId) ||
                b.version - a.version
            ),
        [policies, currency]
    );

    const base = baseOptions.find(policy => policy._id === baseId) ?? null;

    const policyId = useMemo(
        () => base?.policyId ?? policyIdentifier(policyName, currency),
        [base, policyName, currency]
    );

    const latest = useMemo(
        () => policies
            .filter(policy =>
                policy.policyId === policyId &&
                policy.currency === currency
            )
            .reduce<RiskPolicy | null>(
                (current, item) =>
                    !current || item.version > current.version ? item : current,
                null
            ),
        [policies, policyId, currency]
    );

    const newVersion = (latest?.version ?? 0) + 1;

    const totalPoints = policyRules.reduce(
        (sum, rule) => sum + rule.points,
        0
    );
    function chooseBase(id: string) {
        setBaseId(id);
        setError("");

        if (!id) {
            setRules(structuredClone(DEFAULT_RULES));
            setCustomRules([]);
            setThresholds(structuredClone(DEFAULT_THRESHOLDS));
            return;
        }

        const selected = policies.find(policy => policy._id === id);

        if (selected) {
            setRules(structuredClone(DEFAULT_RULES));

            setCustomRules(
                structuredClone(
                    selected.rules.filter(rule =>
                        rule.ruleId.startsWith("CUSTOM-")
                    )
                )
            );

            setThresholds(structuredClone(selected.thresholds));
            setPolicyName(selected.policyName ?? selected.policyId);
            setDescription(selected.description ?? "");
        }
    }
    function changeCurrency(value: PolicyCurrency) {
        setCurrency(value);
        setBaseId("");
        setRules(structuredClone(DEFAULT_RULES));
        setCustomRules([]);
        setThresholds(structuredClone(DEFAULT_THRESHOLDS));
        setError("");
    }
    function updateRule(ruleId: string, key: RuleKey, raw: string) {
        const value = raw === "" ? 0 : Number(raw);

        setRules(previous =>
            previous.map(rule =>
                rule.ruleId === ruleId
                    ? { ...rule, [key]: value }
                    : rule
            )
        );

        setError("");
    }
    
    function resetRules() {
        if (!window.confirm("Restore the standard risk rules and scoring ranges?")) {
            return;
        }

        setRules(structuredClone(DEFAULT_RULES));
        setThresholds(structuredClone(DEFAULT_THRESHOLDS));
        setError("");
    }

    function validateInformation() {
        if (!policyName.trim()) {
            return "Enter a policy name.";
        }

        if (policyName.length > 120) {
            return "Policy name cannot exceed 120 characters.";
        }

        if (description.length > 1000) {
            return "Description cannot exceed 1000 characters.";
        }

        if (!effectiveDate) {
            return "Select a planned effective date.";
        }

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ||
            Number.isNaN(Date.parse(`${effectiveDate}T00:00:00Z`))
        ) {
            return "Enter a valid planned effective date.";
        }

        if (!base && latest) {
            return "A policy family already exists with this name. Select a base version to create a new draft version.";
        }

        if (base && latest && base.version !== latest.version) {
            return "Select the latest version of this policy family as the base.";
        }

        return null;
    }

    function next() {
        setError("");

        if (step === 1) {
            const issue = validateInformation();

            if (issue) {
                setError(issue);
                return;
            }

            setStep(2);
            return;
        }

        if (step === 2) {
            const issue = validatePolicyConfiguration({
                rules: policyRules,
                thresholds
            });

            if (issue) {
                setError(issue);
                return;
            }

            setStep(3);
        }
    }

    async function create() {
        if (submitting.current || saving) return;

        const informationError = validateInformation();
        const configurationError = validatePolicyConfiguration({
            rules: policyRules,
            thresholds
        })

        if (informationError || configurationError) {
            setError(informationError ?? configurationError ?? "");
            return;
        }

        submitting.current = true;
        setSaving(true);
        setError("");

        try {
            const created = await createRiskPolicy({
                policyId,
                currency,
                policyName: policyName.trim(),
                description: description.trim(),
                plannedEffectiveFrom: effectiveDate,
                rules: policyRules,
                thresholds
            });

            router.push(ROUTES.riskPolicyDetails(created._id));
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to create draft policy."
            );
        } finally {
            setSaving(false);
            submitting.current = false;
        }
    }

    return (
        <div className="cp-page">
            <nav className="cp-breadcrumb" aria-label="Breadcrumb">
                <Link href={ROUTES.riskPolicies}>Rules & Policies</Link>
                <Icon name="chevron_right" size={18} />
                <strong>Create Policy</strong>
            </nav>

            <div className="cp-heading">
                <div className="cp-title">
                    <Icon name="note_add" size={38} />
                    <div>
                        <h1>Create Policy</h1>
                        <strong>Step {step} of 3: {STEPS[step - 1]}</strong>
                    </div>
                </div>

                <nav className="cp-progress" aria-label="Policy creation steps">
                    {STEPS.map((label, index) => {
                        const number = (index + 1) as Step;
                        const complete = number < step;

                        return (
                            <div className="cp-progress-item" key={label}>
                                {index > 0 && (
                                    <Icon name="arrow_forward" size={21} />
                                )}

                                <button
                                    type="button"
                                    className={
                                        number === step
                                            ? "active"
                                            : complete ? "complete" : ""
                                    }
                                    disabled={number > step}
                                    onClick={() => {
                                        if (number < step) {
                                            setStep(number);
                                            setError("");
                                        }
                                    }}
                                    aria-current={number === step ? "step" : undefined}
                                >
                                    <span className="cp-progress-number">
                                        {complete
                                            ? <Icon name="check" size={18} />
                                            : number}
                                    </span>
                                    <span>{label}</span>
                                </button>
                            </div>
                        );
                    })}
                </nav>
            </div>

            <p className="cp-description">
                {step === 1
                    ? "Define a risk assessment policy by providing its information and selecting a base version."
                    : step === 2
                        ? "Configure the eight standard risk rules, their point contributions, and the risk classification thresholds."
                        : "Review the complete policy configuration before creating it as a draft."}
            </p>

            {error && (
                <div className="cp-error" role="alert">
                    <Icon name="error" size={20} />
                    {error}
                </div>
            )}

            {step === 1 && (
                <Panel title="Policy Information" icon="settings">
                    <div className="cp-information-grid">
                        <div className="cp-fields">
                            <label className="cp-field">
                                <span>Policy Name <em>*</em></span>
                                <input
                                    value={policyName}
                                    maxLength={120}
                                    onChange={event => {
                                        setPolicyName(event.target.value);
                                        setError("");
                                    }}
                                />
                            </label>

                            <label className="cp-field">
                                <span>Currency <em>*</em></span>
                                <select
                                    value={currency}
                                    onChange={event =>
                                        changeCurrency(event.target.value as PolicyCurrency)
                                    }
                                >
                                    <option value="CAD">CAD — Canadian Dollar</option>
                                    <option value="USD">USD — US Dollar</option>
                                </select>
                            </label>

                            <label className="cp-field">
                                <span>Base Version (Copy From) <em>*</em></span>
                                <select
                                    value={baseId}
                                    disabled={loading}
                                    onChange={event => chooseBase(event.target.value)}
                                >
                                    <option value="">— None (First Policy) —</option>
                                    {baseOptions.map(policy => (
                                        <option key={policy._id} value={policy._id}>
                                            {policy.policyId} — v{policy.version} ({policy.status})
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="cp-inline-info">
                                <Icon name="info" size={18} />
                                {base
                                    ? `Rules and scoring ranges copied from v${base.version}.`
                                    : "No base selected. The initial eight standard risk rules will be used."}
                            </div>

                            <label className="cp-field">
                                <span>New Version <em>*</em></span>
                                <input value={`v${newVersion}`} readOnly />
                            </label>

                            <label className="cp-field">
                                <span>Policy ID</span>
                                <input value={policyId} readOnly />
                            </label>

                            <label className="cp-field">
                                <span>Planned Effective From <em>*</em></span>
                                <input
                                    type="date"
                                    value={effectiveDate}
                                    onChange={event => {
                                        setEffectiveDate(event.target.value);
                                        setError("");
                                    }}
                                />
                            </label>
                        </div>

                        <label className="cp-description-field">
                            <span>Description</span>
                            <textarea
                                value={description}
                                rows={11}
                                maxLength={1000}
                                placeholder="Describe the purpose, scope, and changes included in this policy."
                                onChange={event => setDescription(event.target.value)}
                            />
                            <small>{description.length} / 1000</small>
                        </label>
                    </div>
                </Panel>
            )}

            {step === 2 && (
                <>
                    <Panel
                        title={`Risk Rules Configuration — Policy v${newVersion} (Draft)`}
                        icon="settings"
                        action={
                            <div className="cp-panel-actions">
                                <button type="button" onClick={resetRules}>
                                    <Icon name="restart_alt" size={19} />
                                    Reset to Defaults
                                </button>
                            </div>
                        }
                    >
                        <div className="cp-table-scroll">

                            <table className="cp-table cp-config-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Rule ID</th>
                                        <th>Rule Name</th>
                                        <th>Risk Factor (Points)</th>
                                        <th>Risk Level</th>
                                        <th>Threshold / Condition</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {rules.map((rule, index) => {
                                        const indicativeLevel = indicativeRiskLevel(
                                            rule.points,
                                            thresholds
                                        );

                                        return (
                                            <tr key={rule.ruleId}>
                                                <td>{index + 1}</td>

                                                <td className="cp-rule-id">
                                                    {rule.ruleId}
                                                </td>

                                                <td>
                                                    {RULES[rule.ruleId]?.name ?? rule.ruleId}
                                                </td>

                                                <td>
                                                    <input
                                                        className="cp-points-input"
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        step={1}
                                                        value={rule.points}
                                                        aria-label={`${rule.ruleId} points`}
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
                                                    <span
                                                        className={`cp-level cp-level-${indicativeLevel.toLowerCase()}`}
                                                        title="Indicative classification of this rule's individual contribution"
                                                    >
                                                        {indicativeLevel}
                                                    </span>
                                                </td>

                                                <td>
                                                    {rule.threshold !== undefined ? (
                                                        <div className="cp-threshold-edit">
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                max={
                                                                    rule.ruleId === "RISK-006"
                                                                        ? 100
                                                                        : undefined
                                                                }
                                                                step={1}
                                                                value={rule.threshold}
                                                                aria-label={`${rule.ruleId} threshold`}
                                                                onChange={event =>
                                                                    updateRule(
                                                                        rule.ruleId,
                                                                        "threshold",
                                                                        event.target.value
                                                                    )
                                                                }
                                                            />

                                                            <span>
                                                                {RULES[rule.ruleId]?.unit}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span>
                                                            {RULES[rule.ruleId]?.description}
                                                        </span>
                                                    )}
                                                </td>

                                                <td>
                                                    <span className="cp-included">
                                                        <Icon name="check_circle" size={17} />
                                                        Included
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                        </div>
                    </Panel>

                    <CustomRulesManager
                        selected={customRules}
                        onChange={setCustomRules}
                    />

                    <div className="cp-inline-info">
                        <Icon name="info" size={20} />
                        All eight standard risk rules are included in this policy.
                        You can configure their point contributions and supported thresholds.
                        Risk Level indicates the individual rule's contribution under the
                        configured scoring ranges. The final transaction risk level is
                        calculated from all triggered rules.
                    </div>
                </>
            )}

            {step === 3 && (
                <div className="cp-review-grid">
                    <div className="cp-review-stack">
                        <Panel title="Policy Summary" icon="description">
                            <Row label="Policy Name">{policyName}</Row>
                            <Row label="Policy ID">{policyId}</Row>
                            <Row label="Version">
                                v{newVersion} <span className="cp-draft">Draft</span>
                            </Row>
                            <Row label="Currency">{currency}</Row>
                            <Row label="Base Version">
                                {base ? `v${base.version}` : "None (First Policy)"}
                            </Row>
                            <Row label="Planned Effective From">
                                {formatDate(effectiveDate)}
                            </Row>
                            <Row label="Description">
                                {description || "No description provided"}
                            </Row>
                        </Panel>

                        <Panel title="Creation Details" icon="info">
                            <Row label="Rules Included">
                                {policyRules.length} ({rules.length} seeded + {customRules.length} custom)
                            </Row>
                            <Row label="Total Rule Points (Uncapped)">
                                {totalPoints}
                            </Row>
                            <Row label="Status After Creation">
                                <span className="cp-draft">Draft</span>
                            </Row>

                            <div className="cp-inline-info">
                                <Icon name="info" size={19} />
                                The new policy will be saved as a draft. It can be reviewed,
                                edited, and activated separately. Its actual effective date
                                is set when activated.
                            </div>
                        </Panel>
                    </div>

                    <div className="cp-review-stack">
                        <Panel title="Configured Risk Rules" icon="layers">
                            <div className="cp-table-scroll">
                                <table className="cp-table cp-review-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Rule ID</th>
                                            <th>Rule Name</th>
                                            <th>Points</th>
                                            <th>Threshold / Condition</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {policyRules.map((rule, index) => (
                                            <tr key={rule.ruleId}>
                                                <td>{index + 1}</td>
                                                <td className="cp-rule-id">{rule.ruleId}</td>
                                                <td>{rule.name ?? RULES[rule.ruleId]?.name ?? rule.ruleId}</td>
                                                <td>
                                                    <span className="cp-point-badge">
                                                        {rule.points}
                                                    </span>
                                                </td>
                                                <td>
                                                    {rule.ruleId.startsWith("CUSTOM-")
                                                        ? `${rule.field} ${rule.operator} ${String(rule.value)}`
                                                        : ruleCondition(rule, currency)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>

                        <Panel title="Risk Scoring (Overall Transaction Risk Level)" icon="bar_chart">
                            <div className="cp-scoring-grid">
                                <div className="cp-table-scroll">
                                    <table className="cp-table cp-score-table">
                                        <thead>
                                            <tr>
                                                <th>Risk Score Range</th>
                                                <th>Risk Level</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {thresholds.map(item => (
                                                <tr key={item.level}>
                                                    <td>{item.min} – {item.max}</td>
                                                    <td>
                                                        <span className={`cp-level cp-level-${item.level.toLowerCase()}`}>
                                                            {item.level}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="cp-inline-info">
                                    <Icon name="info" size={21} />
                                    Risk classification uses the configured score ranges.
                                    Individual rule contributions are capped at an overall
                                    score of 100 by the risk engine.
                                </div>
                            </div>
                        </Panel>
                    </div>
                </div>
            )}

            <footer className="cp-footer">
                <div>
                    {step > 1 && (
                        <button
                            type="button"
                            className="cp-secondary"
                            disabled={saving}
                            onClick={() => {
                                setStep((step - 1) as Step);
                                setError("");
                            }}
                        >
                            <Icon name="arrow_back" size={20} />
                            Back: {STEPS[step - 2]}
                        </button>
                    )}
                </div>

                <div>
                    <Link href={ROUTES.riskPolicies} className="cp-secondary">
                        Cancel
                    </Link>

                    {step < 3 ? (
                        <button
                            type="button"
                            className="cp-primary"
                            onClick={next}
                            disabled={loading}
                        >
                            {step === 1
                                ? "Next: Configure Rules"
                                : "Next: Review & Create"}
                            <Icon name="arrow_forward" size={21} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="cp-primary"
                            disabled={saving}
                            onClick={() => void create()}
                        >
                            <Icon name="check" size={20} />
                            {saving ? "Creating Draft..." : "Create Policy (Draft)"}
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
}