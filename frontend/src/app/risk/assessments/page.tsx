"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ROUTES } from "../../../../config";
import { Icon, StatusBadge } from "@/components/ui";
import {
  type AssessmentDashboardRow,
  type AssessmentDashboardResult,
  getAssessmentDashboard
} from "@/services/risk-assessment-dashboard";
import "./risk-assessment-dashboard.css";

const pageSizes = [5, 10, 20, 50, 100];

function formatAmount(value: string, currency: string) {
  try {
    const amount = BigInt(value);
    const negative = amount < BigInt(0);
    const absolute = negative ? -amount : amount;

    return `${negative ? "−" : ""}${(
      absolute / BigInt(100)
    ).toLocaleString("en-CA")}.${String(
      absolute % BigInt(100)
    ).padStart(2, "0")} ${currency}`;
  } catch {
    return "—";
  }
}

function dateTime(value: string | null) {
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

function Stat({
  title,
  value,
  detail,
  icon,
  tone
}: {
  title: string;
  value: string;
  detail?: string;
  icon: string;
  tone: string;
}) {
  return (
    <article className={`rad-stat rad-stat-${tone}`}>
      <Icon name={icon} size={32} />
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </article>
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
    <section className="rad-panel">
      <header className="rad-panel-header">
        <h2>
          <Icon name={icon} size={22} />
          {title}
        </h2>
      </header>
      <div className="rad-panel-content">
        {children}
      </div>
    </section>
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
    <div className="rad-info-row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function exportAssessment(
  row: AssessmentDashboardRow,
  rules: AssessmentDashboardResult["rules"]
) {
  const evaluation = rules.map(rule => {
    const match = row.triggeredRules.find(
      item => item.ruleId === rule.ruleId
    );

    return [
      rule.ruleId,
      rule.name,
      match ? "Triggered" : "Not recorded as triggered",
      match?.points ?? 0,
      match?.reason ?? ""
    ];
  });

  const lines = [
    ["Field", "Value"],
    ["Assessment ID", row.assessmentId],
    ["Transaction ID", row.transactionId],
    ["Reference", row.referenceNumber],
    ["Client", row.clientName],
    ["Risk Score", row.riskScore],
    ["Risk Level", row.riskLevel],
    ["Policy Version", row.policyVersion],
    ["Assessed At", row.assessedAt ?? ""],
    [],
    ["Rule ID", "Rule Name", "Result", "Points", "Details"],
    ...evaluation
  ];

  const escape = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };

  const csv = lines
    .map(line => line.map(escape).join(","))
    .join("\r\n");

  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8"
    })
  );

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `risk-assessment-${row.assessmentId}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function RiskAssessmentPage() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentDashboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    getAssessmentDashboard({
      search: appliedSearch,
      page,
      pageSize
    }, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;

        setResult(data);

        setSelectedId(previous =>
          data.data.some(item => item.assessmentId === previous)
            ? previous
            : data.data[0]?.assessmentId ?? null
        );
      })
      .catch(err => {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load risk assessments."
        );

        setResult(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [appliedSearch, page, pageSize]);

  const rows = result?.data ?? [];
  const selected = rows.find(
    row => row.assessmentId === selectedId
  ) ?? null;

  const evaluation = useMemo(() => {
    if (!selected || !result) return [];

    return result.rules.map(rule => {
      const triggered = selected.triggeredRules.find(
        item => item.ruleId === rule.ruleId
      );

      return {
        ...rule,
        triggered,
        contribution: triggered?.points ?? 0,
        details: triggered?.reason ??
          "No trigger recorded for this rule"
      };
    });
  }, [selected, result]);

  const summary = result?.statistics;
  const total = result?.pagination.total ?? 0;
  const totalPages = result?.pagination.totalPages ?? 0;

  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }

  return (
    <section className="rad-page">
      <div className="rad-metrics">
        <Stat
          title="Assessments (Last 30 Days)"
          value={String(summary?.assessments ?? 0)}
          icon="description"
          tone="blue"
        />

        <Stat
          title="High / Critical"
          value={String(summary?.highCritical ?? 0)}
          detail={summary?.assessments
            ? `${(summary.highCritical / summary.assessments * 100).toFixed(1)}%`
            : "0.0%"}
          icon="warning"
          tone="red"
        />

        <Stat
          title="In Review"
          value={String(summary?.inReview ?? 0)}
          detail={summary?.assessments
            ? `${(summary.inReview / summary.assessments * 100).toFixed(1)}%`
            : "0.0%"}
          icon="hourglass_top"
          tone="amber"
        />

        <Stat
          title="Completed"
          value={String(summary?.completed ?? 0)}
          detail={summary?.assessments
            ? `${(summary.completed / summary.assessments * 100).toFixed(1)}%`
            : "0.0%"}
          icon="check_circle"
          tone="green"
        />

        <Stat
          title="Avg. Risk Score"
          value={summary?.averageScore == null
            ? "—"
            : `${summary.averageScore} / 100`}
          icon="target"
          tone="blue"
        />
      </div>

      {error && (
        <div className="rad-error" role="alert">
          {error}
        </div>
      )}

      <div className="rad-layout">
        <Panel title="Transactions for Risk Assessment" icon="description">
          <form className="rad-search" onSubmit={applySearch}>
            <Icon name="search" size={21} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by transaction ID, client, or amount..."
              aria-label="Search risk assessments"
            />
            <button type="submit">
              <Icon name="search" size={19} />
              Search
            </button>
          </form>

          <div className="rad-table-scroll">
            <table className="rad-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Risk</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="rad-empty">
                      Loading assessments...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="rad-empty">
                      No matching assessments found.
                    </td>
                  </tr>
                ) : rows.map(row => (
                  <tr
                    key={row.assessmentId}
                    className={
                      row.assessmentId === selectedId
                        ? "rad-selected-row"
                        : ""
                    }
                    onClick={() => setSelectedId(row.assessmentId)}
                  >
                    <td>
                      <button
                        type="button"
                        className="rad-transaction-link"
                        onClick={() => setSelectedId(row.assessmentId)}
                      >
                        {row.referenceNumber}
                      </button>
                    </td>
                    <td>{row.clientName}</td>
                    <td>{formatAmount(row.amountMinor, row.currency)}</td>
                    <td><StatusBadge status={row.riskLevel} /></td>
                    <td>
                      <StatusBadge
                        status={row.approvalStatus ?? row.transactionStatus}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="rad-pagination">
            <div>
              <label htmlFor="rad-page-size">Rows per page:</label>
              <select
                id="rad-page-size"
                value={pageSize}
                onChange={event => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                {pageSizes.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span>{start}–{end} of {total}</span>
            </div>

            <div className="rad-pagination-buttons">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                aria-label="Previous page"
              >
                <Icon name="chevron_left" size={19} />
              </button>

              <span>{page} / {Math.max(1, totalPages)}</span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                aria-label="Next page"
              >
                <Icon name="chevron_right" size={19} />
              </button>
            </div>
          </footer>
        </Panel>

        <div className="rad-right">
          <Panel
            title={`Risk Assessment${selected ? ` — ${selected.referenceNumber}` : ""}`}
            icon="description"
          >
            {selected ? (
              <div className="rad-assessment-summary">
                <div className="rad-assessment-client">
                  <InfoRow label="Client">{selected.clientName}</InfoRow>
                  <InfoRow label="Amount">
                    {formatAmount(selected.amountMinor, selected.currency)}
                  </InfoRow>
                  <InfoRow label="Type">{selected.transactionType}</InfoRow>
                  <InfoRow label="Date">{dateTime(selected.assessedAt)}</InfoRow>
                </div>

                <div className="rad-assessment-score">
                  <span>Risk Score</span>
                  <strong className={`rad-score-${selected.riskLevel.toLowerCase()}`}>
                    {selected.riskScore}
                    <small> / 100</small>
                  </strong>
                  <StatusBadge status={selected.riskLevel} />
                </div>

                <div className="rad-assessment-meta">
                  <InfoRow label="Assessment ID">
                    {selected.assessmentId}
                  </InfoRow>
                  <InfoRow label="Policy Version">
                    v{selected.policyVersion}
                  </InfoRow>
                  <InfoRow label="Assessed On">
                    {dateTime(selected.assessedAt)}
                  </InfoRow>
                  <InfoRow label="Assessed By">
                    Risk Engine (Automated)
                  </InfoRow>
                </div>
              </div>
            ) : (
              <p className="rad-empty">Select an assessment to view its details.</p>
            )}
          </Panel>

          <Panel title="Rule Evaluation (RISK-001 – RISK-008)" icon="fact_check">
            {selected ? (
              <div className="rad-table-scroll">
                <table className="rad-table rad-rule-table">
                  <thead>
                    <tr>
                      <th>Rule ID</th>
                      <th>Rule Name</th>
                      <th>Result</th>
                      <th>Contribution</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluation.map(rule => (
                      <tr key={rule.ruleId}>
                        <td>{rule.ruleId}</td>
                        <td>{rule.name}</td>
                        <td>
                          <span className={
                            rule.triggered
                              ? "rad-triggered"
                              : "rad-not-triggered"
                          }>
                            {rule.triggered
                              ? "Triggered"
                              : "Not triggered"}
                          </span>
                        </td>
                        <td className={
                          rule.triggered ? "rad-positive-points" : ""
                        }>
                          {rule.triggered ? `+${rule.contribution}` : "0"}
                        </td>
                        <td className="rad-rule-details">{rule.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rad-empty">No assessment selected.</p>
            )}
          </Panel>

          <div className="rad-bottom">
            <Panel title="Assessment Summary" icon="description">
              {selected ? (
                <div className="rad-summary-text">
                  <strong>
                    {selected.riskLevel} risk ({selected.riskScore}/100)
                  </strong>
                  <p>
                    {selected.triggeredRules.length
                      ? `${selected.triggeredRules.length} risk rule(s) triggered: ${selected.triggeredRules.map(rule => rule.ruleId).join(", ")}.`
                      : "No risk rules triggered."}
                    {" "}
                    {selected.approvalRequired
                      ? "Manual approval is required."
                      : "Manual approval is not required."}
                  </p>
                </div>
              ) : (
                <p className="rad-empty">Select an assessment.</p>
              )}
            </Panel>

            <Panel title="Available Actions" icon="settings">
              {selected ? (
                <div className="rad-actions">
                  <Link href={ROUTES.transactionDetails(selected.transactionId)}>
                    <Icon name="visibility" size={25} />
                    View Transaction
                  </Link>

                  <Link href={ROUTES.riskPolicies}>
                    <Icon name="description" size={25} />
                    View Risk Policy
                  </Link>

                  <button
                    type="button"
                    onClick={() => exportAssessment(
                      selected,
                      result?.rules ?? []
                    )}
                  >
                    <Icon name="download" size={25} />
                    Export Assessment
                  </button>
                </div>
              ) : (
                <p className="rad-empty">No actions available.</p>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </section>
  );
}