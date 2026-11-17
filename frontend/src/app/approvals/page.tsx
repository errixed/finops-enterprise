"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { ROUTES } from "../../../config";
import {
  getApprovalOverview,
  type ApprovalOverview
} from "@/services/approval-overview";
import "./approval-overview.css";

const COLORS = {
  Approved: "#26b852",
  Pending: "#ffc32e",
  Rejected: "#fa454b"
};

const WORKFLOW_COLORS = [
  "#1174f1",
  "#27b855",
  "#ffc526",
  "#9948ed",
  "#f46e72",
  "#5db0d4"
];

function formatNumber(value: number) {
  return value.toLocaleString("en-CA");
}

function formatDay(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(
    "en-CA",
    {
      timeZone: "UTC",
      month: "short",
      day: "2-digit"
    }
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function money(value: number | string | null, currency: string | null) {
  if (value === null) return "—";

  const amount = Number(value);

  if (!Number.isSafeInteger(amount)) return "—";

  return `${(amount / 100).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${currency ?? ""}`;
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
    <section className="ao-panel">
      <header className="ao-panel-header">
        <h2>
          <Icon name={icon} size={22} />
          {title}
        </h2>
      </header>
      <div className="ao-panel-content">{children}</div>
    </section>
  );
}

function Metric({
  label,
  icon,
  value,
  change,
  tone,
  inverse = false
}: {
  label: string;
  icon: string;
  value: string;
  change: number | null;
  tone: string;
  inverse?: boolean;
}) {
  const positive = change !== null &&
    (inverse ? change <= 0 : change >= 0);

  return (
    <article className={`ao-metric ao-metric-${tone}`}>
      <div className="ao-metric-icon">
        <Icon name={icon} size={29} />
      </div>

      <div className="ao-metric-copy">
        <span>{label}</span>
        <div className="ao-metric-line">
          <strong>{value}</strong>

          {change !== null && (
            <span className={
              positive ? "ao-change-positive" : "ao-change-negative"
            }>
              {change > 0 ? "▲" : change < 0 ? "▼" : "—"}
              {" "}
              {change > 0 ? "+" : ""}
              {change.toFixed(1)}%
            </span>
          )}
        </div>

        {change === null && (
          <small>No previous-period comparison</small>
        )}
      </div>
    </article>
  );
}

function VolumeTrend({
  rows
}: {
  rows: ApprovalOverview["trend"];
}) {
  const width = 950;
  const height = 260;
  const left = 47;
  const top = 13;
  const bottom = 43;
  const right = 15;

  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const maxValue = Math.max(
    5,
    ...rows.map(row =>
      row.Approved + row.Pending + row.Rejected
    )
  );

  const ceiling = Math.ceil(maxValue / 5) * 5;
  const slot = chartWidth / Math.max(1, rows.length);
  const barWidth = Math.max(4, slot * 0.76);
  const labelStep = Math.max(1, Math.ceil(rows.length / 8));

  return (
    <div className="ao-trend">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Approval volume trend with approved, pending, and rejected workflows"
      >
        {Array.from({ length: 6 }, (_, i) => {
          const value = ceiling * i / 5;
          const y = top + chartHeight * (1 - i / 5);

          return (
            <g key={i}>
              <line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke="#dbe6f4"
              />
              <text
                x={left - 9}
                y={y + 4}
                textAnchor="end"
                fontSize="13"
                fill="#38537e"
              >
                {Math.round(value)}
              </text>
            </g>
          );
        })}

        {rows.map((row, index) => {
          let stacked = 0;

          return (
            <g key={row.day}>
              {(["Approved", "Pending", "Rejected"] as const)
                .map(status => {
                  const value = row[status];
                  const barHeight = value / ceiling * chartHeight;
                  const y = top + chartHeight - stacked - barHeight;

                  stacked += barHeight;

                  return (
                    <rect
                      key={status}
                      x={left + index * slot +
                        (slot - barWidth) / 2}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      fill={COLORS[status]}
                    >
                      <title>
                        {`${row.day}: ${status} ${value}`}
                      </title>
                    </rect>
                  );
                })}

              {(index % labelStep === 0 ||
                index === rows.length - 1) && (
                <text
                  x={left + index * slot + slot / 2}
                  y={height - 19}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#38537e"
                >
                  {formatDay(row.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="ao-chart-legend">
        {(["Approved", "Pending", "Rejected"] as const)
          .map(status => (
            <span key={status}>
              <i style={{ background: COLORS[status] }} />
              {status}
            </span>
          ))}
      </div>
    </div>
  );
}

function WorkflowDonut({
  rows
}: {
  rows: ApprovalOverview["byWorkflow"];
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  let progress = 0;

  const gradient = rows.map((row, index) => {
    const start = progress;
    progress += total ? row.count / total * 100 : 0;

    return `${WORKFLOW_COLORS[index % WORKFLOW_COLORS.length]} ${start}% ${progress}%`;
  }).join(", ");

  return (
    <div className="ao-workflow-distribution">
      <div
        className="ao-donut"
        style={{
          background: total
            ? `conic-gradient(${gradient})`
            : "#e2ebf7"
        }}
        role="img"
        aria-label="Workflow distribution by transaction risk level"
      >
        <div className="ao-donut-center">
          <strong>{formatNumber(total)}</strong>
          <span>Total</span>
        </div>
      </div>

      <div className="ao-workflow-legend">
        {rows.map((row, index) => (
          <div key={row.name}>
            <i
              style={{
                background: WORKFLOW_COLORS[
                  index % WORKFLOW_COLORS.length
                ]
              }}
            />
            <span>
              {row.name === "Unknown"
                ? "Unclassified"
                : `${row.name} Risk`}
            </span>
            <strong>
              {row.percent.toFixed(1)}%
              {" "}
              ({formatNumber(row.count)})
            </strong>
          </div>
        ))}

        {!rows.length && (
          <p className="ao-empty">No workflow data for this period.</p>
        )}
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  return (
    <span className={`ao-risk ao-risk-${level.toLowerCase()}`}>
      <Icon
        name={level === "Low" ? "check_circle" : "warning"}
        size={14}
      />
      {level}
    </span>
  );
}

function RecentDecisions({
  rows
}: {
  rows: ApprovalOverview["recentDecisions"];
}) {
  return (
    <div className="ao-table-scroll">
      <table className="ao-table">
        <thead>
          <tr>
            <th>Approval ID</th>
            <th>Transaction</th>
            <th>Client</th>
            <th>Amount</th>
            <th>Risk Level</th>
            <th>Decision</th>
            <th>Decided By</th>
            <th>Decision Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.decisionId}>
              <td>
                <Link href={
                  ROUTES.approvalDetails(row.workflowId)
                }>
                  {row.decisionId.slice(0, 12)}
                </Link>
              </td>
              <td>
                <Link href={
                  ROUTES.transactionDetails(row.transactionId)
                }>
                  {row.transactionId.slice(0, 12)}
                </Link>
              </td>
              <td>
                <strong>{row.clientId ?? "—"}</strong>
                <small>{row.clientName ?? "Not recorded"}</small>
              </td>
              <td>{money(row.amountMinor, row.currency)}</td>
              <td><RiskBadge level={row.riskLevel} /></td>
              <td>
                <span className={
                  row.decision === "Approved"
                    ? "ao-decision-approved"
                    : "ao-decision-rejected"
                }>
                  <Icon
                    name={
                      row.decision === "Approved"
                        ? "check_circle"
                        : "cancel"
                    }
                    size={14}
                  />
                  {row.decision}
                </span>
              </td>
              <td>{row.actorId}</td>
              <td>{formatDate(row.decidedAt)}</td>
            </tr>
          ))}

          {!rows.length && (
            <tr>
              <td colSpan={8} className="ao-empty">
                No approval or rejection decisions found
                in this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Insights({ data }: { data: ApprovalOverview }) {
  const { metrics, pendingRisk } = data;
  const changes = metrics.changes;

  return (
    <div className="ao-insights">
      <article>
        <div className="ao-insight-icon ao-insight-red">
          <Icon name="warning" size={25} />
        </div>
        <p>
          <strong>{formatNumber(metrics.pending)}</strong>
          {" "}approval workflows currently await review,
          including <strong>{pendingRisk.critical}</strong> Critical
          and <strong>{pendingRisk.high}</strong> High risk.
        </p>
      </article>

      <article>
        <div className="ao-insight-icon ao-insight-green">
          <Icon name="trending_up" size={25} />
        </div>
        <p>
          {changes.approved === null
            ? "Insufficient previous-period data to compare approvals."
            : `Completed approvals ${changes.approved >= 0
                ? "increased" : "decreased"} by ${Math.abs(
                changes.approved
              ).toFixed(1)}% compared with the previous period.`}
        </p>
      </article>

      <article>
        <div className="ao-insight-icon ao-insight-blue">
          <Icon name="schedule" size={25} />
        </div>
        <p>
          {metrics.averageDecisionHours === null
            ? "No completed workflows with valid decision timing were found."
            : `Average completion time was ${metrics.averageDecisionHours.toFixed(
                1
              )} hours${changes.averageDecisionHours === null
                ? "."
                : ` (${changes.averageDecisionHours > 0
                  ? "+" : ""}${changes.averageDecisionHours.toFixed(1)}% compared with the previous period).`}`}
        </p>
      </article>
    </div>
  );
}

export default function ApprovalOverviewPage() {
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const [workflow, setWorkflow] = useState("all");
  const [data, setData] = useState<ApprovalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    getApprovalOverview(days, workflow, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setData(result);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message :
            "Unable to load approval overview."
        );
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [days, workflow]);

  const dateRange = useMemo(() => {
    if (!data) return "";

    const lastDate = new Date(`${data.period.end}T00:00:00Z`);
    const end = new Date(lastDate);
    const format = (date: Date) =>
      date.toLocaleDateString("en-CA", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
        year: "numeric"
      });

    return `${format(new Date(`${data.period.start}T00:00:00Z`))} – ${format(end)}`;
  }, [data]);

  return (
    <main className="ao-page">
      <div className="ao-breadcrumb">
        <Link href="/approvals">Approval Management</Link>
        <Icon name="chevron_right" size={19} />
        <strong>Overview</strong>
      </div>

      <div className="ao-heading">
        <div className="ao-heading-text">
          <div className="ao-title">
            <Icon name="assignment_turned_in" size={38} />
            <h1>Approval Management</h1>
          </div>
          <p>
            Monitor approval activities, workload, and decision
            outcomes across all approval workflows.
          </p>
        </div>

        <div className="ao-filters">
          <label>
            <span>Reporting Period</span>
            <select
              value={days}
              onChange={event =>
                setDays(event.target.value as "7" | "30" | "90")
              }
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
            <small>{dateRange}</small>
          </label>

          <label>
            <span>Workflow</span>
            <select
              value={workflow}
              onChange={event => setWorkflow(event.target.value)}
            >
              <option value="all">All Workflows</option>
              <option value="Pending">Pending</option>
              <option value="InReview">In Review</option>
              <option value="Escalated">Escalated</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </label>
        </div>
      </div>

      {error && <div className="ao-error" role="alert">{error}</div>}
      {loading && (
        <div className="ao-loading" role="status">
          Loading approval metrics...
        </div>
      )}

      {!loading && data && (
        <>
          <div className="ao-metrics">
            <Metric
              label="Pending Approvals"
              value={formatNumber(data.metrics.pending)}
              icon="pending_actions"
              tone="blue"
              change={data.metrics.changes.pending}
              inverse
            />
            <Metric
              label="Approved"
              value={formatNumber(data.metrics.approved)}
              icon="check_circle"
              tone="green"
              change={data.metrics.changes.approved}
            />
            <Metric
              label="Rejected"
              value={formatNumber(data.metrics.rejected)}
              icon="cancel"
              tone="red"
              change={data.metrics.changes.rejected}
              inverse
            />
            <Metric
              label="Avg. Decision Time"
              value={
                data.metrics.averageDecisionHours === null
                  ? "—"
                  : `${data.metrics.averageDecisionHours.toFixed(1)} hours`
              }
              icon="schedule"
              tone="blue"
              change={data.metrics.changes.averageDecisionHours}
              inverse
            />
          </div>

          <div className="ao-chart-grid">
            <Panel title="Approval Volume Trend" icon="bar_chart">
              <VolumeTrend rows={data.trend} />
            </Panel>

            <Panel title="Approvals by Workflow" icon="description">
              <WorkflowDonut rows={data.byWorkflow} />
            </Panel>
          </div>

          <div className="ao-bottom-grid">
            <Panel title="Recent Approvals" icon="format_list_bulleted">
              <RecentDecisions rows={data.recentDecisions} />
            </Panel>

            <Panel title="Key Insights" icon="lightbulb">
              <Insights data={data} />
            </Panel>
          </div>
        </>
      )}
    </main>
  );
}