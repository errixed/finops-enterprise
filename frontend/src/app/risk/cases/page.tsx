"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import {
    type CaseDocument,
    type CaseEvent,
    type CaseRiskLevel,
    type CaseStatus,
    type CaseSummary,
    type CaseTriggerResponse,
    type RiskCase,
    getRiskCases,
    getCaseSummary,
    getCase,
    getCaseEvents,
    getCaseTriggers,
    getCaseDocuments,
    updateCase,
    addCaseNote,
    resolveCase,
    uploadCaseDocument,
    downloadCaseDocument,
    deleteCaseDocument
} from "@/services/risk-cases";
import "./case-management.css";

type CaseTab = "details" | "triggers" | "activity" | "documents";
type Dialog = "edit" | "note" | "resolve" | null;

const statuses: CaseStatus[] = [
    "Open",
    "In Investigation",
    "Resolved"
];

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

function riskBadge(level: string) {
    return (
        <span className={`rc-risk rc-risk-${level.toLowerCase()}`}>
            <Icon
                name={
                    level === "Low"
                        ? "check_circle"
                        : "warning"
                }
                size={15}
            />
            {level}
        </span>
    );
}

function statusBadge(status: string) {
    const cls = status
        .toLowerCase()
        .replace(/\s+/g, "-");

    return (
        <span className={`rc-status rc-status-${cls}`}>
            {status}
        </span>
    );
}

function Stat({
    icon,
    label,
    value,
    tone,
    change,
    suffix
}: {
    icon: string;
    label: string;
    value: string;
    tone: string;
    change?: number | null;
    suffix?: string;
}) {
    return (
        <article className={`rc-stat rc-stat-${tone}`}>
            <span className="rc-stat-icon">
                <Icon name={icon} size={30} />
            </span>
            <div className="rc-stat-copy">
                <span>{label}</span>
                <strong>{value}{suffix ?? ""}</strong>
                {change !== undefined && change !== null && (
                    <small>{change > 0 ? "+" : ""}{change.toFixed(1)}
                        {label === "Avg. Resolution Time" ? " days" : "%"} vs. prior period
                    </small>
                )}
            </div>
        </article>
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
        <section className="rc-panel">
            <header className="rc-panel-heading">
                <h2>
                    <Icon name={icon} size={21} />
                    {title}
                </h2>
                {action}
            </header>
            {children}
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
        <div className="rc-detail">
            <strong>{label}</strong>
            <span>{children}</span>
        </div>
    );
}

export default function CaseManagementPage() {
    const [period, setPeriod] = useState("30");
    const [status, setStatus] = useState("");
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(8);

    const [summary, setSummary] = useState<CaseSummary | null>(null);
    const [rows, setRows] = useState<RiskCase[]>([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(0);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selected, setSelected] = useState<RiskCase | null>(null);

    const [tab, setTab] = useState<CaseTab>("details");
    const [dialog, setDialog] = useState<Dialog>(null);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [events, setEvents] = useState<CaseEvent[]>([]);
    const [triggers, setTriggers] = useState<CaseTriggerResponse | null>(null);
    const [documents, setDocuments] = useState<CaseDocument[]>([]);
    const [note, setNote] = useState("");
    const [resolution, setResolution] = useState("");

    const [edit, setEdit] = useState({
        subject: "",
        summary: "",
        nextAction: "",
        assignedTo: "",
        status: "Open" as CaseStatus
    });

    const [revision, setRevision] = useState(0);
    const fileInput = useRef<HTMLInputElement>(null);

    const refresh = useCallback(() => {
        setRevision(value => value + 1);
    }, []);

    useEffect(() => {
        let active = true;

        setLoading(true);

        Promise.all([
            getRiskCases({
                period,
                status,
                search: query,
                page,
                pageSize
            }),
            getCaseSummary(period)
        ])
            .then(([result, statistics]) => {
                if (!active) return;

                setRows(result.data);
                setTotal(result.pagination.total);
                setPages(result.pagination.totalPages);
                setSummary(statistics);

                setSelectedId(previous =>
                    result.data.some(item => item.caseId === previous)
                        ? previous
                        : result.data[0]?.caseId ?? null
                );
            })
            .catch(err => {
                if (!active) return;

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load cases"
                );
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [period, status, query, page, pageSize, revision]);

    useEffect(() => {
        if (!selectedId) {
            setSelected(null);
            setEvents([]);
            setTriggers(null);
            setDocuments([]);
            return;
        }

        let active = true;

        Promise.all([
            getCase(selectedId),
            getCaseEvents(selectedId),
            getCaseTriggers(selectedId),
            getCaseDocuments(selectedId)
        ])
            .then(([item, history, assessment, files]) => {
                if (!active) return;

                setSelected(item);
                setEvents(history);
                setTriggers(assessment);
                setDocuments(files);
            })
            .catch(err => {
                if (active) {
                    setError(
                        err instanceof Error ? err.message : "Unable to load case"
                    );
                }
            });

        return () => {
            active = false;
        };
    }, [selectedId, revision]);

    const start = total ? (page - 1) * pageSize + 1 : 0;
    const end = Math.min(page * pageSize, total);

    const pageNumbers = useMemo(() => {
        const max = Math.min(5, pages);
        const first = Math.max(1, Math.min(page - 2, pages - max));

        return Array.from({ length: max }, (_, i) => first + i);
    }, [page, pages]);

    function openEdit() {
        if (!selected) return;

        setEdit({
            subject: selected.subject,
            summary: selected.summary,
            nextAction: selected.nextAction,
            assignedTo: selected.assignedTo ?? "",
            status: selected.status
        });

        setDialog("edit");
    }

    async function run(action: () => Promise<unknown>, success: string) {
        setBusy(true);
        setError("");
        setNotice("");

        try {
            await action();
            setDialog(null);
            setNote("");
            setResolution("");
            setNotice(success);
            refresh();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Action failed"
            );
        } finally {
            setBusy(false);
        }
    }

    async function upload(file: File) {
        if (!selected) return;

        if (file.size > 10 * 1024 * 1024) {
            setError("Maximum document size is 10 MB.");
            return;
        }

        if (![
            "application/pdf",
            "image/png",
            "image/jpeg",
            "text/plain"
        ].includes(file.type)) {
            setError("Supported formats: PDF, PNG, JPEG and TXT.");
            return;
        }

        await run(
            () => uploadCaseDocument(selected.caseId, file),
            "Document uploaded."
        );

        setTab("documents");
    }

    return (
        <main className="rc-page">
            <input
                ref={fileInput}
                type="file"
                hidden
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file);
                    event.target.value = "";
                }}
            />
            <div className="rc-breadcrumb">
                <Link href="/risk">Risk Management</Link>
                <Icon name="chevron_right" size={18} />
                <strong>Case Management</strong>
            </div>

            <div className="rc-topline">
                <div className="rc-title-group">
                    <Icon name="folder_open" size={36} />
                    <div>
                        <h1>Case Management</h1>
                        <p>Investigate, manage, and resolve risk cases triggered by risk rules and assessments.</p>
                    </div>
                </div>

                <div className="rc-filters">
                    <Link className="rc-primary" href="/risk/cases/new">
                        <Icon name="add" size={20} />
                        Create Case
                    </Link>

                    <label>
                        Reporting Period
                        <select value={period} onChange={event => {
                            setPeriod(event.target.value);
                            setPage(1);
                        }}>
                            <option value="7">Last 7 Days</option>
                            <option value="30">Last 30 Days</option>
                            <option value="90">Last 90 Days</option>
                            <option value="all">All Time</option>
                        </select>
                    </label>

                    <label>
                        Case Status
                        <select value={status} onChange={event => {
                            setStatus(event.target.value);
                            setPage(1);
                        }}>
                            <option value="">All Cases</option>
                            {statuses.map(value => (
                                <option key={value} value={value}>{value}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            <div className="rc-metrics">
                <Stat icon="folder_open" tone="blue" label="Total Cases"
                    value={(summary?.total ?? 0).toLocaleString()}
                    change={summary?.totalChange} />
                <Stat icon="warning" tone="red" label="Open"
                    value={String(summary?.open ?? 0)} />
                <Stat icon="person_search" tone="amber" label="In Investigation"
                    value={String(summary?.investigating ?? 0)} />
                <Stat icon="check_circle" tone="green" label="Resolved"
                    value={String(summary?.resolved ?? 0)} />
                <Stat icon="schedule" tone="blue" label="Avg. Resolution Time"
                    value={summary?.averageResolutionDays?.toFixed(1) ?? "—"}
                    suffix={summary?.averageResolutionDays != null ? " days" : ""}
                    change={summary?.resolutionChange} />
            </div>

            {error && <p className="rc-error" role="alert">{error}</p>}
            {notice && <p className="rc-notice" role="status">{notice}</p>}

            <div className="rc-columns">
                <Panel
                    title={`Cases (${total.toLocaleString()})`}
                    icon="format_list_bulleted"
                    action={
                        <form
                            className="rc-search"
                            onSubmit={event => {
                                event.preventDefault();
                                setQuery(search.trim());
                                setPage(1);
                            }}
                        >
                            <input
                                placeholder="Search by Case ID, Client, or Subject..."
                                aria-label="Search cases"
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                            />
                            <button type="submit" aria-label="Search">
                                <Icon name="search" size={19} />
                            </button>
                        </form>
                    }
                >
                    <div className="rc-table-scroll">
                        <table className="rc-table rc-case-table">
                            <thead>
                                <tr>
                                    <th>Case ID</th>
                                    <th>Subject / Client</th>
                                    <th>Risk Level</th>
                                    <th>Status</th>
                                    <th>Assigned To</th>
                                    <th>Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6}>Loading cases...</td></tr>
                                ) : rows.length ? rows.map(item => (
                                    <tr
                                        key={item.caseId}
                                        className={selectedId === item.caseId ? "rc-selected" : ""}
                                        onClick={() => {
                                            setSelectedId(item.caseId);
                                            setTab("details");
                                        }}
                                    >
                                        <td>
                                            <button
                                                className="rc-link"
                                                onClick={() => setSelectedId(item.caseId)}
                                            >
                                                {item.caseId}
                                            </button>
                                        </td>
                                        <td>
                                            <strong>{item.subject}</strong>
                                            <small>
                                                {item.clientId
                                                    ? `Client: ${item.clientId}`
                                                    : item.clientName}
                                            </small>
                                        </td>
                                        <td>{riskBadge(item.riskLevel)}</td>
                                        <td>{statusBadge(item.status)}</td>
                                        <td>{item.assignedTo || "Unassigned"}</td>
                                        <td>{dateTime(item.updatedAt)}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="rc-empty">
                                            No cases match these filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <footer className="rc-pagination">
                        <div>
                            Showing {start} – {end} of {total} cases
                            <select
                                aria-label="Cases per page"
                                value={pageSize}
                                onChange={event => {
                                    setPageSize(Number(event.target.value));
                                    setPage(1);
                                }}
                            >
                                {[8, 10, 20, 50].map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <button disabled={page === 1}
                                onClick={() => setPage(value => value - 1)}>
                                <Icon name="chevron_left" size={18} />
                            </button>
                            {pageNumbers.map(value => (
                                <button
                                    key={value}
                                    className={value === page ? "active" : ""}
                                    onClick={() => setPage(value)}
                                >
                                    {value}
                                </button>
                            ))}
                            <button disabled={page >= pages}
                                onClick={() => setPage(value => value + 1)}>
                                <Icon name="chevron_right" size={18} />
                            </button>
                        </div>
                    </footer>
                </Panel>

                <Panel
                    title={selected
                        ? `Case ${selected.caseId} — ${selected.subject}`
                        : "Case Details"}
                    icon="folder_open"
                    action={selected ? statusBadge(selected.status) : undefined}
                >
                    {selected ? (
                        <div className="rc-case-content">
                            <nav className="rc-tabs" aria-label="Case details tabs">
                                {([
                                    ["details", "Details"],
                                    ["triggers", "Risk Triggers"],
                                    ["activity", "Notes & Activity"],
                                    ["documents", "Documents"]
                                ] as const).map(([key, title]) => (
                                    <button key={key}
                                        className={tab === key ? "active" : ""}
                                        onClick={() => setTab(key)}
                                    >
                                        {title}
                                    </button>
                                ))}
                                <button
                                    className={tab === "details" ? "" : ""}
                                    onClick={() => setTab("details")}
                                    disabled={!selected.resolution}
                                    title={selected.resolution
                                        ? "View resolution in Details"
                                        : "Case not yet resolved"}
                                >
                                    Resolution
                                </button>
                            </nav>

                            {tab === "details" && (
                                <>
                                    <div className="rc-details-grid">
                                        <section className="rc-detail-card">
                                            <Detail label="Case ID:">{selected.caseId}</Detail>
                                            <Detail label="Source:">
                                                {selected.source ?? "Manual"}
                                            </Detail>

                                            {selected.assessmentId && (
                                                <Detail label="Assessment:">
                                                    <Link
                                                        href={`/risk/assessments/${encodeURIComponent(selected.assessmentId)}`}
                                                    >
                                                        {selected.assessmentId}
                                                    </Link>
                                                </Detail>
                                            )}

                                            <Detail label="Priority:">
                                                {riskBadge(selected.priority ?? selected.riskLevel)}
                                            </Detail>

                                            <Detail label="Due Date:">
                                                {selected.dueDate
                                                    ? dateTime(selected.dueDate)
                                                    : "Not specified"}
                                            </Detail>

                                            <Detail label="Triggering Rules:">
                                                {selected.triggeringRuleIds?.join(", ") || "None recorded"}
                                            </Detail>
                                            <Detail label="Client:">
                                                {selected.clientId ? (
                                                    <Link href={`/clients/${encodeURIComponent(selected.clientId)}`}>
                                                        {selected.clientName}
                                                    </Link>
                                                ) : selected.clientName}
                                            </Detail>
                                            <Detail label="Risk Level:">
                                                {riskBadge(selected.riskLevel)}
                                            </Detail>
                                            <Detail label="Status:">
                                                {statusBadge(selected.status)}
                                            </Detail>
                                            <Detail label="Assigned To:">
                                                {selected.assignedTo || "Unassigned"}
                                            </Detail>
                                            <Detail label="Created:">
                                                {dateTime(selected.createdAt)}
                                            </Detail>
                                            <Detail label="Last Updated:">
                                                {dateTime(selected.updatedAt)}
                                            </Detail>
                                            {selected.transactionId && (
                                                <Detail label="Transaction:">
                                                    <Link href={`/transactions/${encodeURIComponent(selected.transactionId)}`}>
                                                        View Transaction
                                                    </Link>
                                                </Detail>
                                            )}
                                        </section>

                                        <div className="rc-side-cards">
                                            <section className="rc-small-card">
                                                <h3>Summary</h3>
                                                <p>{selected.summary || "No summary provided."}</p>
                                            </section>

                                            <section className="rc-small-card">
                                                <h3>Next Action</h3>
                                                <p>{selected.status === "Resolved"
                                                    ? "Case investigation completed."
                                                    : selected.nextAction || "No next action set."}
                                                </p>
                                            </section>
                                        </div>
                                    </div>

                                    {selected.resolution && (
                                        <section className="rc-resolution">
                                            <h3>Resolution</h3>
                                            <p>{selected.resolution}</p>
                                            <small>Resolved on {dateTime(selected.resolvedAt)}</small>
                                        </section>
                                    )}

                                    <section className="rc-timeline">
                                        <h3><Icon name="history" size={20} /> Case Timeline</h3>
                                        {events.map(event => (
                                            <div className="rc-timeline-item" key={event.eventId}>
                                                <span className="rc-timeline-dot" />
                                                <div>
                                                    <strong>{event.action}</strong>
                                                    <small>
                                                        {dateTime(event.createdAt)} — {event.actorId}
                                                    </small>
                                                </div>
                                                <p>{event.details}</p>
                                            </div>
                                        ))}
                                    </section>
                                </>
                            )}

                            {tab === "triggers" && (
                                <section className="rc-tab-panel">
                                    {triggers?.assessment ? (
                                        <>
                                            <div className="rc-trigger-summary">
                                                <strong>Assessment:</strong>{" "}
                                                {triggers.assessment.assessmentId}
                                                <span>
                                                    Score {triggers.assessment.riskScore}/100
                                                </span>
                                                {riskBadge(triggers.assessment.riskLevel)}
                                            </div>

                                            <div className="rc-table-scroll">
                                                <table className="rc-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Rule ID</th>
                                                            <th>Points</th>
                                                            <th>Reason</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {triggers.triggeredRules.map(rule => (
                                                            <tr key={rule.ruleId}>
                                                                <td>{rule.ruleId}</td>
                                                                <td>+{rule.points}</td>
                                                                <td>{rule.reason}</td>
                                                            </tr>
                                                        ))}
                                                        {!triggers.triggeredRules.length && (
                                                            <tr><td colSpan={3}>
                                                                No triggered rules recorded.
                                                            </td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="rc-empty">
                                            No linked risk assessment is available.
                                        </p>
                                    )}
                                </section>
                            )}

                            {tab === "activity" && (
                                <section className="rc-tab-panel">
                                    <div className="rc-activity">
                                        {events.map(event => (
                                            <article key={event.eventId}>
                                                <strong>{event.action}</strong>
                                                <span>{dateTime(event.createdAt)} — {event.actorId}</span>
                                                <p>{event.details}</p>
                                            </article>
                                        ))}
                                    </div>

                                    {selected.status !== "Resolved" && (
                                        <button
                                            className="rc-outline"
                                            onClick={() => setDialog("note")}
                                        >
                                            <Icon name="add_comment" size={18} />
                                            Add Note
                                        </button>
                                    )}
                                </section>
                            )}

                            {tab === "documents" && (
                                <section className="rc-tab-panel">
                                    <input
                                        ref={fileInput}
                                        type="file"
                                        hidden
                                        accept=".pdf,.png,.jpg,.jpeg,.txt"
                                        onChange={event => {
                                            const file = event.target.files?.[0];
                                            if (file) void upload(file);
                                            event.target.value = "";
                                        }}
                                    />

                                    {selected.status !== "Resolved" && (
                                        <button
                                            className="rc-outline"
                                            disabled={busy}
                                            onClick={() => fileInput.current?.click()}
                                        >
                                            <Icon name="upload" size={18} />
                                            Upload Document
                                        </button>
                                    )}

                                    <div className="rc-table-scroll">
                                        <table className="rc-table">
                                            <thead>
                                                <tr>
                                                    <th>Document</th>
                                                    <th>Size</th>
                                                    <th>Uploaded</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {documents.map(document => (
                                                    <tr key={document.documentId}>
                                                        <td>{document.filename}</td>
                                                        <td>{(document.size / 1024).toFixed(1)} KB</td>
                                                        <td>{dateTime(document.uploadedAt)}</td>
                                                        <td>
                                                            <div className="rc-doc-actions">
                                                                <button
                                                                    onClick={() => void run(
                                                                        () => downloadCaseDocument(
                                                                            selected.caseId,
                                                                            document
                                                                        ),
                                                                        "Document download started."
                                                                    )}
                                                                >
                                                                    Download
                                                                </button>
                                                                {selected.status !== "Resolved" && (
                                                                    <button
                                                                        onClick={() => {
                                                                            if (!window.confirm(
                                                                                `Delete ${document.filename}?`
                                                                            )) return;

                                                                            void run(
                                                                                () => deleteCaseDocument(
                                                                                    selected.caseId,
                                                                                    document.documentId
                                                                                ),
                                                                                "Document deleted."
                                                                            );
                                                                        }}
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {!documents.length && (
                                                    <tr><td colSpan={4} className="rc-empty">
                                                        No case documents uploaded.
                                                    </td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}

                            <footer className="rc-actions">
                                <button
                                    className="rc-outline"
                                    disabled={selected.status === "Resolved"}
                                    onClick={openEdit}
                                >
                                    <Icon name="edit" size={19} />
                                    Edit Case
                                </button>
                                <button
                                    className="rc-outline"
                                    disabled={selected.status === "Resolved"}
                                    onClick={() => setDialog("note")}
                                >
                                    <Icon name="comment" size={19} />
                                    Add Note
                                </button>
                                <button
                                    className="rc-outline"
                                    disabled={selected.status === "Resolved" || busy}
                                    onClick={() => fileInput.current?.click()}
                                >
                                    <Icon name="upload" size={19} />
                                    Upload Document
                                </button>
                                <button
                                    className="rc-primary"
                                    disabled={selected.status === "Resolved"}
                                    onClick={() => setDialog("resolve")}
                                >
                                    <Icon name="check" size={19} />
                                    Resolve Case
                                </button>
                            </footer>
                        </div>
                    ) : (
                        <p className="rc-empty">
                            Select a case to view details.
                        </p>
                    )}
                </Panel>
            </div>

            {dialog && selected && (
                <div className="rc-modal-backdrop"
                    onClick={() => !busy && setDialog(null)}>
                    <div
                        className="rc-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label={
                            dialog === "edit"
                                ? "Edit Case"
                                : dialog === "note"
                                    ? "Add Case Note"
                                    : "Resolve Case"
                        }
                        onClick={event => event.stopPropagation()}
                    >
                        <h2>
                            {dialog === "edit"
                                ? `Edit ${selected.caseId}`
                                : dialog === "note"
                                    ? "Add Case Note"
                                    : "Resolve Case"}
                        </h2>

                        {dialog === "edit" && (
                            <div className="rc-form">
                                <label>Subject
                                    <input value={edit.subject}
                                        onChange={event => setEdit(value => ({
                                            ...value, subject: event.target.value
                                        }))} />
                                </label>
                                <label>Summary
                                    <textarea value={edit.summary}
                                        onChange={event => setEdit(value => ({
                                            ...value, summary: event.target.value
                                        }))} />
                                </label>
                                <label>Next Action
                                    <textarea value={edit.nextAction}
                                        onChange={event => setEdit(value => ({
                                            ...value, nextAction: event.target.value
                                        }))} />
                                </label>
                                <label>Assigned To
                                    <input value={edit.assignedTo}
                                        onChange={event => setEdit(value => ({
                                            ...value, assignedTo: event.target.value
                                        }))} />
                                </label>
                                <label>Status
                                    <select
                                        value={edit.status}
                                        onChange={event => setEdit(value => ({
                                            ...value,
                                            status: event.target.value as CaseStatus
                                        }))}
                                    >
                                        <option value="Open">Open</option>
                                        <option value="In Investigation">In Investigation</option>
                                    </select>
                                </label>
                            </div>
                        )}

                        {dialog === "note" && (
                            <textarea
                                className="rc-modal-text"
                                rows={5}
                                maxLength={2000}
                                placeholder="Enter an investigation note..."
                                value={note}
                                onChange={event => setNote(event.target.value)}
                            />
                        )}

                        {dialog === "resolve" && (
                            <textarea
                                className="rc-modal-text"
                                rows={5}
                                maxLength={2000}
                                placeholder="Describe the investigation outcome and resolution..."
                                value={resolution}
                                onChange={event => setResolution(event.target.value)}
                            />
                        )}

                        <div className="rc-modal-actions">
                            <button
                                className="rc-outline"
                                disabled={busy}
                                onClick={() => setDialog(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="rc-primary"
                                disabled={busy}
                                onClick={() => void run(
                                    () => dialog === "edit"
                                        ? updateCase(selected.caseId, edit)
                                        : dialog === "note"
                                            ? addCaseNote(selected.caseId, note)
                                            : resolveCase(selected.caseId, resolution),
                                    dialog === "edit"
                                        ? "Case updated."
                                        : dialog === "note"
                                            ? "Note added."
                                            : "Case resolved."
                                )}
                            >
                                {busy ? "Saving..." : dialog === "edit"
                                    ? "Save Changes"
                                    : dialog === "note"
                                        ? "Add Note"
                                        : "Confirm Resolution"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
