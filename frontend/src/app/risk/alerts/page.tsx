"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ROUTES } from "../../../../config";
import { Icon, StatusBadge } from "@/components/ui";
import { getClients, type Client } from "@/services/clients";
import {
    getRiskAlerts,
    type RiskAlert,
    type RiskAlertFilters,
    type RiskAlertResult
} from "@/services/risk-alerts";
import "./risk-alerts.css";

const initial: RiskAlertFilters = {
    riskLevel: "",
    ruleId: "",
    status: "",
    clientId: "",
    period: "30",
    page: 1,
    pageSize: 10
};

const levels = [
    { key: "Critical", color: "#ed252b" },
    { key: "High", color: "#f48d12" },
    { key: "Medium", color: "#f3cb00" }
] as const;

function formatDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-CA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
}

function Statistic({
    title,
    value,
    icon,
    tone,
    detail
}: {
    title: string;
    value: number;
    icon: string;
    tone: string;
    detail?: string;
}) {
    return (
        <article className={`ra-stat ra-${tone}`}>
            <Icon name={icon} size={36} />
            <div>
                <span>{title}</span>
                <strong>{value.toLocaleString("en-CA")}</strong>
                {detail && <small>{detail}</small>}
            </div>
        </article>
    );
}

function Panel({
    title,
    icon,
    children,
    action
}: {
    title: string;
    icon: string;
    children: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <section className="ra-panel">
            <header className="ra-panel-heading">
                <h2><Icon name={icon} size={22} />{title}</h2>
                {action}
            </header>
            {children}
        </section>
    );
}

function AlertTrend({ data }: { data: RiskAlertResult["trend"] }) {
    const width = 630;
    const height = 205;
    const left = 35;
    const right = 14;
    const top = 14;
    const bottom = 28;
    const values = data.flatMap(day =>
        levels.map(level => day[level.key])
    );
    const maximum = Math.max(5, ...values);
    const ceiling = Math.ceil(maximum / 5) * 5;

    const x = (index: number) =>
        left + index / Math.max(1, data.length - 1) *
        (width - left - right);

    const y = (value: number) =>
        top + (1 - value / ceiling) * (height - top - bottom);

    return (
        <div className="ra-trend-wrap">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label="Daily triggered alerts by risk level for the last 30 days"
            >
                {[0, 1, 2, 3, 4].map(index => {
                    const value = Math.round(ceiling * index / 4);
                    return (
                        <g key={index}>
                            <line
                                x1={left}
                                x2={width - right}
                                y1={y(value)}
                                y2={y(value)}
                                stroke="#dae5f3"
                            />
                            <text
                                x={left - 7}
                                y={y(value) + 4}
                                fontSize="10"
                                fill="#37516f"
                                textAnchor="end"
                            >
                                {value}
                            </text>
                        </g>
                    );
                })}

                {levels.map(level => {
                    const points = data.map((day, index) =>
                        `${x(index)},${y(day[level.key])}`
                    ).join(" ");

                    const area = [
                        `${x(0)},${y(0)}`,
                        points,
                        `${x(data.length - 1)},${y(0)}`
                    ].join(" ");

                    return (
                        <g key={level.key}>
                            <polygon
                                points={area}
                                fill={level.color}
                                opacity="0.06"
                            />
                            <polyline
                                points={points}
                                fill="none"
                                stroke={level.color}
                                strokeWidth="2.7"
                                strokeLinejoin="round"
                            />
                            {data.map((day, index) => (
                                <circle
                                    key={day.date}
                                    cx={x(index)}
                                    cy={y(day[level.key])}
                                    r="2.3"
                                    fill={level.color}
                                />
                            ))}
                        </g>
                    );
                })}

                {[0, 7, 14, 21, 29].map(index => (
                    <text
                        key={index}
                        x={x(index)}
                        y={height - 6}
                        textAnchor="middle"
                        fill="#445c79"
                        fontSize="10"
                    >
                        {data[index] ? new Date(
                            `${data[index].date}T00:00:00Z`
                        ).toLocaleDateString("en-CA", {
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC"
                        }) : ""}
                    </text>
                ))}
            </svg>
            <div className="ra-chart-legend">
                {levels.map(level => (
                    <span key={level.key}>
                        <i style={{ backgroundColor: level.color }} />
                        {level.key}
                    </span>
                ))}
            </div>
        </div>
    );
}

function exportCsv(items: RiskAlert[]) {
    const headers = [
        "Alert ID",
        "Date",
        "Transaction ID",
        "Client",
        "Rule ID",
        "Risk Description",
        "Risk Level",
        "Status"
    ];

    const lines = items.map(item => [
        item.alertId,
        item.assessedAt,
        item.referenceNumber,
        item.clientName,
        item.ruleId,
        item.description,
        item.riskLevel,
        item.status
    ]);

    const escape = (value: unknown) => {
        let string = String(value ?? "");
        if (/^[=+\-@\t\r]/.test(string)) string = `'${string}`;
        return `"${string.replaceAll('"', '""')}"`;
    };

    const csv = [headers, ...lines]
        .map(row => row.map(escape).join(","))
        .join("\r\n");

    const url = URL.createObjectURL(new Blob(
        ["\uFEFF", csv],
        { type: "text/csv;charset=utf-8" }
    ));

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "finops-risk-alerts.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export default function RisksAndAlertsPage() {
    const [draft, setDraft] = useState<RiskAlertFilters>({ ...initial });
    const [filters, setFilters] = useState<RiskAlertFilters>({ ...initial });
    const [result, setResult] = useState<RiskAlertResult | null>(null);
    const [clients, setClients] = useState<Client[]>([]);
    const [selected, setSelected] = useState<Record<string, RiskAlert>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showColumns, setShowColumns] = useState(false);

    const [visibleColumns, setVisibleColumns] = useState({
        client: true,
        rule: true,
        description: true,
        risk: true,
        status: true
    });
    useEffect(() => {
        let alive = true;

        async function loadClients() {
            try {
                const first = await getClients({ page: 1, pageSize: 100 });
                const all = [...first.data];

                for (let page = 2; page <= first.pagination.totalPages; page++) {
                    const response = await getClients({
                        page,
                        pageSize: 100
                    });
                    all.push(...response.data);
                }

                if (alive) setClients(all);
            } catch { }
        }

        void loadClients();

        return () => { alive = false; };
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        setLoading(true);
        setError("");

        getRiskAlerts(filters, controller.signal)
            .then(data => {
                if (!controller.signal.aborted) setResult(data);
            })
            .catch(err => {
                if (!controller.signal.aborted) {
                    setError(err instanceof Error
                        ? err.message
                        : "Unable to load risk alerts.");
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [filters]);

    const rows = result?.data ?? [];
    const total = result?.pagination.total ?? 0;
    const page = result?.pagination.page ?? 1;
    const pages = result?.pagination.totalPages ?? 0;
    const pageSize = result?.pagination.pageSize ?? 10;

    const allSelected = rows.length > 0 &&
        rows.every(row => Boolean(selected[row.alertId]));

    const ruleOptions = useMemo(
        () => result?.ruleOptions ?? [],
        [result]
    );

    function updateFilter(
        key: keyof RiskAlertFilters,
        value: string
    ) {
        setDraft(previous => ({ ...previous, [key]: value }));
    }

    function apply() {
        setFilters({ ...draft, page: 1 });
    }

    function clear() {
        setDraft({ ...initial });
        setFilters({ ...initial });
        setSelected({});
    }

    function changePage(next: number) {
        setFilters(previous => ({ ...previous, page: next }));
    }

    const selectedRows = Object.values(selected);

    const paginationButtons = Array.from(
        { length: Math.min(5, pages) },
        (_, index) => {
            const start = Math.max(1, Math.min(page - 2, pages - 4));
            return start + index;
        }
    );

    return (
        <section className="ra-page">
            <div className="ra-metrics">
                <Statistic
                    title="Active Alerts"
                    icon="warning"
                    tone="red"
                    value={result?.summary.active ?? 0}
                    detail="Open and under review"
                />
                <Statistic
                    title="In Review"
                    icon="hourglass_top"
                    tone="amber"
                    value={result?.summary.inReview ?? 0}
                />
                <Statistic
                    title="Blocked Transactions"
                    icon="block"
                    tone="red"
                    value={result?.summary.blocked ?? 0}
                />
                <Statistic
                    title="Resolved"
                    icon="check_circle"
                    tone="green"
                    value={result?.summary.resolved ?? 0}
                    detail="Completed transactions"
                />
            </div>

            <form
                className="ra-filters"
                onSubmit={event => {
                    event.preventDefault();
                    apply();
                }}
            >
                <label>
                    <span>Risk Level</span>
                    <select
                        value={draft.riskLevel ?? ""}
                        onChange={event => updateFilter(
                            "riskLevel", event.target.value
                        )}
                    >
                        <option value="">All Levels</option>
                        {["Low", "Medium", "High", "Critical"].map(value => (
                            <option key={value}>{value}</option>
                        ))}
                    </select>
                </label>

                <label>
                    <span>Rule</span>
                    <select
                        value={draft.ruleId ?? ""}
                        onChange={event => updateFilter(
                            "ruleId", event.target.value
                        )}
                    >
                        <option value="">All Rules</option>
                        {ruleOptions.map(rule => (
                            <option key={rule} value={rule}>{rule}</option>
                        ))}
                    </select>
                </label>

                <label>
                    <span>Alert Status</span>
                    <select
                        value={draft.status ?? ""}
                        onChange={event => updateFilter(
                            "status", event.target.value
                        )}
                    >
                        <option value="">All Statuses</option>
                        {["Open", "In Review", "Approved", "Blocked", "Resolved"].map(value => (
                            <option key={value}>{value}</option>
                        ))}
                    </select>
                </label>

                <label>
                    <span>Client</span>
                    <select
                        value={draft.clientId ?? ""}
                        onChange={event => updateFilter(
                            "clientId", event.target.value
                        )}
                    >
                        <option value="">All Clients</option>
                        {clients.map(client => (
                            <option key={client.clientId} value={client.clientId}>
                                {client.companyName}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    <span>Date Range</span>
                    <select
                        value={draft.period ?? "30"}
                        onChange={event => updateFilter(
                            "period", event.target.value
                        )}
                    >
                        <option value="7">Last 7 Days</option>
                        <option value="30">Last 30 Days</option>
                        <option value="90">Last 90 Days</option>
                        <option value="365">Last 12 Months</option>
                        <option value="all">All Time</option>
                    </select>
                </label>

                <button type="submit" className="ra-search">
                    <Icon name="search" size={19} />
                    Search
                </button>
                <button type="button" className="ra-clear" onClick={clear}>
                    <Icon name="close" size={18} />
                    Clear
                </button>
            </form>

            <Panel
                title={`Risk Alerts (${total.toLocaleString("en-CA")})`}
                icon="notifications"
                action={
                    <div className="ra-header-actions">
                        <button
                            type="button"
                            onClick={() => exportCsv(
                                selectedRows.length ? selectedRows : rows
                            )}
                        >
                            <Icon name="download" size={18} />
                            Export {selectedRows.length ? `(${selectedRows.length})` : "Page"}
                        </button>
                        <div className="ra-columns-control">
                            <button
                                type="button"
                                aria-expanded={showColumns}
                                onClick={() => setShowColumns(value => !value)}
                            >
                                <Icon name="view_column" size={18} />
                                Columns
                            </button>

                            {showColumns && (
                                <div className="ra-columns-menu">
                                    {([
                                        ["client", "Client"],
                                        ["rule", "Rule ID"],
                                        ["description", "Risk Description"],
                                        ["risk", "Risk Level"],
                                        ["status", "Status"]
                                    ] as const).map(([key, label]) => (
                                        <label key={key}>
                                            <input
                                                type="checkbox"
                                                checked={visibleColumns[key]}
                                                onChange={event => setVisibleColumns(
                                                    previous => ({
                                                        ...previous,
                                                        [key]: event.target.checked
                                                    })
                                                )}
                                            />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                }
            >
                {error && <p role="alert" className="ra-error">{error}</p>}

                <div className="ra-table-scroll">
                    <table className="ra-table">
                        <thead>
                            <tr>
                                <th>
                                    <input
                                        type="checkbox"
                                        aria-label="Select visible alerts"
                                        checked={allSelected}
                                        onChange={event => setSelected(previous => {
                                            const next = { ...previous };

                                            for (const row of rows) {
                                                if (event.target.checked) next[row.alertId] = row;
                                                else delete next[row.alertId];
                                            }

                                            return next;
                                        })}
                                    />
                                </th>
                                <th>Alert ID</th>
                                <th>Date & Time</th>
                                <th>Transaction ID</th>

                                {visibleColumns.client && <th>Client</th>}
                                {visibleColumns.rule && <th>Rule (ID)</th>}
                                {visibleColumns.description && <th>Risk Description</th>}
                                {visibleColumns.risk && <th>Risk Level</th>}
                                {visibleColumns.status && <th>Status</th>}

                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={
                                    5 + Object.values(visibleColumns).filter(Boolean).length
                                } className="ra-empty">
                                    Loading risk alerts...
                                </td></tr>
                            ) : !rows.length ? (
                                <tr><td colSpan={
                                    5 + Object.values(visibleColumns).filter(Boolean).length
                                } className="ra-empty">
                                    No alerts match your filters.
                                </td></tr>
                            ) : rows.map(alert => (
                                <tr key={alert.alertId}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            aria-label={`Select alert ${alert.alertId}`}
                                            checked={Boolean(selected[alert.alertId])}
                                            onChange={event => setSelected(previous => {
                                                const next = { ...previous };

                                                if (event.target.checked) next[alert.alertId] = alert;
                                                else delete next[alert.alertId];

                                                return next;
                                            })}
                                        />
                                    </td>
                                    <td>
                                        <Link href={ROUTES.riskAssessmentDetails(alert.assessmentId)}>
                                            {alert.alertId}
                                        </Link>
                                    </td>
                                    <td>{formatDate(alert.assessedAt)}</td>
                                    <td>
                                        <Link href={ROUTES.transactionDetails(alert.transactionId)}>
                                            {alert.referenceNumber}
                                        </Link>
                                    </td>
                                    {visibleColumns.client && (
                                        <td>{alert.clientName}</td>
                                    )}

                                    {visibleColumns.rule && (
                                        <td>{alert.ruleId}</td>
                                    )}

                                    {visibleColumns.description && (
                                        <td title={alert.description} className="ra-description">
                                            {alert.description}
                                        </td>
                                    )}

                                    {visibleColumns.risk && (
                                        <td>
                                            <StatusBadge status={alert.riskLevel} />
                                        </td>
                                    )}

                                    {visibleColumns.status && (
                                        <td>
                                            <StatusBadge status={alert.status} />
                                        </td>
                                    )}
                                    <td>
                                        <div className="ra-actions">
                                            <Link
                                                title="View risk assessment"
                                                aria-label={`View assessment for ${alert.alertId}`}
                                                href={ROUTES.riskAssessmentDetails(alert.assessmentId)}
                                            >
                                                <Icon name="visibility" size={19} />
                                            </Link>
                                            <Link
                                                title="View transaction details"
                                                aria-label={`View transaction for ${alert.alertId}`}
                                                href={ROUTES.transactionDetails(alert.transactionId)}
                                            >
                                                <Icon name="more_horiz" size={19} />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <footer className="ra-pagination">
                    <div>
                        <label htmlFor="ra-page-size">Rows per page:</label>
                        <select
                            id="ra-page-size"
                            value={pageSize}
                            onChange={event => {
                                const size = Number(event.target.value);
                                setDraft(previous => ({
                                    ...previous,
                                    pageSize: size
                                }));
                                setFilters(previous => ({
                                    ...previous,
                                    pageSize: size,
                                    page: 1
                                }));
                            }}
                        >
                            {[5, 10, 20, 50, 100].map(value => (
                                <option key={value} value={value}>{value}</option>
                            ))}
                        </select>
                        <span>
                            {total ? (page - 1) * pageSize + 1 : 0}
                            {" – "}
                            {Math.min(page * pageSize, total)} of {total}
                        </span>
                    </div>

                    <nav aria-label="Risk alert pages">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => changePage(page - 1)}
                        >
                            <Icon name="chevron_left" size={20} />
                        </button>

                        {paginationButtons.map(number => (
                            <button
                                key={number}
                                type="button"
                                aria-current={number === page ? "page" : undefined}
                                className={number === page ? "active" : ""}
                                onClick={() => changePage(number)}
                            >
                                {number}
                            </button>
                        ))}

                        <button
                            type="button"
                            disabled={page >= pages}
                            onClick={() => changePage(page + 1)}
                        >
                            <Icon name="chevron_right" size={20} />
                        </button>
                    </nav>
                </footer>
            </Panel>

            <div className="ra-analytics">
                <Panel title="Triggered Risk Rules" icon="balance">
                    <div className="ra-rule-table-scroll">
                        <table className="ra-rule-table">
                            <thead>
                                <tr>
                                    <th>Rule ID</th>
                                    <th>Rule Name / Trigger Reason</th>
                                    <th>Triggers</th>
                                    <th>% of Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(result?.rules ?? []).map((rule, index) => (
                                    <tr key={rule.ruleId}>
                                        <td>{rule.ruleId}</td>
                                        <td>{rule.ruleName}</td>
                                        <td>
                                            <div className="ra-rule-bar">
                                                <strong>{rule.count}</strong>
                                                <span>
                                                    <i style={{
                                                        width: `${rule.count /
                                                            Math.max(1, result?.rules[0]?.count ?? 1) * 100}%`,
                                                        backgroundColor: [
                                                            "#ec252b", "#f88913", "#ffae06",
                                                            "#f9cd00", "#ffe02c"
                                                        ][index % 5]
                                                    }} />
                                                </span>
                                            </div>
                                        </td>
                                        <td>{total ? (rule.count / total * 100).toFixed(1) : "0.0"}%</td>
                                    </tr>
                                ))}

                                {!result?.rules.length && (
                                    <tr><td colSpan={4} className="ra-empty">
                                        No triggered rules.
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Panel>

                <Panel title="Alerts Trend by Risk Level (Last 30 Days)" icon="trending_up">
                    {result && <AlertTrend data={result.trend} />}
                </Panel>
            </div>
        </section>
    );
}