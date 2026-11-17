"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ROUTES } from "../../../../config";
import { Icon, StatusBadge } from "@/components/ui";
import { getClients, type Client } from "@/services/clients";
import {
    type DirectoryTransaction,
    type DirectoryFilters,
    type TransactionHistoryResult,
    type TransactionDetails,
    type TransactionDocumentHistoryEvent,
    getTransactionHistory,
    getTransaction,
    getTransactionDocumentHistory
} from "@/services/transactions";
import {
    getRiskAssessment,
    type RiskAssessmentDetails
} from "@/services/risk-assessments";
import {
    getApprovalWorkflow,
    getApprovalDecisions,
    getWorkflowActors,
    type ApprovalWorkflow,
    type WorkflowDecision,
    type WorkflowActor
} from "@/services/approval-workflows";
import "./transaction-history.css";

type HistoryTab = "audit" | "approvals" | "statuses";

type EventRow = {
    id: string;
    timestamp: string;
    event: string;
    details: string;
    actor: string;
    category: "transaction" | "risk" | "approval" | "document";
};

const pageSizes = [5, 10, 20, 50, 100];

function dateTime(value?: string | null) {
    if (!value) return "—";
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

function dateOnly(value?: string | null) {
    if (!value) return "—";
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleDateString("en-CA", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
}

function money(minor: number | string, currency: string) {
    try {
        const value = BigInt(minor);
        const whole = value / BigInt(100);
        const cents = String(value % BigInt(100)).padStart(2, "0");

        return `${whole.toLocaleString("en-CA")}.${cents} ${currency}`;
    } catch {
        return "—";
    }
}

function getPeriod(value: string): Pick<DirectoryFilters, "dateFrom" | "dateTo"> {
    const now = new Date();

    if (value === "all") return {};

    const from = new Date(now);

    if (value === "7") from.setDate(from.getDate() - 7);
    if (value === "30") from.setDate(from.getDate() - 30);
    if (value === "90") from.setDate(from.getDate() - 90);
    if (value === "365") from.setDate(from.getDate() - 365);

    return {
        dateFrom: from.toISOString().slice(0, 10),
        dateTo: now.toISOString().slice(0, 10)
    };
}

function Stat({
    title,
    value,
    icon,
    tone
}: {
    title: string;
    value: string;
    icon: string;
    tone: string;
}) {
    return (
        <article className={`th-stat th-${tone}`}>
            <Icon name={icon} size={29} />
            <div>
                <span>{title}</span>
                <strong>{value}</strong>
            </div>
        </article>
    );
}

function InfoRow({
    label,
    children
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="th-info-row">
            <span>{label}</span>
            <strong>{children}</strong>
        </div>
    );
}

export default function TransactionHistoryPage() {
    const [period, setPeriod] = useState("all");
    const [search, setSearch] = useState("");
    const [clientId, setClientId] = useState("");
    const [type, setType] = useState("");
    const [status, setStatus] = useState("");
    const [approval, setApproval] = useState("");
    const [risk, setRisk] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [clients, setClients] = useState<Client[]>([]);
    const [result, setResult] = useState<TransactionHistoryResult | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [details, setDetails] = useState<TransactionDetails | null>(null);
    const [assessment, setAssessment] = useState<RiskAssessmentDetails | null>(null);
    const [workflow, setWorkflow] = useState<ApprovalWorkflow | null>(null);
    const [decisions, setDecisions] = useState<WorkflowDecision[]>([]);
    const [documentEvents, setDocumentEvents] = useState<TransactionDocumentHistoryEvent[]>([]);
    const [actors, setActors] = useState<WorkflowActor[]>([]);
    const [tab, setTab] = useState<HistoryTab>("audit");
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [error, setError] = useState("");
    const [detailError, setDetailError] = useState("");
    const [checked, setChecked] = useState<Record<string, DirectoryTransaction>>({});
    const [refreshKey, setRefreshKey] = useState(0);

    const filters = useMemo<DirectoryFilters>(() => ({
        ...getPeriod(period),
        search,
        clientId,
        transactionType: type,
        status,
        approvalStatus: approval,
        riskLevel: risk,
        page,
        pageSize
    }), [period, search, clientId, type, status, approval, risk, page, pageSize]);

    useEffect(() => {
        let alive = true;

        async function loadOptions() {
            try {
                const first = await getClients({ page: 1, pageSize: 100 });
                const all = [...first.data];

                for (let n = 2; n <= first.pagination.totalPages; n++) {
                    const next = await getClients({ page: n, pageSize: 100 });
                    all.push(...next.data);
                }

                if (alive) setClients(all);
            } catch { }

            try {
                const names = await getWorkflowActors();
                if (alive) setActors(names);
            } catch { }
        }

        void loadOptions();
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError("");

        getTransactionHistory(filters)
            .then(data => {
                if (!alive) return;

                setResult(data);
                setSelectedId(current =>
                    data.data.some(item => item.transactionId === current)
                        ? current
                        : data.data[0]?.transactionId ?? null
                );
            })
            .catch(err => {
                if (!alive) return;
                setResult(null);
                setSelectedId(null);
                setError(err instanceof Error ? err.message : "Could not load history.");
            })
            .finally(() => {
                if (alive) setLoading(false);
            });

        return () => { alive = false; };
    }, [filters, refreshKey]);

    useEffect(() => {
        if (!selectedId) {
            setDetails(null);
            setWorkflow(null);
            setAssessment(null);
            setDecisions([]);
            setDocumentEvents([]);
            return;
        }
        const transactionId = selectedId;
        let alive = true;
        setDetailLoading(true);
        setDetailError("");

        async function loadSelected() {
            const transaction = await getTransaction(transactionId);

            const [riskResult, workflowResult, docsResult] = await Promise.all([
                transaction.riskAssessmentId
                    ? getRiskAssessment(transaction.riskAssessmentId).catch(() => null)
                    : Promise.resolve(null),
                transaction.approvalWorkflowId
                    ? getApprovalWorkflow(transaction.approvalWorkflowId).catch(() => null)
                    : Promise.resolve(null),
                getTransactionDocumentHistory(transactionId).catch(() => null)
            ]);

            const approvalDecisions = workflowResult
                ? await getApprovalDecisions(workflowResult.workflowId).catch(() => [])
                : [];

            if (!alive) return;

            setDetails(transaction);
            setAssessment(riskResult);
            setWorkflow(workflowResult);
            setDecisions(approvalDecisions);
            setDocumentEvents(docsResult?.data ?? []);
        }

        setDetails(null);

        loadSelected()
            .catch(err => {
                if (alive) {
                    setDetailError(err instanceof Error ? err.message : "Unable to load history.");
                }
            })
            .finally(() => {
                if (alive) setDetailLoading(false);
            });

        return () => { alive = false; };
    }, [selectedId, refreshKey]);

    const rows = result?.data ?? [];
    const selected = rows.find(item => item.transactionId === selectedId);
    const total = result?.pagination.total ?? 0;
    const pages = result?.pagination.totalPages ?? 0;

    const selectedActorName = (id?: string | null) => {
        if (!id) return "Not recorded";
        const actor = actors.find(item => item.actorId === id);
        return actor ? `${actor.name} (${actor.role})` : id;
    };

    const events = useMemo<EventRow[]>(() => {
        if (!details) return [];

        const items: EventRow[] = [{
            id: "created",
            timestamp: details.createdAt,
            event: "Transaction Created",
            details: `Transaction ${details.referenceNumber} was initiated.`,
            actor: "Initiator not recorded",
            category: "transaction"
        }];

        if (assessment) {
            items.push({
                id: assessment.assessmentId,
                timestamp: assessment.assessedAt,
                event: "Risk Assessment Completed",
                details: `Risk score ${assessment.riskScore}/100 — ${assessment.riskLevel}.`,
                actor: "Risk Engine (System)",
                category: "risk"
            });
        }

        if (workflow) {
            items.push({
                id: workflow.workflowId,
                timestamp: workflow.createdAt,
                event: "Approval Workflow Started",
                details: workflow.requiredStages
                    .map(item => item.requiredRole)
                    .join(" → "),
                actor: "Approval Workflow (System)",
                category: "approval"
            });
        }

        for (const decision of decisions) {
            items.push({
                id: decision.decisionId,
                timestamp: decision.decidedAt,
                event: `Approval ${decision.decision}`,
                details: `Stage ${decision.stageNumber}: ${decision.actorRole}${decision.comments ? ` — ${decision.comments}` : ""}`,
                actor: selectedActorName(decision.actorId),
                category: "approval"
            });
        }

        for (const item of documentEvents) {
            items.push({
                id: item.eventId,
                timestamp: item.occurredAt,
                event: item.eventType.replaceAll("_", " "),
                details: `Supporting document ID: ${item.documentId}`,
                actor: selectedActorName(item.actorId),
                category: "document"
            });
        }

        if (details.processedAt) {
            items.push({
                id: "processed",
                timestamp: details.processedAt,
                event: `Transaction ${details.status}`,
                details: details.rejectionReason || "Financial processing recorded.",
                actor: "Transaction Processing (System)",
                category: "transaction"
            });
        }

        return items.sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
    }, [details, assessment, workflow, decisions, documentEvents, actors]);

    const visibleEvents = events.filter(item => {
        if (tab === "approvals") return item.category === "approval";
        if (tab === "statuses") {
            return item.category === "transaction" || item.category === "approval";
        }
        return true;
    });

    function changeFilter(setter: (value: string) => void, value: string) {
        setter(value);
        setPage(1);
    }

    function clear() {
        setPeriod("all");
        setSearch("");
        setClientId("");
        setType("");
        setStatus("");
        setApproval("");
        setRisk("");
        setPage(1);
        setChecked({});
    }

    function exportCsv(exportRows: DirectoryTransaction[]) {
        const headers = [
            "Transaction ID", "Date", "Client", "Type", "Amount Minor",
            "Currency", "Financial Status", "Risk", "Approval", "Last Updated"
        ];

        const values = exportRows.map(item => [
            item.referenceNumber,
            item.createdAt,
            item.companyName,
            item.transactionType,
            item.amountMinor,
            item.currency,
            item.status,
            item.riskLevel,
            item.approvalStatus,
            item.updatedAt ?? item.createdAt
        ]);

        const escape = (value: unknown) => {
            let raw = String(value ?? "");
            if (/^[=+\-@\t\r]/.test(raw)) raw = `'${raw}`;
            return `"${raw.replaceAll('"', '""')}"`;
        };

        const csv = [headers, ...values]
            .map(record => record.map(escape).join(","))
            .join("\r\n");

        const url = URL.createObjectURL(
            new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
        );

        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "transaction-history.csv";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    const selectedRows = Object.values(checked);
    const allSelected = rows.length > 0 &&
        rows.every(item => checked[item.transactionId]);

    return (
        <div className="th-page">
            <div className="th-breadcrumb">
                <Link href={ROUTES.transactions}>
                    <Icon name="home" size={18} />
                    Transactions
                </Link>
                <Icon name="chevron_right" size={17} />
                Transaction History
            </div>

            <div className="th-page-header">
                <div className="th-heading">
                    <span className="th-heading-icon">
                        <Icon name="description" size={29} />
                    </span>
                    <div>
                        <h1>Transaction History</h1>
                        <p>Search, filter, and view the history and status of financial transactions.</p>
                    </div>
                </div>

                <div className="th-header-actions">
                    <button
                        type="button"
                        onClick={() => exportCsv(selectedRows.length ? selectedRows : rows)}
                    >
                        <Icon name="download" size={19} />
                        Export {selectedRows.length ? `Selected (${selectedRows.length})` : "Page"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setRefreshKey(value => value + 1)}
                    >
                        <Icon name="refresh" size={19} />
                        Refresh
                    </button>
                    <Link className="th-primary" href={ROUTES.transactionCreate}>
                        <Icon name="add" size={20} />
                        New Transaction
                    </Link>
                </div>
            </div>

            <section className="th-filters">
                <label>
                    <span>Period</span>
                    <select value={period} onChange={e => changeFilter(setPeriod, e.target.value)}>
                        <option value="all">All Time</option>
                        <option value="7">Last 7 Days</option>
                        <option value="30">Last 30 Days</option>
                        <option value="90">Last 90 Days</option>
                        <option value="365">Last 12 Months</option>
                    </select>
                </label>

                <label>
                    <span>Client</span>
                    <select value={clientId} onChange={e => changeFilter(setClientId, e.target.value)}>
                        <option value="">All Clients</option>
                        {clients.map(client => (
                            <option key={client.clientId} value={client.clientId}>
                                {client.companyName}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    <span>Transaction Type</span>
                    <select value={type} onChange={e => changeFilter(setType, e.target.value)}>
                        <option value="">All Types</option>
                        <option value="Transfer">Transfer</option>
                    </select>
                </label>

                <label>
                    <span>Financial Status</span>
                    <select value={status} onChange={e => changeFilter(setStatus, e.target.value)}>
                        <option value="">All</option>
                        {["Pending", "Processing", "Completed", "Rejected"].map(item =>
                            <option key={item}>{item}</option>
                        )}
                    </select>
                </label>

                <label>
                    <span>Approval Status</span>
                    <select value={approval} onChange={e => changeFilter(setApproval, e.target.value)}>
                        <option value="">All</option>
                        {["Pending", "InReview", "Escalated", "Approved", "Rejected", "Cancelled", "NotRequired"].map(item =>
                            <option key={item}>{item}</option>
                        )}
                    </select>
                </label>

                <label>
                    <span>Risk Level</span>
                    <select value={risk} onChange={e => changeFilter(setRisk, e.target.value)}>
                        <option value="">All</option>
                        {["Low", "Medium", "High", "Critical"].map(item =>
                            <option key={item}>{item}</option>
                        )}
                    </select>
                </label>

                <button type="button" onClick={clear}>
                    <Icon name="close" size={17} />
                    Clear
                </button>
            </section>

            <div className="th-search-line">
                <Icon name="search" size={19} />
                <input
                    value={search}
                    onChange={e => changeFilter(setSearch, e.target.value)}
                    placeholder="Search by transaction ID, reference, client, account, or description"
                />
            </div>

            <div className="th-stat-grid">
                <Stat
                    icon="description"
                    tone="blue"
                    title="Total Transactions"
                    value={String(result?.statistics.total ?? 0)}
                />
                <Stat
                    icon="check_circle"
                    tone="green"
                    title="Completed"
                    value={String(result?.statistics.completed ?? 0)}
                />
                <Stat
                    icon="schedule"
                    tone="yellow"
                    title="In Review"
                    value={String(result?.statistics.inReview ?? 0)}
                />
                <Stat
                    icon="warning"
                    tone="red"
                    title="Rejected"
                    value={String(result?.statistics.blocked ?? 0)}
                />
                <Stat
                    icon="payments"
                    tone="blue"
                    title="Completed Amount (CAD)"
                    value={money(result?.statistics.completedCADMinor ?? "0", "CAD")}
                />
            </div>

            {error && <p className="th-error" role="alert">{error}</p>}

            <section className="th-table-panel">
                <div className="th-table-scroll">
                    <table className="th-table">
                        <thead>
                            <tr>
                                <th>
                                    <input
                                        type="checkbox"
                                        aria-label="Select visible history"
                                        checked={Boolean(allSelected)}
                                        onChange={e => setChecked(previous => {
                                            const next = { ...previous };
                                            for (const item of rows) {
                                                if (e.target.checked) next[item.transactionId] = item;
                                                else delete next[item.transactionId];
                                            }
                                            return next;
                                        })}
                                    />
                                </th>
                                <th>Transaction ID</th>
                                <th>Date</th>
                                <th>Client</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Financial Status</th>
                                <th>Risk</th>
                                <th>Approval Status</th>
                                <th>Last Update</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={11} className="th-empty">Loading history...</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={11} className="th-empty">No matching transactions.</td></tr>
                            ) : rows.map(item => (
                                <tr
                                    key={item.transactionId}
                                    className={selectedId === item.transactionId ? "selected" : ""}
                                    onClick={() => {
                                        setSelectedId(item.transactionId);
                                        setTab("audit");
                                    }}
                                >
                                    <td onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            aria-label={`Select ${item.referenceNumber}`}
                                            checked={Boolean(checked[item.transactionId])}
                                            onChange={e => setChecked(previous => {
                                                const next = { ...previous };
                                                if (e.target.checked) next[item.transactionId] = item;
                                                else delete next[item.transactionId];
                                                return next;
                                            })}
                                        />
                                    </td>
                                    <td>
                                        <Link
                                            href={ROUTES.transactionDetails(item.transactionId)}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            {item.referenceNumber}
                                        </Link>
                                    </td>
                                    <td>{dateOnly(item.createdAt)}</td>
                                    <td>{item.companyName ?? "—"}</td>
                                    <td>{item.transactionType}</td>
                                    <td className="th-money">{money(item.amountMinor, item.currency)}</td>
                                    <td><StatusBadge status={item.status} /></td>
                                    <td>{item.riskLevel ? <StatusBadge status={item.riskLevel} /> : "Not assessed"}</td>
                                    <td>{item.approvalStatus ? <StatusBadge status={item.approvalStatus} /> : "—"}</td>
                                    <td>{dateTime(item.updatedAt ?? item.createdAt)}</td>
                                    <td className="th-row-actions" onClick={e => e.stopPropagation()}>
                                        <button
                                            type="button"
                                            title="Show history"
                                            onClick={() => setSelectedId(item.transactionId)}
                                        >
                                            <Icon name="visibility" size={19} />
                                        </button>
                                        <Link href={ROUTES.transactionDetails(item.transactionId)} title="Full details">
                                            <Icon name="more_horiz" size={19} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <footer className="th-pagination">
                    <div>
                        <span>Rows per page:</span>
                        <select
                            value={pageSize}
                            onChange={e => {
                                setPageSize(Number(e.target.value));
                                setPage(1);
                            }}
                        >
                            {pageSizes.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <span>
                            {total ? (page - 1) * pageSize + 1 : 0}
                            {" – "}
                            {Math.min(page * pageSize, total)} of {total}
                        </span>
                    </div>
                    <div className="th-page-buttons">
                        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                            <Icon name="chevron_left" size={20} />
                        </button>
                        <span>Page {page} of {Math.max(1, pages)}</span>
                        <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                            <Icon name="chevron_right" size={20} />
                        </button>
                    </div>
                </footer>
            </section>

            {selected && (
                <section className="th-history-panel">
                    <header>
                        <h2>{selected.referenceNumber} — Transaction History & Audit Trail</h2>
                        <Link href={ROUTES.transactionDetails(selected.transactionId)}>
                            View Full Details <Icon name="arrow_forward" size={16} />
                        </Link>
                    </header>

                    <div className="th-history-body">
                        <aside className="th-selected-summary">
                            <h3><Icon name="description" size={21} /> Transaction Summary</h3>
                            <InfoRow label="Amount">{money(selected.amountMinor, selected.currency)}</InfoRow>
                            <InfoRow label="Type">{selected.transactionType}</InfoRow>
                            <InfoRow label="Client">{selected.companyName ?? "—"}</InfoRow>
                            <InfoRow label="Risk Level">
                                {selected.riskLevel ? <StatusBadge status={selected.riskLevel} /> : "Not assessed"}
                            </InfoRow>
                            <InfoRow label="Financial Status">
                                <StatusBadge status={selected.status} />
                            </InfoRow>
                            <InfoRow label="Approval Status">
                                {selected.approvalStatus
                                    ? <StatusBadge status={selected.approvalStatus} />
                                    : "Not available"}
                            </InfoRow>
                        </aside>

                        <div className="th-history-main">
                            <nav className="th-history-tabs">
                                {([
                                    ["audit", "History / Audit Trail", "list"],
                                    ["approvals", "Approval History", "account_tree"],
                                    ["statuses", "Status Changes", "sync"]
                                ] as const).map(([value, label, icon]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={tab === value ? "active" : ""}
                                        onClick={() => setTab(value)}
                                    >
                                        <Icon name={icon} size={19} />
                                        {label}
                                    </button>
                                ))}
                            </nav>

                            {detailLoading ? (
                                <p className="th-empty">Loading timeline...</p>
                            ) : detailError ? (
                                <p className="th-error">{detailError}</p>
                            ) : (
                                <>
                                    <div className="th-event-table">
                                        <div className="th-event-head">
                                            <span>Date & Time</span>
                                            <span>Event</span>
                                            <span>Details</span>
                                            <span>Performed By</span>
                                        </div>

                                        {visibleEvents.length ? visibleEvents.map(item => (
                                            <div className="th-event-row" key={item.id}>
                                                <time>{dateTime(item.timestamp)}</time>
                                                <strong>{item.event}</strong>
                                                <span>{item.details}</span>
                                                <span>{item.actor}</span>
                                            </div>
                                        )) : (
                                            <p className="th-empty">No events recorded in this category.</p>
                                        )}
                                    </div>

                                    <p className="th-timeline-note">
                                        Timeline entries reflect available stored records. User names and
                                        intermediate status changes are shown only when recorded.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}