"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ROUTES } from "../../../config";
import { Icon, StatusBadge } from "@/components/ui";
import {
  getRiskOverview,
  type RiskOverviewData,
  type OverviewRiskLevel
} from "@/services/risk-overview";

const levels: OverviewRiskLevel[] = [
  "Critical",
  "High",
  "Medium",
  "Low"
];

const colors: Record<OverviewRiskLevel, string> = {
  Critical: "#f12626",
  High: "#ff9316",
  Medium: "#ffd529",
  Low: "#12c845"
};

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function relativeTime(value: string) {
  const difference = Date.now() - new Date(value).getTime();

  if (!Number.isFinite(difference)) return "—";

  const minutes = Math.max(0, Math.floor(difference / 60000));

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function money(minor: string, currency: string) {
  try {
    const value = BigInt(minor);
    const absolute = value < BigInt(0) ? -value : value;

    return `${value < BigInt(0) ? "−" : ""}${(
      absolute / BigInt(100)
    ).toLocaleString("en-CA")}.${String(
      absolute % BigInt(100)
    ).padStart(2, "0")} ${currency}`;
  } catch {
    return "—";
  }
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
    <section className="rmo-panel">
      <header className="rmo-panel-heading">
        <h2>
          <Icon name={icon} size={23} />
          {title}
        </h2>
        {action}
      </header>
      <div className="rmo-panel-content">{children}</div>
    </section>
  );
}

function Metric({
  title,
  value,
  detail,
  icon,
  tone
}: {
  title: string;
  value: string;
  detail: string;
  icon: string;
  tone: string;
}) {
  return (
    <article className={`rmo-metric rmo-${tone}`}>
      <Icon name={icon} size={37} />
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function RiskTrend({ data }: { data: RiskOverviewData }) {
  const points = data.trend;
  const width = 520;
  const height = 170;
  const left = 33;
  const right = 13;
  const top = 12;
  const bottom = 28;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const x = (index: number) =>
    left + index / Math.max(1, points.length - 1) * plotWidth;

  const y = (score: number) =>
    top + (100 - score) / 100 * plotHeight;

  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];

  points.forEach((point, index) => {
    if (point.score === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push({ x: x(index), y: y(point.score) });
    }
  });

  if (current.length) segments.push(current);

  const last = [...points].reverse().find(p => p.score !== null);
  const latestScore = last?.score ?? null;

  return (
    <div className="rmo-trend">
      <svg viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label="Average daily transaction risk scores over the last 30 days">
        {[0, 25, 50, 75, 100].map(value => (
          <g key={value}>
            <line
              x1={left}
              x2={width - right}
              y1={y(value)}
              y2={y(value)}
              stroke="#d6e2f5"
            />
            <text x={left - 7} y={y(value) + 4} textAnchor="end"
              fill="#334968" fontSize="10">
              {value}
            </text>
          </g>
        ))}

        {segments.map((segment, index) => (
          <g key={index}>
            {segment.length > 1 && (
              <polygon
                points={[
                  `${segment[0].x},${y(0)}`,
                  ...segment.map(point => `${point.x},${point.y}`),
                  `${segment[segment.length - 1].x},${y(0)}`
                ].join(" ")}
                fill="#8465eb"
                opacity="0.13"
              />
            )}
            <polyline
              points={segment.map(point => `${point.x},${point.y}`).join(" ")}
              fill="none"
              stroke="#6433dc"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {segment.map((point, pointIndex) => (
              <circle
                key={pointIndex}
                cx={point.x}
                cy={point.y}
                r="3"
                fill="#6035da"
              />
            ))}
          </g>
        ))}

        {[0, 7, 14, 21, 29].map(index => (
          <text key={index} x={x(index)} y={height - 7}
            textAnchor={index === 0 ? "start" : index === 29 ? "end" : "middle"}
            fontSize="10" fill="#415878">
            {new Date(`${points[index]?.date ?? ""}T00:00:00Z`)
              .toLocaleDateString("en-CA", {
                month: "short",
                day: "numeric",
                timeZone: "UTC"
              })}
          </text>
        ))}
      </svg>

      <div className="rmo-chart-caption">
        {latestScore === null
          ? "No risk assessments recorded in the last 30 days."
          : `Latest recorded daily average: ${latestScore.toFixed(1)}/100`}
      </div>
    </div>
  );
}

function RiskDonut({ data }: { data: RiskOverviewData }) {
  const total = data.summary.totalAssessments;
  let position = 0;

  const portions = levels.map(level => {
    const start = position;
    position += total
      ? data.distribution[level] / total * 100
      : 0;
    return `${colors[level]} ${start}% ${position}%`;
  });

  return (
    <div className="rmo-distribution">
      <div className="rmo-donut" style={{
        background: total
          ? `conic-gradient(${portions.join(", ")})`
          : "#e6edf8"
      }}>
        <div>
          <strong>{total.toLocaleString("en-CA")}</strong>
          <span>Total</span>
        </div>
      </div>

      <div className="rmo-distribution-legend">
        {levels.map(level => {
          const count = data.distribution[level];

          return (
            <div key={level}>
              <span className="rmo-color" style={{
                backgroundColor: colors[level]
              }} />
              <span>{level}</span>
              <strong>{count}</strong>
              <small>{percent(total ? count / total * 100 : 0)}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiskFactors({ data }: { data: RiskOverviewData }) {
  const maximum = Math.max(
    1,
    ...data.topFactors.map(factor => factor.count)
  );

  return (
    <div className="rmo-factors">
      {data.topFactors.length === 0 && (
        <p className="rmo-empty">No triggered risk rules recorded.</p>
      )}

      {data.topFactors.map((factor, index) => (
        <div className="rmo-factor" key={factor.ruleId}>
          <span title={factor.ruleId}>{factor.label}</span>
          <div className="rmo-factor-track">
            <div style={{
              width: `${factor.count / maximum * 100}%`,
              background: [
                "#f12a24", "#fa8d13", "#fbbf0b",
                "#ffdb20", "#ffe967"
              ][index]
            }} />
          </div>
          <strong>{factor.count}</strong>
        </div>
      ))}
    </div>
  );
}

function RiskHeatMap({ data }: { data: RiskOverviewData }) {
  return (
    <div className="rmo-heatmap">
      <div className="rmo-heat-grid">
        <div />
        {["Low", "Medium", "High", "Critical"].map(level => (
          <strong key={level}>{level}</strong>
        ))}

        {[...data.heatMap].reverse().map(band => (
          <div className="rmo-heat-row" key={band.index}>
            <span>{band.label}</span>
            {(["Low", "Medium", "High", "Critical"] as const).map(level => (
              <div key={level}
                className={`rmo-heat-cell rmo-heat-${level.toLowerCase()}`}
                title={`${band.counts[level]} ${level} assessments`}>
                {band.counts[level]}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function HighRiskTable({ data }: { data: RiskOverviewData }) {
  return (
    <div className="rmo-table-wrap">
      <table className="rmo-table">
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Client</th>
            <th>Amount</th>
            <th>Risk</th>
            <th>Approval Status</th>
            <th>Age</th>
          </tr>
        </thead>
        <tbody>
          {data.highRiskTransactions.length === 0 ? (
            <tr>
              <td colSpan={6} className="rmo-empty">
                No high or critical transactions.
              </td>
            </tr>
          ) : data.highRiskTransactions.map(t => (
            <tr key={t.transactionId}>
              <td>
                <Link href={ROUTES.transactionDetails(t.transactionId)}>
                  {t.referenceNumber}
                </Link>
              </td>
              <td>{t.clientName}</td>
              <td>{money(t.amountMinor, t.currency)}</td>
              <td><StatusBadge status={t.riskLevel} /></td>
              <td>
                {t.approvalStatus
                  ? <StatusBadge status={t.approvalStatus} />
                  : "Not available"}
              </td>
              <td>{relativeTime(t.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RiskDashboardPage() {
  const [data, setData] = useState<RiskOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(value => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    getRiskOverview(controller.signal)
      .then(result => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error
            ? err.message
            : "Unable to load risk overview.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey]);

  const summary = data?.summary;

  const exposureDelta = useMemo(() => {
    if (!data) return null;

    const recent = data.trend.filter(
      item => item.score !== null
    );

    if (recent.length < 2) return null;

    return Number((
      recent[recent.length - 1].score! - recent[0].score!
    ).toFixed(1));
  }, [data]);

  if (loading && !data) {
    return <div className="rmo-page">Loading Risk Management Overview...</div>;
  }

  return (
    <section className="rmo-page">
      {error && (
        <div className="rmo-error" role="alert">{error}</div>
      )}

      <div className="rmo-metrics">
        <article className="rmo-exposure">
          <Icon name="speed" size={43} />
          <div>
            <span>Overall Risk Exposure</span>
            <strong>
              {summary?.overallRiskExposure == null
                ? "—"
                : `${summary.overallRiskExposure}/100`}
            </strong>
            {exposureDelta !== null && (
              <small>
                {exposureDelta > 0 ? "+" : ""}
                {exposureDelta} pts (recorded 30-day trend)
              </small>
            )}
          </div>
        </article>

        <Metric
          title="High / Critical Transactions"
          value={String(summary?.highCritical ?? 0)}
          detail={percent(summary?.highCriticalPercentage ?? 0)}
          icon="warning"
          tone="red"
        />

        <Metric
          title="In Review"
          value={String(summary?.inReview ?? 0)}
          detail="Pending approval workflows"
          icon="hourglass_top"
          tone="amber"
        />

        <Metric
          title="Rejected"
          value={String(summary?.blocked ?? 0)}
          detail="Rejected transactions"
          icon="block"
          tone="red"
        />

        <Metric
          title="Completed"
          value={String(summary?.cleared ?? 0)}
          detail="Processed transactions"
          icon="check_circle"
          tone="green"
        />
      </div>

      {data && (
        <>
          <div className="rmo-charts">
            <Panel title="Risk Trend (Last 30 Days)" icon="monitoring">
              <RiskTrend data={data} />
            </Panel>

            <Panel title="Transactions by Risk Level" icon="donut_large">
              <RiskDonut data={data} />
            </Panel>

            <Panel title="Top Risk Factors (Triggered Rules)" icon="trending_up">
              <RiskFactors data={data} />
            </Panel>
          </div>

          <div className="rmo-secondary">
            <Panel
              title={`High & Critical Transactions (${summary?.highCritical ?? 0})`}
              icon="warning"
              action={
                <Link href={ROUTES.riskAssessments}>
                  View All <Icon name="arrow_forward" size={17} />
                </Link>
              }
            >
              <HighRiskTable data={data} />
            </Panel>

            <Panel
              title="Risk Heat Map (Transaction Amount × Risk Level)"
              icon="bar_chart"
            >
              <RiskHeatMap data={data} />
            </Panel>
          </div>

          <div className="rmo-bottom">
            <Panel
              title={`Risk Alerts (${data.alerts.length})`}
              icon="notifications"
              action={
                <Link href={ROUTES.riskAssessments}>
                  View All <Icon name="arrow_forward" size={17} />
                </Link>
              }
            >
              <div className="rmo-alerts">
                {data.alerts.length === 0 && (
                  <p className="rmo-empty">No recent high-risk rule alerts.</p>
                )}
                {data.alerts.map(alert => (
                  <Link
                    href={ROUTES.riskAssessmentDetails(alert.assessmentId)}
                    key={alert.id}
                  >
                    <Icon
                      name="warning"
                      size={17}
                    />
                    <span>
                      {alert.label} — {alert.transactionId.slice(0, 16)}
                    </span>
                    <small>{relativeTime(alert.occurredAt)}</small>
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel title="Risk Management Actions" icon="target">
              <div className="rmo-actions">
                <Link href={ROUTES.riskAssessments} className="rmo-action-red">
                  <Icon name="search" size={32} />
                  <strong>Review High-Risk</strong>
                  <small>({summary?.highCritical ?? 0})</small>
                </Link>

                <Link href={ROUTES.approvalsQueue} className="rmo-action-blue">
                  <Icon name="done" size={32} />
                  <strong>Approve In Review</strong>
                  <small>({summary?.inReview ?? 0})</small>
                </Link>

                <Link href={ROUTES.transactionHistory} className="rmo-action-purple">
                  <Icon name="block" size={32} />
                  <strong>Review Rejected</strong>
                  <small>({summary?.blocked ?? 0})</small>
                </Link>

                <Link href={ROUTES.riskPolicies} className="rmo-action-gray">
                  <Icon name="settings" size={32} />
                  <strong>Adjust Risk Rules</strong>
                </Link>

                <button type="button"
                  className="rmo-action-green"
                  onClick={() => window.print()}>
                  <Icon name="bar_chart" size={32} />
                  <strong>Generate Risk Report</strong>
                </button>
              </div>
            </Panel>
          </div>

          <div className="rmo-footer">
            <span>
              Updated: {new Date(data.generatedAt).toLocaleString("en-CA")}
            </span>
            <button type="button" onClick={refresh}>
              <Icon name="refresh" size={18} />
              Refresh Overview
            </button>
          </div>
        </>
      )}
    </section>
  );
}