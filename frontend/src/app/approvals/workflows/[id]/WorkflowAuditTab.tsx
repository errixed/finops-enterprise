
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import type {
  DetailedWorkflowDefinition
} from "@/services/approval-workflow-details";
import type {
  WorkflowDefinitionEvent
} from "@/services/approval-workflow-definitions";
import "./workflow-audit.css";

type Period = "all" | "7" | "30" | "90";
type ExportFormat = "csv" | "json";

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
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short"
  }).format(date);
}

function readable(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function eventIcon(action: string) {
  const normalized = action.toLowerCase();

  if (normalized.includes("delete")) return "delete";
  if (normalized.includes("draft")) return "edit_note";
  if (normalized.includes("duplicat")) return "content_copy";
  if (normalized.includes("activat")) return "verified";
  if (normalized.includes("creat")) return "play_circle";
  if (normalized.includes("sla")) return "schedule";
  if (normalized.includes("condition")) return "filter_alt";
  if (normalized.includes("stage")) return "account_tree";

  return "history";
}

function eventClass(action: string) {
  const normalized = action.toLowerCase();

  if (normalized.includes("delete")) return "danger";
  if (normalized.includes("creat") || normalized.includes("activat")) {
    return "success";
  }
  if (normalized.includes("draft")) return "warning";

  return "blue";
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "—";

  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function csvValue(value: unknown): string {
  const text = formatDetailValue(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadContent(
  filename: string,
  content: string,
  type: string
) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function InfoTile({
  icon,
  title,
  children
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="waud-info-tile">
      <Icon name={icon} size={27} />
      <div>
        <strong>{title}</strong>
        <span>{children}</span>
      </div>
    </div>
  );
}

function Panel({
  icon,
  title,
  subtitle,
  children
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="waud-panel">
      <div className="waud-panel-heading">
        <Icon name={icon} size={26} />
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function WorkflowAuditTab({
  definition,
  events
}: {
  definition: DetailedWorkflowDefinition;
  events: WorkflowDefinitionEvent[];
}) {
  const [period, setPeriod] = useState<Period>("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");

  const eventTypes = useMemo(
    () => [...new Set(events.map(event => event.action))].sort(),
    [events]
  );

  const actors = useMemo(
    () => [...new Set(events.map(event => event.actorId))].sort(),
    [events]
  );

  const filtered = useMemo(() => {
    const now = Date.now();

    return events
      .filter(event => {
        if (period !== "all") {
          const timestamp = new Date(event.createdAt).getTime();

          if (
            Number.isNaN(timestamp) ||
            timestamp < now - Number(period) * 86400000
          ) {
            return false;
          }
        }

        if (eventFilter !== "all" && event.action !== eventFilter) {
          return false;
        }

        if (actorFilter !== "all" && event.actorId !== actorFilter) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime()
      );
  }, [events, period, eventFilter, actorFilter]);

  useEffect(() => {
    if (!filtered.some(event => event.eventId === selectedEventId)) {
      setSelectedEventId(
        filtered.length
          ? filtered[filtered.length - 1].eventId
          : ""
      );
    }
  }, [filtered, selectedEventId]);

  const selected = filtered.find(
    event => event.eventId === selectedEventId
  ) ?? null;

  const stageNames = definition.stages.map(readable);
  const sourceId = (definition as DetailedWorkflowDefinition & {
    duplicatedFrom?: string;
  }).duplicatedFrom;

  function reset() {
    setPeriod("all");
    setEventFilter("all");
    setActorFilter("all");
  }

  function exportEvents() {
    const filename = `workflow-audit-${definition.definitionId}`;

    if (exportFormat === "json") {
      downloadContent(
        `${filename}.json`,
        JSON.stringify(filtered, null, 2),
        "application/json;charset=utf-8"
      );
      return;
    }

    const rows = [
      ["Event ID", "Timestamp", "Event", "User", "Details"],
      ...filtered.map(event => [
        event.eventId,
        event.createdAt,
        event.action,
        event.actorId,
        JSON.stringify(event.details ?? {})
      ])
    ];

    downloadContent(
      `${filename}.csv`,
      rows.map(row => row.map(csvValue).join(",")).join("\r\n"),
      "text/csv;charset=utf-8"
    );
  }

  return (
    <div className="waud-root">
      <div className="waud-info-strip">
        <InfoTile icon="settings" title="Workflow ID">
          {definition.definitionId}
        </InfoTile>

        <InfoTile icon="layers" title="Workflow Source">
          {sourceId ? (
            <Link href={`/approvals/workflows/${encodeURIComponent(sourceId)}`}>
              {sourceId}
            </Link>
          ) : (
            definition.origin === "Assignment3"
              ? "Assignment 3"
              : "Custom Definition"
          )}
        </InfoTile>

        <InfoTile icon="verified_user" title="Risk Level">
          <span className="waud-risk">
            {definition.riskLevels.join(", ") || "Not specified"}
          </span>
        </InfoTile>

        <InfoTile icon="account_tree" title="Stage Sequence">
          {stageNames.length ? stageNames.join(" → ") : "Not configured"}
        </InfoTile>

        <InfoTile icon="calendar_month" title="Created On">
          {formatDate(definition.createdAt)}
        </InfoTile>
      </div>

      <div className="waud-grid">
        <Panel
          icon="assignment"
          title="Audit Trail"
          subtitle="Chronological record of workflow definition events. This log is read-only."
        >
          <div className="waud-toolbar">
            <div className="waud-filters">
              <label>
                <Icon name="calendar_month" size={17} />
                <select
                  aria-label="Filter by period"
                  value={period}
                  onChange={event => setPeriod(event.target.value as Period)}
                >
                  <option value="all">All Time</option>
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 90 Days</option>
                </select>
              </label>

              <label>
                <Icon name="filter_alt" size={17} />
                <select
                  aria-label="Filter by event"
                  value={eventFilter}
                  onChange={event => setEventFilter(event.target.value)}
                >
                  <option value="all">All Events</option>
                  {eventTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>

              <label>
                <Icon name="person_outline" size={17} />
                <select
                  aria-label="Filter by user"
                  value={actorFilter}
                  onChange={event => setActorFilter(event.target.value)}
                >
                  <option value="all">All Users</option>
                  {actors.map(actor => (
                    <option key={actor} value={actor}>{actor}</option>
                  ))}
                </select>
              </label>

              <button type="button" className="waud-reset" onClick={reset}>
                <Icon name="restart_alt" size={17} />
                Reset
              </button>
            </div>

            <div className="waud-export">
              <select
                aria-label="Export format"
                value={exportFormat}
                onChange={event =>
                  setExportFormat(event.target.value as ExportFormat)
                }
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
              <button type="button" onClick={exportEvents}>
                <Icon name="download" size={18} />
                Export
              </button>
            </div>
          </div>

          <div className="waud-table-scroll">
            <table className="waud-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Timestamp (Toronto)</th>
                  <th>Event</th>
                  <th>Details</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event, index) => (
                  <tr
                    key={event.eventId}
                    className={selected?.eventId === event.eventId
                      ? "waud-selected"
                      : ""}
                    onClick={() => setSelectedEventId(event.eventId)}
                  >
                    <td>
                      <span className="waud-number">{index + 1}</span>
                    </td>
                    <td className="waud-time">
                      {formatDate(event.createdAt)}
                    </td>
                    <td>
                      <span className="waud-event-name">
                        <Icon
                          name={eventIcon(event.action)}
                          size={21}
                          className={`waud-event-${eventClass(event.action)}`}
                        />
                        <strong>{event.action}</strong>
                      </span>
                    </td>
                    <td className="waud-event-description">
                      {Object.keys(event.details ?? {}).length
                        ? Object.entries(event.details).slice(0, 2).map(
                            ([key, value]) => (
                              <div key={key}>
                                {readable(key)}: {formatDetailValue(value)
                                  .slice(0, 100)}
                              </div>
                            )
                          )
                        : "Workflow definition event"}
                    </td>
                    <td>
                      <span className="waud-user">
                        <Icon name="person_outline" size={19} />
                        {event.actorId}
                      </span>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="waud-empty">
                      No audit events match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="waud-table-footer">
            Showing {filtered.length} of {events.length} events
          </div>
        </Panel>

        <Panel icon="info" title="Event Details">
          {selected ? (
            <div className="waud-selected-details">
              <div className="waud-detail-row">
                <strong>Event:</strong>
                <span>{selected.action}</span>
              </div>
              <div className="waud-detail-row">
                <strong>Timestamp:</strong>
                <span>{formatDate(selected.createdAt)}</span>
              </div>
              <div className="waud-detail-row">
                <strong>User:</strong>
                <span className="waud-user">
                  <Icon name="person_outline" size={20} />
                  {selected.actorId}
                </span>
              </div>
              <div className="waud-detail-row">
                <strong>Event ID:</strong>
                <span className="waud-id">{selected.eventId}</span>
              </div>
              <div className="waud-detail-row">
                <strong>Details:</strong>
                <div className="waud-event-details">
                  {Object.keys(selected.details ?? {}).length ? (
                    Object.entries(selected.details).map(([key, value]) => (
                      <div key={key}>
                        <strong>{readable(key)}</strong>
                        <pre>{formatDetailValue(value)}</pre>
                      </div>
                    ))
                  ) : (
                    "No additional details recorded."
                  )}
                </div>
              </div>

              <div className="waud-related">
                <strong>Workflow Definition:</strong>
                <span>{definition.definitionId}</span>
              </div>
            </div>
          ) : (
            <p className="waud-empty-details">
              Select an event from the Audit Trail to view its details.
            </p>
          )}
        </Panel>
      </div>

      <p className="waud-context">
        This audit trail records workflow-definition management activity.
        Approval-instance stage decisions and transaction-viewing history
        are recorded separately and are not presented here unless those
        events are actually available.
      </p>
    </div>
  );
}
