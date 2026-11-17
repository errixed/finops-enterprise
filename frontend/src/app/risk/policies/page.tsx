"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ROUTES } from "../../../../config";
import { Icon } from "@/components/ui";
import {
    type RiskPolicy,
    type RiskRule,
    activateRiskPolicy,
    copyRiskPolicy,
    getRiskPolicies
} from "@/services/risk-policies";
import "./risk-policies-dashboard.css";

type Tab = "policies" | "versions" | "audit";

const ruleDescriptions: Record<string, {
    name: string;
    factor: string;
    condition: string;
}> = {
    "RISK-001": {
        name: "Transaction Amount Threshold",
        factor: "Transaction Amount",
        condition: "Transfer amount exceeds configured threshold"
    },
    "RISK-002": {
        name: "Recent Transfer Volume",
        factor: "Transfer Volume",
        condition: "Recent transfer volume exceeds threshold"
    },
    "RISK-003": {
        name: "Recent Transfer Volume Threshold",
        factor: "Transfer Volume",
        condition: "Recent aggregate transfer amount exceeds threshold"
    },
    "RISK-004": {
        name: "Transaction Frequency",
        factor: "Transaction Frequency",
        condition: "Transfer frequency exceeds configured threshold"
    },
    "RISK-005": {
        name: "Source Account Balance",
        factor: "Account Balance",
        condition: "Source balance violates the configured risk threshold"
    },
    "RISK-006": {
        name: "Balance Utilization",
        factor: "Balance Utilization",
        condition: "Transfer amount relative to source balance exceeds threshold"
    },
    "RISK-007": {
        name: "Account Status Risk",
        factor: "Account Status",
        condition: "Account status requires additional risk treatment"
    },
    "RISK-008": {
        name: "Client Status Risk",
        factor: "Client Status",
        condition: "Client status requires additional risk treatment"
    }
};

function formatDate(value?: string | null, time = false) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return time
        ? date.toLocaleString("en-CA", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        })
        : date.toLocaleDateString("en-CA", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
}

function PolicyBadge({ status }: { status: RiskPolicy["status"] }) {
    return (
        <span className={`rpd-badge rpd-badge-${status.toLowerCase()}`}>
            <Icon
                name={
                    status === "Active" ? "check_circle"
                        : status === "Draft" ? "edit_document"
                            : "history"
                }
                size={16}
            />
            {status}
        </span>
    );
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
        <section className="rpd-panel">
            <header className="rpd-panel-header">
                <h2>
                    <Icon name={icon} size={23} />
                    {title}
                </h2>
                {action}
            </header>
            <div className="rpd-panel-content">{children}</div>
        </section>
    );
}

function Detail({
    label,
    children
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rpd-detail-row">
            <span>{label}</span>
            <strong>{children}</strong>
        </div>
    );
}

function downloadCsv(filename: string, rows: unknown[][]) {
    const escape = (value: unknown) => {
        let text = String(value ?? "");
        if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
        return `"${text.replaceAll('"', '""')}"`;
    };

    const csv = rows
        .map(row => row.map(escape).join(","))
        .join("\r\n");

    const url = URL.createObjectURL(
        new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
    );

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function getRuleName(ruleId: string) {
    return ruleDescriptions[ruleId]?.name ?? ruleId;
}

function getCondition(rule: RiskRule, currency: string) {
    if (rule.threshold === undefined) {
        return ruleDescriptions[rule.ruleId]?.condition ??
            "Configured risk condition";
    }

    const amount = [
        "RISK-001",
        "RISK-003",
        "RISK-005"
    ].includes(rule.ruleId);

    return amount
        ? `Threshold: ${rule.threshold.toLocaleString("en-CA")} (${currency} policy)`
        : `Threshold: ${rule.threshold.toLocaleString("en-CA")}`;
}

export default function RiskPoliciesPage() {
    const [policies, setPolicies] = useState<RiskPolicy[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>("policies");
    const [currency, setCurrency] = useState<"All" | "CAD" | "USD">("All");
    const [busyId, setBusyId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => {
        setRefreshKey(value => value + 1);
    }, []);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");

        getRiskPolicies()
            .then(data => {
                if (!active) return;

                setPolicies(data);
                setSelectedId(previous => {
                    if (previous && data.some(item => item._id === previous)) {
                        return previous;
                    }

                    return data.find(item => item.status === "Active")?._id ??
                        data[0]?._id ?? null;
                });
            })
            .catch(err => {
                if (active) setError(
                    err instanceof Error ? err.message : "Unable to load policies."
                );
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => { active = false; };
    }, [refreshKey]);

    const visible = useMemo(
        () => policies
            .filter(policy => currency === "All" || policy.currency === currency)
            .sort((a, b) =>
                a.policyId.localeCompare(b.policyId) ||
                a.currency.localeCompare(b.currency) ||
                b.version - a.version
            ),
        [policies, currency]
    );

    const selected = visible.find(item => item._id === selectedId) ??
        visible[0] ?? null;

    const latestVersions = useMemo(() => {
        const latest = new Map<string, number>();
        for (const policy of policies) {
            const key = `${policy.policyId}:${policy.currency}`;
            latest.set(key, Math.max(latest.get(key) ?? 0, policy.version));
        }
        return latest;
    }, [policies]);

    function isLatest(policy: RiskPolicy) {
        return latestVersions.get(`${policy.policyId}:${policy.currency}`) ===
            policy.version;
    }

    function canActivate(policy: RiskPolicy) {
        return policy.status === "Draft" && isLatest(policy);
    }

    function canCopy(policy: RiskPolicy) {
        return isLatest(policy) && policy.status !== "Draft";
    }

    async function activate(policy: RiskPolicy) {
        if (!canActivate(policy) || busyId) return;

        if (!window.confirm(
            `Activate policy ${policy.policyId} v${policy.version} (${policy.currency})? The currently active version for this currency will be superseded.`
        )) return;

        setBusyId(policy._id);
        setError("");
        setNotice("");

        try {
            await activateRiskPolicy(policy._id);
            setNotice(`Policy v${policy.version} activated successfully.`);
            refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Activation failed.");
        } finally {
            setBusyId(null);
        }
    }

    async function copy(policy: RiskPolicy) {
        if (!canCopy(policy) || busyId) return;

        setBusyId(policy._id);
        setError("");
        setNotice("");

        try {
            const result = await copyRiskPolicy(policy);
            setSelectedId(result._id);
            setNotice(`Draft policy v${result.version} created.`);
            refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to copy policy.");
        } finally {
            setBusyId(null);
        }
    }

    function exportSelected() {
        if (!selected) return;

        downloadCsv(`risk-policy-v${selected.version}-${selected.currency}.csv`, [
            ["Policy ID", selected.policyId],
            ["Currency", selected.currency],
            ["Version", selected.version],
            ["Status", selected.status],
            ["Created By", selected.createdBy],
            ["Created At", selected.createdAt],
            ["Updated At", selected.updatedAt],
            ["Effective From", selected.effectiveFrom ?? ""],
            [],
            ["Rule ID", "Rule Name", "Points", "Threshold"],
            ...selected.rules.map(rule => [
                rule.ruleId,
                getRuleName(rule.ruleId),
                rule.points,
                rule.threshold ?? ""
            ]),
            [],
            ["Risk Level", "Minimum Score", "Maximum Score"],
            ...selected.thresholds.map(item => [
                item.level, item.min, item.max
            ])
        ]);
    }

    function exportAll() {
        downloadCsv("finops-risk-policy-versions.csv", [
            ["Policy ID", "Currency", "Version", "Status",
                "Rules", "Created By", "Created At", "Updated At",
                "Effective From", "Effective To"],
            ...visible.map(policy => [
                policy.policyId, policy.currency, policy.version,
                policy.status, policy.rules.length, policy.createdBy,
                policy.createdAt, policy.updatedAt,
                policy.effectiveFrom, policy.effectiveTo
            ])
        ]);
    }

    const versions = [...visible].sort((a, b) =>
        a.policyId.localeCompare(b.policyId) ||
        a.currency.localeCompare(b.currency) ||
        b.version - a.version
    );

    const auditEvents = policies.flatMap(policy => [
        {
            id: `${policy._id}:created`,
            at: policy.createdAt,
            action: "Policy Version Created",
            version: `v${policy.version}`,
            policy: `${policy.policyId} (${policy.currency})`,
            actor: policy.createdBy || "Not recorded",
            details: "Draft policy version created"
        },
        ...(policy.updatedAt && policy.updatedAt !== policy.createdAt
            ? [{
                id: `${policy._id}:updated`,
                at: policy.updatedAt,
                action: "Policy Record Updated",
                version: `v${policy.version}`,
                policy: `${policy.policyId} (${policy.currency})`,
                actor: "Not recorded",
                details: "Most recent stored update; intermediate edits unavailable"
            }]
            : []),
        ...(policy.effectiveFrom
            ? [{
                id: `${policy._id}:effective`,
                at: policy.effectiveFrom,
                action: "Policy Became Effective",
                version: `v${policy.version}`,
                policy: `${policy.policyId} (${policy.currency})`,
                actor: "Not recorded",
                details: "Effective-from timestamp recorded"
            }]
            : [])
    ]).sort((a, b) =>
        new Date(b.at).getTime() - new Date(a.at).getTime()
    );

    return (
        <section className="rpd-page">
            <div className="rpd-heading">
                <Icon name="description" size={29} />
                <div>
                    <h1>Rules & Policies</h1>
                    <p>
                        Manage risk policies and assessment rules. Policies are versioned
                        and rules are configured within each policy.
                    </p>
                </div>
            </div>

            <div className="rpd-toolbar">
                <nav className="rpd-inner-tabs" aria-label="Policy sections">
                    {([
                        ["policies", "Policies", "layers"],
                        ["versions", "Version History", "history"],
                        ["audit", "Audit Trail", "shield"]
                    ] as const).map(([value, label, icon]) => (
                        <button
                            type="button"
                            key={value}
                            className={tab === value ? "active" : ""}
                            onClick={() => setTab(value)}
                        >
                            <Icon name={icon} size={21} />
                            {label}
                        </button>
                    ))}
                </nav>

                <div className="rpd-toolbar-actions">
                    <select
                        value={currency}
                        onChange={event => {
                            setCurrency(event.target.value as "All" | "CAD" | "USD");
                            setSelectedId(null);
                        }}
                        aria-label="Filter policy currency"
                    >
                        <option value="All">All Currencies</option>
                        <option value="CAD">CAD</option>
                        <option value="USD">USD</option>
                    </select>

                    <Link href={ROUTES.riskPolicyNew} className="rpd-primary">
                        <Icon name="add" size={22} />
                        Create Policy
                    </Link>

                    <button type="button" onClick={exportAll}>
                        <Icon name="download" size={19} />
                        Export
                    </button>
                    <button type="button" onClick={refresh} title="Refresh policies">
                        <Icon name="refresh" size={19} />
                    </button>
                </div>
            </div>

            {error && <div className="rpd-error" role="alert">{error}</div>}
            {notice && <div className="rpd-notice" role="status">{notice}</div>}

            {tab === "policies" && (
                <>
                    <Panel title="Policy Versions" icon="layers">
                        <div className="rpd-table-scroll">
                            <table className="rpd-table">
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>Version</th>
                                        <th>Policy Family</th>
                                        <th>Currency</th>
                                        <th>Status</th>
                                        <th>Effective From</th>
                                        <th>Rules</th>
                                        <th>Last Updated</th>
                                        <th>Updated By</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={10}>Loading policies...</td></tr>
                                    ) : visible.length === 0 ? (
                                        <tr><td colSpan={10}>No policies found.</td></tr>
                                    ) : visible.map(policy => (
                                        <tr
                                            key={policy._id}
                                            className={selected?._id === policy._id ? "selected" : ""}
                                            onClick={() => setSelectedId(policy._id)}
                                        >
                                            <td>
                                                <input
                                                    type="radio"
                                                    name="selected-policy"
                                                    aria-label={`Select version ${policy.version} ${policy.currency}`}
                                                    checked={selected?._id === policy._id}
                                                    onChange={() => setSelectedId(policy._id)}
                                                />
                                            </td>
                                            <td><strong>v{policy.version}</strong></td>
                                            <td>{policy.policyId}</td>
                                            <td>{policy.currency}</td>
                                            <td><PolicyBadge status={policy.status} /></td>
                                            <td>{formatDate(policy.effectiveFrom)}</td>
                                            <td>{policy.rules.length}</td>
                                            <td>{formatDate(policy.updatedAt, true)}</td>
                                            <td>{policy.createdBy || "Not recorded"}</td>
                                            <td onClick={event => event.stopPropagation()}>
                                                <div className="rpd-row-actions">
                                                    <Link href={ROUTES.riskPolicyDetails(policy._id)}>
                                                        <Icon name="visibility" size={16} /> View
                                                    </Link>

                                                    {canCopy(policy) && (
                                                        <button
                                                            type="button"
                                                            disabled={Boolean(busyId)}
                                                            onClick={() => void copy(policy)}
                                                        >
                                                            <Icon name="content_copy" size={16} /> Copy
                                                        </button>
                                                    )}

                                                    {policy.status === "Draft" && (
                                                        <Link href={ROUTES.riskPolicyEdit(policy._id)}>
                                                            <Icon name="edit" size={16} /> Edit
                                                        </Link>
                                                    )}

                                                    {canActivate(policy) && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                disabled={Boolean(busyId)}
                                                                onClick={() => void activate(policy)}
                                                            >
                                                                <Icon name="play_circle" size={16} /> Activate
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>

                    {selected && (
                        <div className="rpd-details-grid">
                            <Panel
                                title={`Selected Policy Details — v${selected.version}`}
                                icon="description"
                            >
                                <Detail label="Policy Family">{selected.policyId}</Detail>
                                <Detail label="Currency">{selected.currency}</Detail>
                                <Detail label="Version">v{selected.version}</Detail>
                                <Detail label="Status">
                                    <PolicyBadge status={selected.status} />
                                </Detail>
                                <Detail label="Effective From">
                                    {formatDate(selected.effectiveFrom)}
                                </Detail>
                                <Detail label="Effective To">
                                    {formatDate(selected.effectiveTo)}
                                </Detail>
                                <Detail label="Created By">{selected.createdBy}</Detail>
                                <Detail label="Created On">
                                    {formatDate(selected.createdAt, true)}
                                </Detail>
                                <Detail label="Last Updated">
                                    {formatDate(selected.updatedAt, true)}
                                </Detail>
                                <Detail label="Description">
                                    Transaction risk assessment configuration for{" "}
                                    {selected.currency}, containing scoring rules and risk-level thresholds.
                                </Detail>

                                <div className="rpd-thresholds">
                                    <h3>Risk Classification Thresholds</h3>
                                    {selected.thresholds.map(item => (
                                        <div key={item.level}>
                                            <span>{item.level}</span>
                                            <strong>{item.min} – {item.max}</strong>
                                        </div>
                                    ))}
                                </div>
                            </Panel>

                            <Panel
                                title={`Rules in Policy v${selected.version} (${selected.rules.length})`}
                                icon="settings"
                                action={selected.status === "Draft" && (
                                    <Link
                                        className="rpd-add-rule"
                                        href={ROUTES.riskPolicyEdit(selected._id)}
                                    >
                                        <Icon name="add" size={19} />
                                        Configure Rules
                                    </Link>
                                )}
                            >
                                <div className="rpd-table-scroll">
                                    <table className="rpd-table rpd-rule-table">
                                        <thead>
                                            <tr>
                                                <th>Rule ID</th>
                                                <th>Rule Name</th>
                                                <th>Risk Factor</th>
                                                <th>Points</th>
                                                <th>Threshold / Condition</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selected.rules.map(rule => (
                                                <tr key={rule.ruleId}>
                                                    <td><strong>{rule.ruleId}</strong></td>
                                                    <td>{getRuleName(rule.ruleId)}</td>
                                                    <td>
                                                        {ruleDescriptions[rule.ruleId]?.factor ??
                                                            "Configured Risk Factor"}
                                                    </td>
                                                    <td className="rpd-points">+{rule.points}</td>
                                                    <td>{getCondition(rule, selected.currency)}</td>
                                                    <td>
                                                        <div className="rpd-row-actions">
                                                            <Link href={ROUTES.riskPolicyDetails(selected._id)}>
                                                                <Icon name="visibility" size={16} /> View
                                                            </Link>
                                                            {selected.status === "Draft" && (
                                                                <Link href={ROUTES.riskPolicyEdit(selected._id)}>
                                                                    <Icon name="edit" size={16} /> Edit
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="rpd-footnote">
                                    Rule names and descriptions are presentation labels.
                                    Scoring uses the selected policy's stored values.
                                    Only draft policies can be changed.
                                </p>
                            </Panel>
                        </div>
                    )}
                </>
            )}

            {tab === "versions" && (
                <Panel title="Version History" icon="history">
                    <div className="rpd-table-scroll">
                        <table className="rpd-table">
                            <thead>
                                <tr>
                                    <th>Policy Family</th>
                                    <th>Currency</th>
                                    <th>Version</th>
                                    <th>Status</th>
                                    <th>Created On</th>
                                    <th>Effective From</th>
                                    <th>Effective To</th>
                                    <th>Rules</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {versions.map(policy => (
                                    <tr key={policy._id}>
                                        <td>{policy.policyId}</td>
                                        <td>{policy.currency}</td>
                                        <td>v{policy.version}</td>
                                        <td><PolicyBadge status={policy.status} /></td>
                                        <td>{formatDate(policy.createdAt, true)}</td>
                                        <td>{formatDate(policy.effectiveFrom)}</td>
                                        <td>{formatDate(policy.effectiveTo)}</td>
                                        <td>{policy.rules.length}</td>
                                        <td>
                                            <Link href={ROUTES.riskPolicyDetails(policy._id)}>
                                                View Version
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {!versions.length && (
                                    <tr><td colSpan={9}>No policy versions available.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            )}

            {tab === "audit" && (
                <Panel title="Policy Lifecycle History" icon="shield">
                    <p className="rpd-footnote">
                        This view is reconstructed from policy creation, update, and
                        effective dates. It is not yet a complete action-by-action audit
                        log. Individual rule edits, deletions, and actors responsible
                        for updates are not retained in the current schema.
                    </p>
                    <div className="rpd-table-scroll">
                        <table className="rpd-table">
                            <thead>
                                <tr>
                                    <th>Date & Time</th>
                                    <th>Policy</th>
                                    <th>Version</th>
                                    <th>Event</th>
                                    <th>Details</th>
                                    <th>Actor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditEvents.map(event => (
                                    <tr key={event.id}>
                                        <td>{formatDate(event.at, true)}</td>
                                        <td>{event.policy}</td>
                                        <td>{event.version}</td>
                                        <td>{event.action}</td>
                                        <td>{event.details}</td>
                                        <td>{event.actor}</td>
                                    </tr>
                                ))}
                                {!auditEvents.length && (
                                    <tr><td colSpan={6}>No lifecycle records available.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            )}

            <div className="rpd-page-footer">
                <span>{visible.length} policy version(s) displayed</span>
                <button type="button" onClick={exportSelected} disabled={!selected}>
                    <Icon name="download" size={18} />
                    Export Selected Policy
                </button>
            </div>
        </section>
    );
}