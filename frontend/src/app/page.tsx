"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ROUTES } from "../../config";
import {
  DashboardSummary,
  DashboardTrend,
  RecentTransaction,
  getDashboardSummary,
  getDashboardTrend
} from "@/services/dashboard";
import {
  RiskDashboardData,
  getRiskDashboard
} from "@/services/risk-dashboard";
import {
  ApprovalDashboardData,
  getApprovalDashboard
} from "@/services/approval-dashboard";
import {
  ApprovalQueueItem,
  getApprovalQueue
} from "@/services/approval-queue";
import { formatMoney } from "@/services/accounts";
import { Icon, StatusBadge } from "@/components/ui";
import {
  buildOperationsAlerts,
  OperationsAlerts
} from "@/components/dashboard/OperationsAlerts";
import "./dashboard.css";

type DashboardData = {
  summary: DashboardSummary | null;
  trend: DashboardTrend | null;
  risk: RiskDashboardData | null;
  approvals: ApprovalDashboardData | null;
  queue: ApprovalQueueItem[] | null;
};

type Tone = "clients" | "accounts" | "transactions" |
  "risk" | "pending" | "approved";

const number = (value: number) =>
  value.toLocaleString("en-CA");

const riskColors: Record<string, string> = {
  Low: "#098c22",
  Medium: "#f6ae00",
  High: "#ed3333",
  Critical: "#9e1620"
};

function dateText(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
}

function ageText(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000)
  );

  if (!Number.isFinite(minutes)) return "—";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr`;
  return `${Math.floor(minutes / 1440)} days`;
}

function Metric({
  label,
  value,
  tone,
  icon,
  detail,
  href
}: {
  label: string;
  value: number | null;
  tone: Tone;
  icon: string;
  detail: string;
  href: string;
}) {
  return (
    <Link href={href} className={`ops-metric ops-metric-${tone}`}>
      <Icon name={icon} size={38} />
      <div className="ops-metric-copy">
        <span className="ops-metric-label">{label}</span>
        <strong>{value === null ? "—" : number(value)}</strong>
        <small>{detail}</small>
      </div>
    </Link>
  );
}

function Panel({
  title,
  icon,
  href,
  children,
  className = ""
}: {
  title: string;
  icon: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`ops-panel ${className}`}>
      <header className="ops-panel-header">
        <h2>
          <Icon name={icon} size={23} />
          {title}
        </h2>
        {href && (
          <Link href={href} className="ops-view-all">
            View All <Icon name="arrow_forward" size={17} />
          </Link>
        )}
      </header>
      <div className="ops-panel-body">{children}</div>
    </section>
  );
}

function Donut({
  title,
  rows,
  total
}: {
  title: string;
  rows: { label: string; value: number; color: string }[];
  total: number;
}) {
  let position = 0;

  const segments = rows.map(row => {
    const start = position;
    position += total > 0 ? row.value / total * 100 : 0;
    return `${row.color} ${start}% ${position}%`;
  });

  return (
    <div className="ops-donut-content">
      <div
        className="ops-donut"
        style={{
          background: total > 0
            ? `conic-gradient(${segments.join(", ")})`
            : "#e4eaf2"
        }}
        role="img"
        aria-label={`${title}: ${rows.map(row =>
          `${row.label} ${row.value}`).join(", ")}`}
      >
        <div className="ops-donut-center">
          <strong>{number(total)}</strong>
          <span>{title}</span>
        </div>
      </div>
      <div className="ops-legend">
        {rows.map(row => (
          <div className="ops-legend-row" key={row.label}>
            <span
              className="ops-legend-swatch"
              style={{ backgroundColor: row.color }}
            />
            <span>{row.label}</span>
            <span className="ops-legend-percent">
              {total > 0
                ? `${(row.value / total * 100).toFixed(1)}%`
                : "0%"}
            </span>
            <strong>{number(row.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function VolumeChart({
  trend
}: {
  trend: DashboardTrend | null;
}) {
  if (!trend) {
    return <Empty message="Trend data unavailable." />;
  }

  const bucketSize =
    trend.days === 7 ? 1 :
      trend.days === 30 ? 7 : 14;

  const buckets: {
    label: string;
    volume: number;
    assessments: number;
    highRisk: number;
  }[] = [];

  for (let i = 0; i < trend.points.length; i += bucketSize) {
    const points = trend.points.slice(i, i + bucketSize);
    const first = points[0];
    const last = points[points.length - 1];

    const formatDate = (value: string) => {
      const [year, month, day] = value.split("-").map(Number);

      return new Date(
        Date.UTC(year, month - 1, day)
      ).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        timeZone: "UTC"
      });
    };

    buckets.push({
      label: first.date === last.date
        ? formatDate(first.date)
        : `${formatDate(first.date)}–${formatDate(last.date)}`,
      volume: points.reduce(
        (sum, point) => sum + point.transactionCount, 0
      ),
      assessments: points.reduce(
        (sum, point) => sum + point.assessmentCount, 0
      ),
      highRisk: points.reduce(
        (sum, point) => sum + point.highRiskCount, 0
      )
    });
  }

  const width = 600;
  const height = 300;
  const left = 45;
  const right = 48;
  const top = 20;
  const bottom = 53;

  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const maxVolume = Math.max(
    1,
    ...buckets.map(item => item.volume)
  );

  const volumeScale = Math.max(
    5,
    Math.ceil(maxVolume / 5) * 5
  );

  const rates = buckets.map(item =>
    item.assessments > 0
      ? item.highRisk / item.assessments * 100
      : null
  );

  const maxRate = Math.max(
    10,
    ...rates.filter((rate): rate is number => rate !== null)
  );

  const rateScale = Math.min(
    100,
    Math.ceil(maxRate / 10) * 10
  );

  const step = plotWidth / Math.max(1, buckets.length);
  const barWidth = Math.min(56, step * 0.65);

  const centerX = (index: number) =>
    left + step * (index + 0.5);

  const rateY = (value: number) =>
    top + plotHeight * (1 - value / rateScale);

  const volumeY = (value: number) =>
    top + plotHeight * (1 - value / volumeScale);

  const segments: string[] = [];
  let current: string[] = [];

  rates.forEach((rate, index) => {
    if (rate === null) {
      if (current.length > 1) {
        segments.push(current.join(" "));
      }
      current = [];
      return;
    }

    current.push(
      `${current.length ? "L" : "M"} ${centerX(index)} ${rateY(rate)}`
    );
  });

  if (current.length > 1) {
    segments.push(current.join(" "));
  }

  return (
    <div className="ops-trend">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="ops-trend-svg"
        role="img"
        aria-label="Transaction volume and high-risk assessment rate by period"
      >
        <defs>
          <linearGradient id="opsVolumeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#238af1" />
            <stop offset="100%" stopColor="#58b4f3" />
          </linearGradient>
        </defs>

        {Array.from({ length: 6 }, (_, index) => {
          const y = top + plotHeight * index / 5;
          const volume = volumeScale * (5 - index) / 5;
          const rate = rateScale * (5 - index) / 5;

          return (
            <g key={index}>
              <line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke="#cdd8e5"
              />
              <text
                x={left - 9}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fill="#142b4c"
              >
                {Math.round(volume)}
              </text>
              <text
                x={width - right + 9}
                y={y + 4}
                fontSize="12"
                fill="#e22121"
              >
                {rate.toFixed(0)}%
              </text>
            </g>
          );
        })}

        {buckets.map((bucket, index) => {
          const x = centerX(index);
          const y = volumeY(bucket.volume);

          return (
            <g key={index}>
              <rect
                x={x - barWidth / 2}
                y={y}
                width={barWidth}
                height={top + plotHeight - y}
                rx="5"
                fill="url(#opsVolumeGradient)"
                stroke="#1686e6"
              />
              <text
                x={x}
                y={height - bottom + 21}
                textAnchor="middle"
                fontSize="10"
                fill="#132e52"
              >
                {bucket.label}
              </text>
            </g>
          );
        })}

        {segments.map((segment, index) => (
          <path
            key={index}
            d={segment}
            stroke="#f02020"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {rates.map((rate, index) =>
          rate === null ? null : (
            <circle
              key={index}
              cx={centerX(index)}
              cy={rateY(rate)}
              r="5"
              fill="#fff"
              stroke="#ef2020"
              strokeWidth="2.5"
            />
          )
        )}
      </svg>

      <div className="ops-trend-legend">
        <span>
          <i className="ops-trend-key ops-trend-key-volume" />
          Transaction Volume
        </span>
        <span>
          <i className="ops-trend-key ops-trend-key-risk" />
          High-Risk Assessment Rate (%)
        </span>
      </div>
    </div>
  );
}

function Lifecycle({ data }: { data: DashboardData }) {
  const summary = data.summary;
  const approvals = data.approvals;

  const items = [
    {
      label: "Created",
      icon: "description",
      value: summary?.totalTransactions ?? null,
      color: "blue"
    },
    {
      label: "Assessed",
      icon: "verified_user",
      value: data.risk?.totalAssessments ?? null,
      color: "blue"
    },
    {
      label: "Pending Approval",
      icon: "hourglass_top",
      value: approvals?.awaitingReview ?? null,
      color: "amber"
    },
    {
      label: "Approved",
      icon: "check",
      value: approvals?.approvedWorkflows ?? null,
      color: "green"
    },
    {
      label: "Rejected",
      icon: "cancel",
      value: approvals?.rejectedWorkflows ?? null,
      color: "red"
    },
    {
      label: "Processed",
      icon: "double_arrow",
      value: summary?.completedTransactions ?? null,
      color: "blue"
    }
  ];

  const total = summary?.totalTransactions ?? 0;

  const percentage = (value: number | null) => {
    if (value === null || total <= 0) return "—";
    return `${(value / total * 100).toFixed(1)}%`;
  };

  return (
    <div className="ops-lifecycle">
      {items.map((item, index) => (
        <div className="ops-lifecycle-item" key={item.label}>
          {index > 0 && (
            <Icon name="arrow_forward" size={22} />
          )}

          <div className={`ops-stage ops-stage-${item.color}`}>
            <Icon name={item.icon} size={30} />

            <span>{item.label}</span>

            <strong>
              {item.value === null
                ? "—"
                : number(item.value)}
            </strong>

            <small>({percentage(item.value)})</small>
          </div>
        </div>
      ))}
    </div>
  );

}

function Empty({ message }: { message: string }) {
  return <p className="ops-empty">{message}</p>;
}

function RecentTransactions({
  items
}: {
  items: RecentTransaction[];
}) {
  if (!items.length) {
    return <Empty message="No recent transactions." />;
  }

  return (
    <div className="ops-table-scroll">
      <table className="ops-table">
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 5).map(item => (
            <tr key={item.transactionId}>
              <td>
                <Link href={ROUTES.transactionDetails(item.transactionId)}>
                  {item.referenceNumber}
                </Link>
              </td>
              <td>{formatMoney(item.amountMinor, item.currency)}</td>
              <td><StatusBadge status={item.status} /></td>
              <td>{dateText(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HighRisk({ data }: { data: RiskDashboardData | null }) {
  if (!data) return <Empty message="Risk data unavailable." />;

  const items = data.recentHighRiskAssessments.slice(0, 5);
  if (!items.length) {
    return <Empty message="No recent high-risk assessments." />;
  }

  return (
    <div className="ops-table-scroll">
      <table className="ops-table">
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Risk Level</th>
            <th>Score</th>
            <th>Assessed</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.assessmentId}>
              <td>
                <Link href={ROUTES.riskAssessmentDetails(item.assessmentId)}>
                  {item.transactionId.slice(0, 12)}
                </Link>
              </td>
              <td><StatusBadge status={item.riskLevel} /></td>
              <td>
                <span className="ops-score">{item.riskScore}</span>
              </td>
              <td>{dateText(item.assessedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PendingApprovals({
  items
}: {
  items: ApprovalQueueItem[] | null;
}) {
  if (!items) {
    return <Empty message="Approval queue unavailable." />;
  }
  if (!items.length) {
    return <Empty message="No pending approvals." />;
  }

  return (
    <div className="ops-table-scroll">
      <table className="ops-table">
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Amount</th>
            <th>Risk</th>
            <th>Age</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.workflowId}>
              <td>
                <Link href={ROUTES.approvalDetails(item.workflowId)}>
                  {item.referenceNumber}
                </Link>
              </td>
              <td>{formatMoney(item.amountMinor, item.currency)}</td>
              <td><StatusBadge status={item.riskLevel} /></td>
              <td>
                <span className="ops-age">
                  {ageText(item.createdAt)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const quickActions = [
  {
    label: "New Transaction",
    icon: "swap_horiz",
    href: ROUTES.transactionCreate
  },
  {
    label: "Risk Assessments",
    icon: "verified_user",
    href: ROUTES.riskAssessments
  },
  {
    label: "Approval Queue",
    icon: "assignment_turned_in",
    href: ROUTES.approvalsQueue
  },
  {
    label: "Manage Policies",
    icon: "settings",
    href: ROUTES.riskPolicies
  }
];

export default function DashboardPage() {

  const [days, setDays] = useState<7 | 30 | 90>(30);

  const [data, setData] = useState<DashboardData>({
    summary: null,
    trend: null,
    risk: null,
    approvals: null,
    queue: null
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (
    signal?: AbortSignal,
    isRefresh = false
  ) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const [summary, trend, risk, approvals, queue] =
        await Promise.allSettled([
          getDashboardSummary(signal),
          getDashboardTrend(days, signal),
          getRiskDashboard(signal),
          getApprovalDashboard(signal),
          getApprovalQueue({
            page: 1,
            pageSize: 5,
            sortBy: "createdAt",
            sortOrder: "desc"
          }, signal)
        ]);

      if (signal?.aborted) return;

      const fulfilled = <T,>(
        result: PromiseSettledResult<T>
      ): T | null =>
        result.status === "fulfilled" ? result.value : null;

      const nextData: DashboardData = {
        summary: fulfilled(summary),
        trend: fulfilled(trend),
        risk: fulfilled(risk),
        approvals: fulfilled(approvals),
        queue: fulfilled(queue)?.data ?? null
      };

      if (Object.values(nextData).some(value => value === null)) {
        setError(
          "Some dashboard statistics are unavailable. Please refresh."
        );
      }

      setData(nextData);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [days]);


  useEffect(() => {
    const controller = new AbortController();
    void loadDashboard(controller.signal);
    return () => controller.abort();
  }, [loadDashboard]);

  const { summary, trend, risk, approvals, queue } = data;

  const riskRows = risk
    ? [
      { label: "Low", value: risk.riskLevels.Low, color: riskColors.Low },
      { label: "Medium", value: risk.riskLevels.Medium, color: riskColors.Medium },
      { label: "High", value: risk.riskLevels.High, color: riskColors.High },
      { label: "Critical", value: risk.riskLevels.Critical, color: riskColors.Critical }
    ]
    : [];

  const approvalRows = approvals
    ? [
      { label: "Approved", value: approvals.approvedWorkflows, color: "#0a9625" },
      { label: "Rejected", value: approvals.rejectedWorkflows, color: "#e33232" },
      { label: "Escalated", value: approvals.escalatedWorkflows, color: "#166ed4" },
      { label: "Pending", value: approvals.pendingWorkflows, color: "#f0b52e" },
      { label: "In Review", value: approvals.inReviewWorkflows, color: "#8050ba" },
      { label: "Cancelled", value: approvals.cancelledWorkflows, color: "#aab3bd" }
    ]
    : [];

  const alerts = buildOperationsAlerts(risk, approvals);

  if (loading) {
    return <div className="ops-loading" role="status">
      <Icon name="progress_activity" size={32} />
      Loading operations dashboard...
    </div>;
  }

  return (
    <section className="ops-dashboard">

      <div className="ops-dashboard-toolbar">
        <div className="ops-period-control">
          <Icon name="calendar_month" size={21} />
          <select
            value={days}
            onChange={event =>
              setDays(Number(event.target.value) as 7 | 30 | 90)
            }
            aria-label="Trend reporting period"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </div>

        <button
          type="button"
          className="ops-refresh"
          onClick={() => void loadDashboard(undefined, true)}
          disabled={refreshing}
          aria-label="Refresh dashboard"
        >
          <Icon name="refresh" size={23} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>


      {error && <div className="ops-error" role="alert">{error}</div>}

      <div className="ops-metrics">
        <Metric
          label="Clients"
          value={summary?.totalClients ?? null}
          tone="clients"
          icon="layers"
          detail={summary
            ? `${number(summary.growthStatistics.newClientsThisMonth)} new this month`
            : "Unavailable"}
          href={ROUTES.clients}
        />
        <Metric
          label="Accounts"
          value={summary?.totalAccounts ?? null}
          tone="accounts"
          icon="account_balance_wallet"
          detail={summary
            ? `${number(summary.growthStatistics.newAccountsThisMonth)} new this month`
            : "Unavailable"}
          href={ROUTES.accounts}
        />
        <Metric
          label="Transactions"
          value={summary?.totalTransactions ?? null}
          tone="transactions"
          icon="swap_horiz"
          detail="All recorded transactions"
          href={ROUTES.transactions}
        />
        <Metric
          label="High Risk"
          value={risk
            ? risk.riskLevels.High + risk.riskLevels.Critical : null}
          tone="risk"
          icon="warning"
          detail="High and critical assessments"
          href={ROUTES.riskAssessments}
        />
        <Metric
          label="Pending Approval"
          value={approvals?.awaitingReview ?? null}
          tone="pending"
          icon="hourglass_top"
          detail="Awaiting review"
          href={ROUTES.approvalsQueue}
        />
        <Metric
          label="Approved"
          value={approvals?.approvedWorkflows ?? null}
          tone="approved"
          icon="check_circle"
          detail="Approved workflows"
          href={ROUTES.approvals}
        />
      </div>

      <div className="ops-main-grid">
        <div className="ops-analytics">

          <Panel
            title="Transaction Volume & Risk Trend"
            icon="monitoring"
            className="ops-chart-panel"
          >
            <VolumeChart trend={trend} />
          </Panel>

          <Panel title="Risk Distribution" icon="pie_chart">
            {risk ? (
              <Donut
                title="Assessments"
                total={risk.totalAssessments}
                rows={riskRows}
              />
            ) : (
              <Empty message="Risk data unavailable." />
            )}
          </Panel>

          <Panel title="Approval Outcomes" icon="donut_large">
            {approvals ? (
              <Donut
                title="Workflows"
                total={approvals.totalWorkflows}
                rows={approvalRows}
              />
            ) : (
              <Empty message="Approval data unavailable." />
            )}
          </Panel>

          <Panel
            title="Transaction Lifecycle"
            icon="layers"
            className="ops-lifecycle-panel"
          >
            <Lifecycle data={data} />
            <p className="ops-lifecycle-note">
              Operational totals across different workflows.
              These are not a single transaction cohort.
            </p>
          </Panel>
        </div>

        <div className="ops-side-panels">

          <Panel
            title="Alerts & Actions"
            icon="notifications_active"
            className="ops-alerts-panel"
          >
            <OperationsAlerts alerts={alerts} />
          </Panel>


          <Panel title="Quick Actions" icon="bolt">
            <div className="ops-quick-grid">
              {quickActions.map(action => (
                <Link
                  href={action.href}
                  key={action.label}
                  className="ops-quick-action"
                >
                  <Icon name={action.icon} size={34} />
                  <span>{action.label}</span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="ops-bottom-grid">
        <Panel
          title="Recent Transactions"
          icon="layers"
          href={ROUTES.transactions}
        >
          {summary
            ? <RecentTransactions items={summary.recentTransactions} />
            : <Empty message="Transaction data unavailable." />}
        </Panel>

        <Panel
          title="High-Risk Assessments"
          icon="warning"
          href={ROUTES.riskAssessments}
        >
          <HighRisk data={risk} />
        </Panel>

        <Panel
          title="Pending Approvals"
          icon="hourglass_top"
          href={ROUTES.approvalsQueue}
        >
          <PendingApprovals items={queue} />
        </Panel>
      </div>
    </section>
  );
}