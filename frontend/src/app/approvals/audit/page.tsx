
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import {
  getApprovalAuditTrail,
  type AuditAction,
  type AuditEntityType,
  type AuditEvent,
  type AuditFilters,
  type AuditResult
} from "@/services/approval-audit-trail";
import "./approval-audit.css";

const initialFilters: AuditFilters = {
  entityType: "All",
  entity: "all",
  action: "All",
  user: "all",
  from: "",
  to: "",
  page: 1,
  pageSize: 5,
  sortBy: "date",
  sortOrder: "desc"
};

const entityTypes: Array<{ value: AuditEntityType; label: string }> = [
  { value: "All", label: "All Entities" },
  { value: "Decision", label: "Decisions" },
  { value: "Workflow", label: "Approval Workflows" },
  { value: "WorkflowDefinition", label: "Workflow Definitions" }
];

const actions: Array<{ value: AuditAction; label: string }> = [
  { value: "All", label: "All Actions" },
  { value: "Creates", label: "Creates" },
  { value: "Updates", label: "Updates" },
  { value: "Deletes", label: "Deletes" },
  { value: "Access", label: "Access" },
  { value: "Configuration", label: "Configuration" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Escalated", label: "Escalated" }
];

function dateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

function actionIcon(action: string) {
  const value = action.toLowerCase();
  if (value.includes("reject") || value.includes("delet")) return "cancel";
  if (value.includes("approv")) return "check";
  if (value.includes("creat") || value.includes("duplicat")) return "add";
  if (value.includes("updat") || value.includes("edit")) return "edit";
  if (value.includes("access")) return "person";
  return "settings";
}

function actionTone(event: AuditEvent) {
  if (event.category === "Rejected" || event.group === "Deletes") return "red";
  if (event.category === "Approved") return "green";
  if (event.group === "Creates") return "green";
  if (event.group === "Configuration") return "purple";
  return "blue";
}

function Pill({ event }: { event: AuditEvent }) {
  return (
    <span className={`aat-pill aat-pill-${actionTone(event)}`}>
      <Icon name={actionIcon(event.action)} size={17} />
      {event.action}
    </span>
  );
}

function Stat({
  title,
  value,
  icon,
  color
}: {
  title: string;
  value: number | string;
  icon: string;
  color: string;
}) {
  return (
    <article className={`aat-stat aat-stat-${color}`}>
      <div className="aat-stat-icon">
        <Icon name={icon} size={31} />
      </div>
      <div>
        <strong>{title}</strong>
        <b>{value}</b>
      </div>
    </article>
  );
}

function Panel({
  icon,
  title,
  children
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="aat-panel">
      <header className="aat-panel-heading">
        <Icon name={icon} size={25} />
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Detail({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="aat-detail">
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  );
}

function pageButtons(current: number, total: number) {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from(
    { length: Math.min(5, total) },
    (_, index) => start + index
  );
}

export default function ApprovalAuditTrailPage() {
  const [draft, setDraft] = useState<AuditFilters>(initialFilters);
  const [applied, setApplied] = useState<AuditFilters>(initialFilters);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [showChanges, setShowChanges] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    getApprovalAuditTrail(applied, controller.signal)
      .then(data => {
        setResult(data);
        setSelectedId(current =>
          data.data.some(event => event.id === current)
            ? current
            : data.data[0]?.id ?? ""
        );
        setError("");
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Audit request failed.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [applied]);

  const selected = useMemo(
    () => result?.data.find(event => event.id === selectedId) ?? null,
    [result, selectedId]
  );

  function apply() {
    setApplied({ ...draft, page: 1 });
  }

  function change<K extends keyof AuditFilters>(
    field: K,
    value: AuditFilters[K]
  ) {
    setDraft(previous => ({ ...previous, [field]: value }));
  }

  function setPage(page: number) {
    if (!result || page < 1 || page > result.pagination.totalPages) return;
    setApplied(previous => ({ ...previous, page }));
  }

  function toggleDateSort() {
    setApplied(previous => ({
      ...previous,
      page: 1,
      sortBy: "date",
      sortOrder: previous.sortOrder === "desc" ? "asc" : "desc"
    }));
  }

  const stats = result?.summary;
  const pagination = result?.pagination;

  return (
    <main className="aat-page">
      <div className="aat-breadcrumb">
        <Link href="/approvals">Approval Management</Link>
        <Icon name="chevron_right" size={17} />
        <strong>Audit Trail</strong>
      </div>

      <div className="aat-heading">
        <Icon name="document_scanner" size={43} />
        <div>
          <h1>Audit Trail</h1>
          <p>
            Recorded configuration changes, decisions, and workflow activity
            across Approval Management.
          </p>
        </div>
      </div>

      <form
        className="aat-filters"
        onSubmit={event => {
          event.preventDefault();
          apply();
        }}
      >
        <label>
          <strong>Entity Type</strong>
          <select
            value={draft.entityType}
            onChange={event => {
              change("entityType", event.target.value as AuditEntityType);
              change("entity", "all");
            }}
          >
            {entityTypes.map(item => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>

        <label>
          <strong>Entity</strong>
          <select
            value={draft.entity}
            onChange={event => change("entity", event.target.value)}
          >
            <option value="all">All Entities</option>
            {result?.filters.entities
              .filter(item =>
                draft.entityType === "All" ||
                item.value.startsWith(`${draft.entityType}:`)
              )
              .map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
          </select>
        </label>

        <label>
          <strong>Action</strong>
          <select
            value={draft.action}
            onChange={event => change("action", event.target.value as AuditAction)}
          >
            {actions.map(item => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>

        <label>
          <strong>User</strong>
          <select
            value={draft.user}
            onChange={event => change("user", event.target.value)}
          >
            <option value="all">All Users</option>
            {result?.filters.users.map(item => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>

        <div className="aat-date-range">
          <label>
            <strong>From</strong>
            <input
              type="date"
              value={draft.from}
              onChange={event => change("from", event.target.value)}
            />
          </label>
          <label>
            <strong>To</strong>
            <input
              type="date"
              value={draft.to}
              onChange={event => change("to", event.target.value)}
            />
          </label>
        </div>

        <button type="submit" className="aat-primary" disabled={loading}>
          Apply
        </button>
      </form>

      {error && <p className="aat-error" role="alert">{error}</p>}

      <div className="aat-stats">
        <Stat title="Total Audit Events" value={stats?.total ?? "—"} icon="description" color="blue" />
        <Stat title="Creates" value={stats?.creates ?? "—"} icon="add_circle" color="green" />
        <Stat title="Updates" value={stats?.updates ?? "—"} icon="edit" color="cyan" />
        <Stat title="Deletes" value={stats?.deletes ?? "—"} icon="delete" color="red" />
        <Stat title="Access" value={stats?.access ?? "—"} icon="person" color="purple" />
        <Stat title="Configuration" value={stats?.configuration ?? "—"} icon="settings" color="yellow" />
      </div>

      <div className="aat-content">
        <Panel icon="format_list_bulleted" title="Audit Events">
          <div className="aat-table-scroll">
            <table className="aat-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>
                    <button type="button" onClick={toggleDateSort}>
                      Date & Time
                      <Icon name={applied.sortOrder === "desc" ? "arrow_downward" : "arrow_upward"} size={16} />
                    </button>
                  </th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity Type</th>
                  <th>Entity ID</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((event, index) => (
                  <tr
                    key={event.id}
                    className={selectedId === event.id ? "selected" : ""}
                    tabIndex={0}
                    onClick={() => setSelectedId(event.id)}
                    onKeyDown={keyboard => {
                      if (keyboard.key === "Enter" || keyboard.key === " ") {
                        keyboard.preventDefault();
                        setSelectedId(event.id);
                      }
                    }}
                  >
                    <td>{((pagination?.page ?? 1) - 1) * 5 + index + 1}</td>
                    <td>{dateTime(event.date)}</td>
                    <td>
                      <span className="aat-actor">
                        <Icon name="person" size={18} />
                        {event.actorName}
                      </span>
                    </td>
                    <td><Pill event={event} /></td>
                    <td>{event.entityType === "WorkflowDefinition" ? "Workflow Definition" : event.entityType}</td>
                    <td className="aat-entity-id" title={event.entityId}>{event.entityId}</td>
                    <td>{event.description}</td>
                  </tr>
                ))}

                {!result?.data.length && (
                  <tr>
                    <td colSpan={7} className="aat-empty">
                      {loading ? "Loading events..." : "No events match these filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="aat-table-footer">
            <span>
              Showing {pagination?.total
                ? (pagination.page - 1) * pagination.pageSize + 1
                : 0}
              {" – "}
              {pagination
                ? Math.min(pagination.total, pagination.page * pagination.pageSize)
                : 0}
              {" "}of {pagination?.total ?? 0} records
            </span>

            <div className="aat-pages">
              <button disabled={!pagination || pagination.page <= 1 || loading} onClick={() => setPage((pagination?.page ?? 1) - 1)}>
                Previous
              </button>
              {pagination && pageButtons(pagination.page, pagination.totalPages).map(page => (
                <button
                  key={page}
                  className={page === pagination.page ? "active" : ""}
                  disabled={loading}
                  onClick={() => setPage(page)}
                >
                  {page}
                </button>
              ))}
              <button disabled={!pagination || pagination.page >= pagination.totalPages || loading} onClick={() => setPage((pagination?.page ?? 1) + 1)}>
                Next
              </button>
            </div>
          </footer>
        </Panel>

        <Panel icon="info" title="Event Details">
          {selected ? (
            <>
              <Detail title="Audit ID:">{selected.id}</Detail>
              <Detail title="Date & Time:">{dateTime(selected.date)}</Detail>
              <Detail title="User:">{selected.actorName}</Detail>
              <Detail title="Action:"><Pill event={selected} /></Detail>
              <Detail title="Entity Type:">{selected.entityType}</Detail>
              <Detail title="Entity ID:">{selected.entityId}</Detail>
              <Detail title="Related Policy:">{selected.policyId || "—"}</Detail>
              <Detail title="Workflow:">{selected.workflowId || "—"}</Detail>
              <Detail title="IP Address:">Not recorded</Detail>
              <Detail title="Comments:">{selected.comments || selected.description}</Detail>

              <div className="aat-change-panel">
                <button
                  type="button"
                  onClick={() => setShowChanges(previous => !previous)}
                  aria-expanded={showChanges}
                >
                  <span><Icon name="code" size={20} /> Change Details</span>
                  <Icon name={showChanges ? "expand_less" : "expand_more"} size={21} />
                </button>
                {showChanges && (
                  <pre>{JSON.stringify(selected.details, null, 2)}</pre>
                )}
              </div>
            </>
          ) : (
            <p className="aat-empty">
              Select an event to view its details.
            </p>
          )}
        </Panel>
      </div>
    </main>
  );
}
