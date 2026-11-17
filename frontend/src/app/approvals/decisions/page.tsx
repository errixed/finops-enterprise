
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import {
  fetchDecisionHistory,
  type DecisionHistoryRecord,
  type HistoryFilters,
  type HistoryResult
} from "@/services/approval-decision-history";
import "./decision-history.css";

const initialFilters: HistoryFilters = {
  policy: "all",
  workflow: "all",
  decision: "All",
  actor: "all",
  from: "",
  to: "",
  page: 1,
  pageSize: 5,
  sortBy: "date",
  sortOrder: "desc"
};

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function readable(value?: string) {
  return value
    ? value.replace(/([a-z])([A-Z])/g, "$1 $2")
    : "—";
}

function Outcome({ value }: { value: string }) {
  const icon = value === "Approved"
    ? "check_circle"
    : value === "Rejected"
      ? "cancel"
      : value === "Escalated"
        ? "priority_high"
        : "schedule";

  return (
    <span className={`dh-outcome dh-${value.toLowerCase()}`}>
      <Icon name={icon} size={17} />
      {value}
    </span>
  );
}

function Stat({
  title,
  value,
  icon,
  kind
}: {
  title: string;
  value: number | string;
  icon: string;
  kind: string;
}) {
  return (
    <div className={`dh-stat dh-stat-${kind}`}>
      <div className="dh-stat-icon">
        <Icon name={icon} size={33} />
      </div>
      <div>
        <strong>{title}</strong>
        <b>{value}</b>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon,
  children
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dh-panel">
      <div className="dh-panel-title">
        <Icon name={icon} size={25} />
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Detail({
  name,
  children
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dh-detail-line">
      <strong>{name}</strong>
      <div>{children}</div>
    </div>
  );
}

function Timeline({ row }: { row: DecisionHistoryRecord }) {
  const steps = [
    {
      title: "Submitted",
      date: row.workflowCreatedAt,
      icon: "description",
      kind: "submitted"
    },
    {
      title: row.isPending ? "Awaiting Decision" : row.decision,
      date: row.isPending ? undefined : row.date,
      icon: row.decision === "Approved"
        ? "check_circle"
        : row.decision === "Rejected"
          ? "cancel"
          : "schedule",
      kind: row.decision.toLowerCase()
    }
  ];

  return (
    <Panel title="Decision Timeline" icon="timeline">
      <div className="dh-timeline">
        {steps.map((step, index) => (
          <div className="dh-timeline-step" key={step.title}>
            <div className={`dh-timeline-symbol dh-timeline-${step.kind}`}>
              <Icon name={step.icon} size={25} />
            </div>
            <strong>{step.title}</strong>
            <span>{formatDate(step.date)}</span>
            {index === 0 && <div className="dh-timeline-arrow" />}
          </div>
        ))}
      </div>
      <p className="dh-timeline-note">
        Timeline displays recorded timestamps only.
      </p>
    </Panel>
  );
}

export default function DecisionHistoryPage() {
  const [draft, setDraft] = useState<HistoryFilters>(initialFilters);
  const [applied, setApplied] = useState<HistoryFilters>(initialFilters);
  const [result, setResult] = useState<HistoryResult | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetchDecisionHistory(applied, controller.signal)
      .then(data => {
        setResult(data);
        setSelectedId(current =>
          data.data.some(row => row.id === current)
            ? current
            : data.data[0]?.id ?? ""
        );
        setError("");
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load decision history."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [applied]);

  const selected = useMemo(
    () => result?.data.find(row => row.id === selectedId) ?? null,
    [result, selectedId]
  );

  const metrics = result?.summary;
  const pagination = result?.pagination;
  const options = result?.filters;

  function apply() {
    setLoading(true);
    setApplied({ ...draft, page: 1 });
  }

  function changeFilter<K extends keyof HistoryFilters>(
    key: K,
    value: HistoryFilters[K]
  ) {
    setDraft(previous => ({ ...previous, [key]: value }));
  }

  function pageTo(page: number) {
    if (!pagination || page < 1 || page > pagination.totalPages) {
      return;
    }

    setLoading(true);
    setApplied(previous => ({ ...previous, page }));
    setDraft(previous => ({ ...previous, page }));
  }

  function sortDate() {
    const sortOrder = applied.sortOrder === "desc" ? "asc" : "desc";
    const next = {
      ...applied,
      sortBy: "date" as const,
      sortOrder: sortOrder as "asc" | "desc",
      page: 1
    };

    setLoading(true);
    setApplied(next);
    setDraft(next);
  }

  const pageNumbers = useMemo(() => {
    if (!pagination) return [];

    const total = pagination.totalPages;
    const current = pagination.page;
    const first = Math.max(1, Math.min(current - 2, total - 4));

    return Array.from(
      { length: Math.min(5, total) },
      (_, index) => first + index
    );
  }, [pagination]);

  return (
    <main className="dh-page">
      <div className="dh-breadcrumb">
        <Link href="/approvals">Approval Management</Link>
        <Icon name="chevron_right" size={17} />
        <strong>Decision History</strong>
      </div>

      <div className="dh-title">
        <div className="dh-title-icon">
          <Icon name="schedule" size={36} />
        </div>
        <div>
          <h1>Decision History</h1>
          <p>
            Complete history of approval decisions, status changes,
            and related actions across policies and workflows.
          </p>
        </div>
      </div>

      <form
        className="dh-filters"
        onSubmit={event => {
          event.preventDefault();
          apply();
        }}
      >
        <label>
          <strong>Policy</strong>
          <select
            value={draft.policy}
            onChange={event => changeFilter("policy", event.target.value)}
          >
            <option value="all">All Policies</option>
            {options?.policies.map(item => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <strong>Workflow</strong>
          <select
            value={draft.workflow}
            onChange={event => changeFilter("workflow", event.target.value)}
          >
            <option value="all">All Workflows</option>
            {options?.workflows.map(item => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <strong>Decision</strong>
          <select
            value={draft.decision}
            onChange={event => changeFilter("decision", event.target.value)}
          >
            <option value="All">All Decisions</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Pending">Pending</option>
            <option value="Escalated">Escalated</option>
          </select>
        </label>

        <label>
          <strong>Actor</strong>
          <select
            value={draft.actor}
            onChange={event => changeFilter("actor", event.target.value)}
          >
            <option value="all">All Users</option>
            {options?.actors.map(item => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="dh-date-fields">
          <label>
            <strong>Date From</strong>
            <input
              type="date"
              value={draft.from}
              onChange={event => changeFilter("from", event.target.value)}
            />
          </label>
          <label>
            <strong>Date To</strong>
            <input
              type="date"
              value={draft.to}
              onChange={event => changeFilter("to", event.target.value)}
            />
          </label>
        </div>

        <button type="submit" className="dh-apply" disabled={loading}>
          Apply
        </button>
      </form>

      {error && <div className="dh-error" role="alert">{error}</div>}

      <div className="dh-stats">
        <Stat
          title="Total Records"
          value={metrics?.total ?? "—"}
          icon="description"
          kind="blue"
        />
        <Stat
          title="Approved"
          value={metrics?.approved ?? "—"}
          icon="check_circle"
          kind="green"
        />
        <Stat
          title="Rejected"
          value={metrics?.rejected ?? "—"}
          icon="cancel"
          kind="red"
        />
        <Stat
          title="Pending"
          value={metrics?.pending ?? "—"}
          icon="schedule"
          kind="yellow"
        />
      </div>

      <div className="dh-content-grid">
        <Panel title="Decision Records" icon="format_list_bulleted">
          <div className="dh-table-scroll">
            <table className="dh-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>
                    <button type="button" onClick={sortDate}>
                      Date & Time
                      <Icon
                        name={applied.sortOrder === "desc"
                          ? "arrow_downward"
                          : "arrow_upward"}
                        size={15}
                      />
                    </button>
                  </th>
                  <th>Policy / Version</th>
                  <th>Workflow</th>
                  <th>Decision</th>
                  <th>Actor</th>
                  <th>Role</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((row, index) => (
                  <tr
                    key={row.id}
                    className={selectedId === row.id ? "selected" : ""}
                    onClick={() => setSelectedId(row.id)}
                    tabIndex={0}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(row.id);
                      }
                    }}
                  >
                    <td>
                      {((pagination?.page ?? 1) - 1) *
                        (pagination?.pageSize ?? 5) + index + 1}
                    </td>
                    <td>{formatDate(row.date)}</td>
                    <td>
                      <strong>{row.policyName}</strong>
                      <small>
                        {row.policyVersion == null
                          ? ""
                          : `(v${row.policyVersion})`}
                      </small>
                    </td>
                    <td>
                      <span title={row.workflowId}>
                        {row.workflowName}
                      </span>
                    </td>
                    <td><Outcome value={row.decision} /></td>
                    <td>{row.actorName}</td>
                    <td>{readable(row.actorRole)}</td>
                    <td className="dh-comment">{row.comments || "—"}</td>
                  </tr>
                ))}

                {!result?.data.length && (
                  <tr>
                    <td colSpan={8} className="dh-empty">
                      {loading
                        ? "Loading decision records..."
                        : "No records match the selected filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="dh-table-footer">
            <span>
              Showing {pagination?.total
                ? (pagination.page - 1) * pagination.pageSize + 1
                : 0}
              {" – "}
              {pagination
                ? Math.min(
                    pagination.total,
                    pagination.page * pagination.pageSize
                  )
                : 0}
              {" "}of {pagination?.total ?? 0} records
            </span>

            <div className="dh-pagination">
              <button
                type="button"
                disabled={!pagination || pagination.page <= 1 || loading}
                onClick={() => pageTo((pagination?.page ?? 1) - 1)}
              >
                Previous
              </button>

              {pageNumbers.map(page => (
                <button
                  key={page}
                  type="button"
                  className={pagination?.page === page ? "active" : ""}
                  disabled={loading}
                  onClick={() => pageTo(page)}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={
                  !pagination ||
                  pagination.page >= pagination.totalPages ||
                  loading
                }
                onClick={() => pageTo((pagination?.page ?? 1) + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </Panel>

        <div className="dh-sidebar">
          <Panel title="Decision Details" icon="info">
            {selected ? (
              <>
                <Detail name="Decision ID:">{selected.id}</Detail>
                <Detail name="Date & Time:">
                  {formatDate(selected.date)}
                </Detail>
                <Detail name="Policy:">{selected.policyName}</Detail>
                <Detail name="Version:">
                  {selected.policyVersion ?? "—"}
                </Detail>
                <Detail name="Workflow:">
                  <Link href={`/approvals/${encodeURIComponent(selected.workflowId)}`}>
                    {selected.workflowName}
                  </Link>
                </Detail>
                <Detail name="Decision:">
                  <Outcome value={selected.decision} />
                </Detail>
                <Detail name="Decision By:">
                  {selected.actorName}
                </Detail>
                <Detail name="Role:">
                  {readable(selected.actorRole)}
                </Detail>
                <Detail name="Stage:">
                  {selected.stageNumber ?? "—"}
                </Detail>
                <Detail name="Comments:">
                  {selected.comments || "—"}
                </Detail>
              </>
            ) : (
              <p className="dh-placeholder">
                Select a decision to view its details.
              </p>
            )}
          </Panel>

          {selected && <Timeline row={selected} />}
        </div>
      </div>
    </main>
  );
}
