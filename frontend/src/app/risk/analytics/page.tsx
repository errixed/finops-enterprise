"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import {
  getRiskAnalytics,
  type RiskAnalyticsData,
  type RiskCounts,
  type AnalyticsRiskLevel
} from "@/services/risk-analytics";
import "./risk-analytics.css";
import RiskJurisdictionMap from "@/components/risk/RiskJurisdictionMap";

const levels: AnalyticsRiskLevel[] = [
  "Low",
  "Medium",
  "High",
  "Critical"
];

const colors: Record<AnalyticsRiskLevel, string> = {
  Low: "#21b955",
  Medium: "#ffc32f",
  High: "#ff8e43",
  Critical: "#ef383d"
};

function number(value: number) {
  return value.toLocaleString("en-CA");
}

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function shortDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    month: "short",
    day: "2-digit"
  });
}

function percentage(part: number, whole: number) {
  return whole ? (part / whole * 100).toFixed(1) : "0.0";
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
    <section className="ran-panel">
      <header className="ran-panel-header">
        <h2>
          <Icon name={icon} size={22} />
          {title}
        </h2>
      </header>
      <div className="ran-panel-content">{children}</div>
    </section>
  );
}

function Metric({
  title,
  icon,
  value,
  change,
  suffix,
  tone,
  score = false
}: {
  title: string;
  icon: string;
  value: string;
  change: number | null;
  suffix?: string;
  tone: string;
  score?: boolean;
}) {
  const improving = change !== null &&
    (score ? change <= 0 : change >= 0);

  return (
    <article className={`ran-metric ran-metric-${tone}`}>
      <div className="ran-metric-icon">
        <Icon name={icon} size={27} />
      </div>
      <div className="ran-metric-body">
        <span>{title}</span>
        <div className="ran-metric-value">
          <strong>{value}</strong>
          {suffix && <small>{suffix}</small>}
        </div>
        <div className="ran-metric-delta">
          {change === null ? (
            <span className="ran-no-comparison">
              No previous-period comparison
            </span>
          ) : (
            <span className={improving ? "ran-up" : "ran-down"}>
              {change > 0 ? "▲" : change < 0 ? "▼" : "—"}
              {" "}
              {change > 0 ? "+" : ""}
              {change.toFixed(1)}
              {score ? " pts" : "%"}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function TrendChart({
  trend
}: {
  trend: RiskAnalyticsData["trend"];
}) {
  const width = 900;
  const height = 310;
  const left = 47;
  const top = 20;
  const right = 49;
  const bottom = 47;

  const graphWidth = width - left - right;
  const graphHeight = height - top - bottom;

  const totals = trend.map(row =>
    levels.reduce((sum, level) => sum + row[level], 0)
  );

  const maxTotal = Math.max(5, ...totals);
  const maxCount = Math.ceil(maxTotal / 5) * 5;

  const barSlot = graphWidth / Math.max(1, trend.length);
  const barWidth = Math.max(3, barSlot * 0.67);

  const scorePoints = trend
    .map((row, index) => {
      if (row.averageScore === null) return null;

      const x = left + index * barSlot + barSlot / 2;
      const y = top + graphHeight *
        (1 - row.averageScore / 100);

      return { x, y, score: row.averageScore };
    });

  const lineSegments: string[] = [];
  let currentSegment = "";

  for (const point of scorePoints) {
    if (!point) {
      if (currentSegment) lineSegments.push(currentSegment);
      currentSegment = "";
      continue;
    }

    currentSegment += `${currentSegment ? " L" : "M"}${point.x},${point.y}`;
  }

  if (currentSegment) lineSegments.push(currentSegment);

  const labelStep = Math.max(1, Math.ceil(trend.length / 7));

  return (
    <div className="ran-trend">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Daily risk assessment counts by level and average risk score"
      >
        {Array.from({ length: 6 }, (_, index) => {
          const value = maxCount * index / 5;
          const y = top + graphHeight - graphHeight * index / 5;

          return (
            <g key={index}>
              <line
                x1={left}
                y1={y}
                x2={width - right}
                y2={y}
                stroke="#d9e6f5"
              />
              <text
                x={left - 9}
                y={y + 4}
                textAnchor="end"
                fill="#48658b"
                fontSize="12"
              >
                {Math.round(value)}
              </text>
              <text
                x={width - right + 8}
                y={y + 4}
                fill="#48658b"
                fontSize="12"
              >
                {Math.round(index * 20)}
              </text>
            </g>
          );
        })}

        {trend.map((row, index) => {
          let accumulated = 0;

          return (
            <g key={row.day}>
              {levels.map(level => {
                const value = row[level];
                const barHeight = value / maxCount * graphHeight;
                const y = top + graphHeight -
                  accumulated - barHeight;

                accumulated += barHeight;

                return (
                  <rect
                    key={level}
                    x={left + index * barSlot +
                      (barSlot - barWidth) / 2}
                    y={y}
                    width={barWidth}
                    height={Math.max(0, barHeight)}
                    fill={colors[level]}
                  >
                    <title>
                      {`${row.day}: ${level} ${value}`}
                    </title>
                  </rect>
                );
              })}

              {(index % labelStep === 0 ||
                index === trend.length - 1) && (
                <text
                  x={left + index * barSlot + barSlot / 2}
                  y={height - 22}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#355887"
                >
                  {shortDate(row.day)}
                </text>
              )}
            </g>
          );
        })}

        {lineSegments.map((segment, index) => (
          <path
            key={index}
            d={segment}
            fill="none"
            stroke="#0754dc"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {scorePoints.filter(point => point !== null).map(
          (point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="3.5"
              fill="#fff"
              stroke="#0754dc"
              strokeWidth="2"
            >
              <title>Average score: {point.score}</title>
            </circle>
          )
        )}
      </svg>

      <div className="ran-legend">
        {levels.map(level => (
          <span key={level}>
            <i style={{ background: colors[level] }} />
            {level}
          </span>
        ))}
        <span>
          <i className="ran-line-legend" />
          Avg. Risk Score
        </span>
      </div>
    </div>
  );
}

function DistributionChart({
  counts
}: {
  counts: RiskCounts;
}) {
  const total = levels.reduce(
    (sum, level) => sum + counts[level],
    0
  );

  let accumulated = 0;

  const segments = levels.map(level => {
    const start = accumulated;
    const portion = total ? counts[level] / total * 100 : 0;
    accumulated += portion;

    return `${colors[level]} ${start}% ${accumulated}%`;
  });

  return (
    <div className="ran-distribution">
      <div
        className="ran-donut"
        style={{
          background: total
            ? `conic-gradient(${segments.join(",")})`
            : "#e6edf7"
        }}
        role="img"
        aria-label={`Risk distribution across ${total} assessments`}
      >
        <div className="ran-donut-center">
          <strong>{number(total)}</strong>
          <span>Assessments</span>
        </div>
      </div>

      <div className="ran-distribution-legend">
        {levels.map(level => (
          <div key={level}>
            <i style={{ background: colors[level] }} />
            <span>{level} Risk</span>
            <strong>
              {percentage(counts[level], total)}%
              {" "}
              ({number(counts[level])})
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function IndustryChart({
  rows
}: {
  rows: RiskAnalyticsData["industries"];
}) {
  const visible = rows.slice(0, 6);
  const max = Math.max(1, ...visible.map(row => row.total));

  if (!visible.length) {
    return <p className="ran-empty">No industry breakdown available.</p>;
  }

  return (
    <div className="ran-industries">
      {visible.map(row => (
        <div className="ran-industry-row" key={row.name}>
          <span title={row.name}>{row.name}</span>

          <div className="ran-industry-track">
            <div
              className="ran-industry-bar"
              style={{ width: `${row.total / max * 100}%` }}
            >
              {levels.map(level => (
                <div
                  key={level}
                  style={{
                    width: `${row.total
                      ? row[level] / row.total * 100
                      : 0}%`,
                    background: colors[level]
                  }}
                  title={`${level}: ${row[level]}`}
                />
              ))}
            </div>
          </div>

          <strong>{number(row.total)}</strong>
        </div>
      ))}

      <p className="ran-chart-note">
        Grouped by recorded client industry. Bar length reflects
        assessment count; colors show risk distribution.
      </p>
    </div>
  );
}

function TopTriggers({
  rows,
  total
}: {
  rows: RiskAnalyticsData["triggers"];
  total: number;
}) {
  return (
    <div className="ran-table-scroll">
      <table className="ran-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Rule ID</th>
            <th>Rule Name</th>
            <th>Triggered</th>
            <th>% of Assessments</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={row.ruleId}>
              <td>{index + 1}</td>
              <td>
                <span className="ran-rule-link">
                  {row.ruleId}
                </span>
              </td>
              <td>{row.name}</td>
              <td>{number(row.triggered)}</td>
              <td>{row.percent.toFixed(1)}%</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={5} className="ran-empty">
                No triggered rules in this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {total > 0 && (
        <p className="ran-chart-note">
          One assessment may trigger multiple rules.
        </p>
      )}
    </div>
  );
}

function Jurisdictions({
  rows
}: {
  rows: RiskAnalyticsData["jurisdictions"];
}) {
  return (
    <div className="ran-jurisdictions">
      <RiskJurisdictionMap jurisdictions={rows} />

      <div className="ran-table-scroll">
        <table className="ran-table">
          <thead>
            <tr>
              <th>Jurisdiction</th>
              <th>Assessments</th>
              <th>High / Critical</th>
              <th>Risk Rate</th>
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map(row => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.assessments.toLocaleString("en-CA")}</td>
                  <td>{row.highRisk.toLocaleString("en-CA")}</td>
                  <td>{row.riskRate.toFixed(1)}%</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="ran-empty">
                  No assessments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RiskAnalyticsPage() {
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const [policy, setPolicy] = useState("all");
  const [data, setData] = useState<RiskAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    getRiskAnalytics(period, policy, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setData(result);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load risk analytics."
        );
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [period, policy]);

  const metrics = data?.metrics;

  const periodLabel = useMemo(() => {
    if (!data) return `Last ${period} Days`;

    const endDay = new Date(`${data.period.end}T00:00:00Z`);
    endDay.setUTCDate(endDay.getUTCDate() - 1);

    return `${dateLabel(data.period.start)} – ${dateLabel(
      endDay.toISOString().slice(0, 10)
    )}`;
  }, [data, period]);

  return (
    <main className="ran-page">
      <div className="ran-breadcrumb">
        <Link href="/risk">Risk Management</Link>
        <Icon name="chevron_right" size={19} />
        <strong>Risk Analytics</strong>
      </div>

      <div className="ran-heading">
        <div className="ran-title">
          <Icon name="bar_chart" size={36} />
          <h1>Risk Analytics</h1>
        </div>

        <div className="ran-filters">
          <label>
            <span>Reporting Period</span>
            <select
              value={period}
              onChange={event =>
                setPeriod(event.target.value as "7" | "30" | "90")
              }
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
            <small>{periodLabel}</small>
          </label>

          <label>
            <span>Policy Version</span>
            <select
              value={policy}
              onChange={event => setPolicy(event.target.value)}
            >
              <option value="all">All Policy Versions</option>
              {data?.policies.map(item => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="ran-description">
        Analyze risk exposure, trends, and assessment outcomes to
        identify patterns and manage financial risk effectively.
      </p>

      {error && (
        <div className="ran-error" role="alert">{error}</div>
      )}

      {loading && (
        <div className="ran-loading" role="status">
          Loading risk analytics...
        </div>
      )}

      {!loading && data && metrics && (
        <>
          <div className="ran-metrics">
            <Metric
              title="Assessments"
              icon="groups"
              value={number(metrics.assessments)}
              change={metrics.changes.assessments}
              tone="blue"
            />
            <Metric
              title="High / Critical Risk"
              icon="warning"
              value={number(metrics.highRisk)}
              change={metrics.changes.highRisk}
              tone="red"
            />
            <Metric
              title="Medium Risk"
              icon="report_problem"
              value={number(metrics.mediumRisk)}
              change={metrics.changes.mediumRisk}
              tone="yellow"
            />
            <Metric
              title="Low Risk"
              icon="check_circle"
              value={number(metrics.lowRisk)}
              change={metrics.changes.lowRisk}
              tone="green"
            />
            <Metric
              title="Avg. Risk Score"
              icon="adjust"
              value={metrics.averageScore?.toFixed(1) ?? "—"}
              change={metrics.changes.averageScore}
              tone="blue"
              score
            />
          </div>

          <div className="ran-chart-grid">
            <Panel title="Risk Assessments Trend" icon="trending_up">
              <TrendChart trend={data.trend} />
            </Panel>

            <Panel title="Risk Distribution" icon="donut_large">
              <DistributionChart counts={data.distribution} />
            </Panel>

            <Panel title="Risk by Client Industry" icon="domain">
              <IndustryChart rows={data.industries} />
            </Panel>
          </div>

          <div className="ran-bottom-grid">
            <Panel title="Top Risk Triggers" icon="track_changes">
              <TopTriggers
                rows={data.triggers}
                total={metrics.assessments}
              />
            </Panel>

            <Panel title="Risk Assessments by Jurisdiction" icon="location_on">
              <Jurisdictions rows={data.jurisdictions} />
            </Panel>
          </div>
        </>
      )}
    </main>
  );
}
