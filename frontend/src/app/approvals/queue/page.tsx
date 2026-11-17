"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import {
  getApprovalQueue,
  type ApprovalQueueFilters,
  type ApprovalQueueItem
} from "@/services/approval-queue";
import {
  getApprovalWorkflow,
  getApprovalDecisions,
  getWorkflowActors,
  submitWorkflowDecision,
  type ApprovalWorkflow,
  type WorkflowDecision,
  type WorkflowActor
} from "@/services/approval-workflows";
import {
  getRiskAssessment,
  type RiskAssessmentDetails
} from "@/services/risk-assessments";
import {
  getTransaction,
  type TransactionDetails
} from "@/services/transactions";
import { ROUTES } from "../../../../config";
import "./approval-queue.css";

type ViewTab = "summary" | "risk" | "transaction" | "workflow" | "documents";
type QueueScope = "team" | "mine";
type DecisionAction = "Approved" | "Rejected";

const initialAdvanced: ApprovalQueueFilters = {
  riskLevel: "",
  status: "",
  requiredRole: "",
  currency: "",
  minAmount: "",
  maxAmount: "",
  sortBy: "createdAt",
  sortOrder: "desc"
};

const levels = ["Critical", "High", "Medium", "Low"] as const;

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-CA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
}

const SLA_HOURS: Record<string, number> = {
  Critical: 48,
  High: 24,
  Medium: 24,
  Low: 24
};

function ApprovalSLA({
  createdAt,
  riskLevel,
  now
}: {
  createdAt: string;
  riskLevel: string;
  now: number | null;
}) {
  const created = new Date(createdAt).getTime();
  const targetHours = SLA_HOURS[riskLevel];

  if (now === null || !Number.isFinite(created) || !targetHours) {
    return <span className="aq-sla aq-sla-unknown">—</span>;
  }

  const remaining = created + targetHours * 3600000 - now;
  const minutes = Math.ceil(Math.abs(remaining) / 60000);

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  const duration = [
    days > 0 ? `${days}d` : "",
    hours > 0 ? `${hours}h` : "",
    `${mins}m`
  ].filter(Boolean).join(" ");

  const expired = remaining <= 0;
  const warning = remaining > 0 && remaining <= 4 * 3600000;

  return (
    <span
      className={`aq-sla ${expired
        ? "aq-sla-overdue"
        : warning
          ? "aq-sla-warning"
          : "aq-sla-safe"
        }`}
      title={`Demonstration SLA: ${targetHours} hours from workflow creation`}
    >
      <Icon name="schedule" size={14} />
      {expired ? `Overdue ${duration}` : duration}
    </span>
  );
}

function formatAmount(amount: number, currency: string) {
  return `${(amount / 100).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${currency}`;
}

function RiskBadge({ value }: { value: string }) {
  return (
    <span className={`aq-risk aq-risk-${value.toLowerCase()}`}>
      <Icon
        name={value === "Low" ? "check_circle" : "warning"}
        size={15}
      />
      {value}
    </span>
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
    <section className="aq-panel">
      <header className="aq-panel-header">
        <h2>
          <Icon name={icon} size={22} />
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
    <div className="aq-detail">
      <strong>{label}</strong>
      <span>{children}</span>
    </div>
  );
}

export default function ApprovalQueuePage() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);
  const [days, setDays] = useState("30");
  const [scope, setScope] = useState<QueueScope>("team");
  const [actorId, setActorId] = useState("");
  const [actors, setActors] = useState<WorkflowActor[]>([]);
  const [search, setSearch] = useState("");
  const [advanced, setAdvanced] = useState<ApprovalQueueFilters>(initialAdvanced);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [revision, setRevision] = useState(0);

  const [rows, setRows] = useState<ApprovalQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState("");
  const [workflow, setWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [assessment, setAssessment] = useState<RiskAssessmentDetails | null>(null);
  const [transaction, setTransaction] = useState<TransactionDetails | null>(null);
  const [decisions, setDecisions] = useState<WorkflowDecision[]>([]);
  const [tab, setTab] = useState<ViewTab>("summary");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<DecisionAction | null>(null);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);

  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - Number(days) + 1);

    const date = (value: Date) => value.toISOString().slice(0, 10);
    return {
      dateFrom: date(start),
      dateTo: date(end)
    };
  }, [days]);

  useEffect(() => {
    getWorkflowActors()
      .then(setActors)
      .catch(err => setError(
        err instanceof Error ? err.message : "Cannot load workflow actors."
      ));
  }, []);

  useEffect(() => {
    if (scope === "mine" && !actorId) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    const base: ApprovalQueueFilters = {
      ...advanced,
      ...dateRange,
      actorId: scope === "mine" ? actorId : "",
      sortBy: "createdAt",
      sortOrder
    };

    Promise.all([
      getApprovalQueue({ ...base, page, pageSize: 8 }, controller.signal),
      getApprovalQueue({
        ...base,
        riskLevel: "",
        page: 1,
        pageSize: 1
      }, controller.signal),
      ...levels.map(level => getApprovalQueue({
        ...base,
        riskLevel: level,
        page: 1,
        pageSize: 1
      }, controller.signal))
    ]).then(([list, overall, ...byLevel]) => {
      if (controller.signal.aborted) return;

      setRows(list.data);
      setTotal(list.pagination.total);
      setCounts({
        total: overall.pagination.total,
        ...Object.fromEntries(levels.map((level, index) => [
          level,
          byLevel[index].pagination.total
        ]))
      });
      setSelectedId(previous =>
        list.data.some(item => item.workflowId === previous)
          ? previous
          : list.data[0]?.workflowId ?? ""
      );
    }).catch(err => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Queue request failed.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [scope, actorId, advanced, dateRange, page, sortOrder, revision]);

  useEffect(() => {
    if (!selectedId) {
      setWorkflow(null);
      setAssessment(null);
      setTransaction(null);
      setDecisions([]);
      return;
    }

    let active = true;
    setDetailsLoading(true);

    Promise.all([
      getApprovalWorkflow(selectedId),
      getApprovalDecisions(selectedId)
    ]).then(async ([result, history]) => {
      const [risk, transfer] = await Promise.allSettled([
        getRiskAssessment(result.assessmentId),
        getTransaction(result.transactionId)
      ]);

      if (!active) return;

      setWorkflow(result);
      setDecisions(history);
      setAssessment(risk.status === "fulfilled" ? risk.value : null);
      setTransaction(transfer.status === "fulfilled" ? transfer.value : null);
    }).catch(err => {
      if (active) setError(
        err instanceof Error ? err.message : "Cannot load workflow details."
      );
    }).finally(() => {
      if (active) setDetailsLoading(false);
    });

    return () => { active = false; };
  }, [selectedId, revision]);

  const selectedRow = rows.find(item => item.workflowId === selectedId);
  const activeStage = workflow?.requiredStages.find(
    stage => stage.stageNumber === workflow.currentStage
  );
  const actor = actors.find(item => item.actorId === actorId);
  const expectedRole = workflow?.status === "Escalated"
    ? workflow.escalation?.destinationRole
    : activeStage?.requiredRole;

  const previousApproval = decisions.some(item =>
    item.actorId === actorId &&
    item.decision === "Approved" &&
    item.stageNumber !== workflow?.currentStage &&
    (!item.reviewType || item.reviewType === "StageReview")
  );

  const canAct = Boolean(
    workflow &&
    selectedRow &&
    actor &&
    actor.role === expectedRole &&
    !previousApproval &&
    workflow.status !== "Escalated" &&
    ["Pending", "InReview"].includes(workflow.status) &&
    activeStage?.status === "Pending"
  );

  const totalPages = Math.ceil(total / 8);
  const start = total ? (page - 1) * 8 + 1 : 0;
  const end = Math.min(page * 8, total);

  async function submitDecision() {
    if (!action || !workflow || !canAct || !comments.trim() || busy) return;

    setBusy(true);
    setError("");

    try {
      await submitWorkflowDecision(
        workflow.workflowId,
        {
          actorId,
          decision: action,
          comments: comments.trim()
        },
        crypto.randomUUID()
      );

      setAction(null);
      setComments("");
      setNotice(`${action} decision recorded successfully.`);
      setRevision(value => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision rejected.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="aq-page">
      <div className="aq-breadcrumb">
        <Link href={ROUTES.approvals}>Approval Management</Link>
        <Icon name="chevron_right" size={20} />
        <strong>Approval Queue</strong>
      </div>

      <div className="aq-heading">
        <div>
          <h1>
            <Icon name="assignment_turned_in" size={36} />
            Approval Queue
          </h1>
          <p>Review and take action on transactions and exceptions requiring approval.</p>
        </div>
        <div className="aq-top-filters">
          <label>
            Reporting Period
            <select value={days} onChange={event => {
              setDays(event.target.value);
              setPage(1);
            }}>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </label>
          <label>
            Queue
            <select value={scope} onChange={event => {
              setScope(event.target.value as QueueScope);
              setPage(1);
            }}>
              <option value="team">Team Queue</option>
              <option value="mine">My Queue</option>
            </select>
          </label>
          <label>
            Reviewer
            <select value={actorId} onChange={event => {
              setActorId(event.target.value);
              setPage(1);
            }}>
              <option value="">Select reviewer</option>
              {actors.map(item => (
                <option key={item.actorId} value={item.actorId}>
                  {item.name} — {item.role}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="aq-metrics">
        {[
          ["Team Queue", counts.total ?? 0, "groups", "blue"],
          ["My Queue", scope === "mine" ? counts.total ?? 0 : "—", "person", "blue"],
          ["Critical", counts.Critical ?? 0, "warning", "red"],
          ["High", counts.High ?? 0, "warning", "amber"],
          ["Medium", counts.Medium ?? 0, "check_circle", "green"],
          ["Low", counts.Low ?? 0, "trending_up", "green"]
        ].map(([label, value, icon, color]) => (
          <article key={String(label)} className={`aq-metric aq-${color}`}>
            <span className="aq-metric-icon">
              <Icon name={String(icon)} size={28} />
            </span>
            <div>
              <strong>{label}</strong>
              <b>{value}</b>
            </div>
          </article>
        ))}
      </div>

      {error && <div className="aq-error" role="alert">{error}</div>}
      {notice && <div className="aq-notice" role="status">{notice}</div>}

      {scope === "mine" && !actorId && (
        <p className="aq-note">
          Select a reviewer to display that actor's actionable queue.
        </p>
      )}

      <div className="aq-columns">
        <Panel
          icon="format_list_bulleted"
          title={`Approval Items (${total})`}
          action={
            <div className="aq-list-tools">
              <input
                aria-label="Search approval items"
                placeholder="Search Approval ID, Transaction, Client..."
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <button type="button" onClick={() => setShowFilters(value => !value)}>
                <Icon name="filter_alt" size={19} />
                Filters
              </button>
            </div>
          }
        >
          {showFilters && (
            <div className="aq-advanced">
              <label>Risk Level
                <select
                  value={advanced.riskLevel ?? ""}
                  onChange={event => {
                    setAdvanced(value => ({
                      ...value, riskLevel: event.target.value
                    }));
                    setPage(1);
                  }}
                >
                  <option value="">All Levels</option>
                  {levels.map(value => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>Workflow Status
                <select
                  value={advanced.status ?? ""}
                  onChange={event => {
                    setAdvanced(value => ({
                      ...value, status: event.target.value
                    }));
                    setPage(1);
                  }}
                >
                  <option value="">All Actionable</option>
                  <option value="Pending">Pending</option>
                  <option value="InReview">In Review</option>
                  <option value="Escalated">Escalated</option>
                </select>
              </label>
              <label>Required Role
                <select value={advanced.requiredRole ?? ""}
                  onChange={event => {
                    setAdvanced(value => ({
                      ...value, requiredRole: event.target.value
                    }));
                    setPage(1);
                  }}>
                  <option value="">All Roles</option>
                  {Array.from(new Set(actors.map(item => item.role)))
                    .map(role => <option key={role}>{role}</option>)}
                </select>
              </label>
              <label>Currency
                <select value={advanced.currency ?? ""}
                  onChange={event => {
                    setAdvanced(value => ({
                      ...value, currency: event.target.value
                    }));
                    setPage(1);
                  }}>
                  <option value="">All Currencies</option>
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <button type="button" onClick={() => {
                setAdvanced(initialAdvanced);
                setPage(1);
              }}>Clear Filters</button>
            </div>
          )}

          <div className="aq-table-scroll">
            <table className="aq-table">
              <thead>
                <tr>
                  <th>Approval ID</th>
                  <th>Transaction ID</th>
                  <th>Amount</th>
                  <th>Risk Level</th>
                  <th>Workflow</th>
                  <th>Stage</th>
                  <th>SLA</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8}>Loading approval queue...</td></tr>
                ) : rows.filter(item =>
                  `${item.workflowId} ${item.transactionId} ${item.referenceNumber}`
                    .toLowerCase().includes(search.toLowerCase())
                ).map(item => (
                  <tr
                    key={item.workflowId}
                    className={selectedId === item.workflowId ? "selected" : ""}
                    onClick={() => {
                      setSelectedId(item.workflowId);
                      setTab("summary");
                      setNotice("");
                    }}
                  >
                    <td>
                      <button className="aq-row-link" type="button">
                        {item.workflowId.slice(0, 13)}
                      </button>
                    </td>
                    <td>{item.referenceNumber || item.transactionId.slice(0, 13)}</td>
                    <td>{formatAmount(item.amountMinor, item.currency)}</td>
                    <td><RiskBadge value={item.riskLevel} /></td>
                    <td>{item.actionType === "EscalationReview"
                      ? "Escalation Review" : "Transaction Review"}</td>
                    <td>
                      <span className="aq-stage">{item.requiredRole}</span>
                    </td>
                    <td>
                      <ApprovalSLA
                        createdAt={item.createdAt}
                        riskLevel={item.riskLevel}
                        now={now}
                      />
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
                {!loading && !rows.length && (
                  <tr><td colSpan={8} className="aq-empty">
                    No actionable approvals match the selected filters.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="aq-pagination">
            <span>Showing {start} – {end} of {total} approvals</span>
            <div>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
                const first = Math.max(1, Math.min(page - 2, totalPages - 4));
                const number = first + index;
                return (
                  <button key={number} className={page === number ? "active" : ""}
                    onClick={() => setPage(number)}>
                    {number}
                  </button>
                );
              })}
              <button disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}>›</button>
            </div>
          </footer>
        </Panel>

        <Panel
          icon="description"
          title={selectedRow
            ? `Approval Details — ${selectedRow.workflowId.slice(0, 18)}`
            : "Approval Details"}
          action={workflow
            ? <span className="aq-state">{workflow.status}</span>
            : undefined}
        >
          {!selectedRow ? (
            <p className="aq-empty">Select an approval to view its details.</p>
          ) : detailsLoading ? (
            <p className="aq-empty">Loading approval details...</p>
          ) : (
            <div className="aq-detail-content">
              <nav className="aq-tabs">
                {([
                  ["summary", "Summary"],
                  ["risk", "Risk & Rules"],
                  ["transaction", "Transaction"],
                  ["workflow", "Workflow"],
                  ["documents", "Documents"]
                ] as const).map(([key, label]) => (
                  <button key={key}
                    className={tab === key ? "active" : ""}
                    onClick={() => setTab(key)}>{label}</button>
                ))}
              </nav>

              {tab === "summary" && (
                <>
                  <div className="aq-info-grid">
                    <section className="aq-info-card">
                      <h3><Icon name="database" size={19} />Transaction Information</h3>
                      <Detail label="Transaction:">
                        <Link href={ROUTES.transactionDetails(selectedRow.transactionId)}>
                          {selectedRow.referenceNumber || selectedRow.transactionId}
                        </Link>
                      </Detail>
                      <Detail label="Amount:">
                        {formatAmount(selectedRow.amountMinor, selectedRow.currency)}
                      </Detail>
                      <Detail label="Type:">
                        {transaction?.transactionType ?? "—"}
                      </Detail>
                      <Detail label="Source Account:">
                        {transaction?.sourceAccount.accountNumber ?? "—"}
                      </Detail>
                      <Detail label="Created On:">
                        {formatDate(transaction?.createdAt)}
                      </Detail>
                    </section>

                    <section className="aq-info-card">
                      <h3><Icon name="shield" size={19} />Risk Assessment</h3>
                      <Detail label="Assessment ID:">
                        <Link href={ROUTES.riskAssessmentDetails(selectedRow.assessmentId)}>
                          {selectedRow.assessmentId}
                        </Link>
                      </Detail>
                      <Detail label="Risk Score:">{selectedRow.riskScore}</Detail>
                      <Detail label="Risk Level:">
                        <RiskBadge value={selectedRow.riskLevel} />
                      </Detail>
                      <Detail label="Rules:">
                        {assessment?.triggeredRules.map(rule => rule.ruleId).join(", ") || "None"}
                      </Detail>
                    </section>
                  </div>
                  <div className="aq-workflow-card">
                    <h3><Icon name="account_tree" size={20} /> Approval Workflow</h3>
                    {workflow?.requiredStages.map(stage => (
                      <div className="aq-workflow-stage" key={stage.stageNumber}>
                        <span className={
                          stage.status === "Approved" ? "aq-stage-done" : "aq-stage-dot"
                        }>{stage.status === "Approved" ? "✓" : "○"}</span>
                        <div>
                          <strong>{stage.stageNumber}. {stage.requiredRole}</strong>
                          <small>{stage.status}
                            {workflow.currentStage === stage.stageNumber
                              ? " (Current Stage)" : ""}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {tab === "risk" && (
                <div className="aq-tab-body">
                  <p><strong>Risk Score:</strong> {assessment?.riskScore ?? "—"}</p>
                  <p><strong>Risk Level:</strong> {assessment?.riskLevel ?? "—"}</p>
                  <p><strong>Triggered Rules</strong></p>
                  {assessment?.triggeredRules.map(rule => (
                    <div className="aq-rule" key={rule.ruleId}>
                      <strong>{rule.ruleId} (+{rule.points})</strong>
                      <p>{rule.reason}</p>
                    </div>
                  ))}
                  {!assessment?.triggeredRules.length && <p>No triggered rules recorded.</p>}
                  <Link href={ROUTES.riskAssessmentDetails(selectedRow.assessmentId)}>
                    View Full Assessment
                  </Link>
                </div>
              )}

              {tab === "transaction" && (
                <div className="aq-tab-body">
                  <Detail label="Transaction ID:">{transaction?.transactionId ?? "—"}</Detail>
                  <Detail label="Status:">{transaction?.status ?? "—"}</Detail>
                  <Detail label="Amount:">
                    {formatAmount(selectedRow.amountMinor, selectedRow.currency)}
                  </Detail>
                  <Detail label="Source Account:">
                    {transaction?.sourceAccount.accountNumber ?? "—"}
                  </Detail>
                  <Detail label="Destination Account:">
                    {transaction?.destinationAccount.accountNumber ?? "—"}
                  </Detail>
                  <Detail label="Description:">{transaction?.description || "—"}</Detail>
                  <Link href={ROUTES.transactionDetails(selectedRow.transactionId)}>
                    View Transaction Details
                  </Link>
                </div>
              )}

              {tab === "workflow" && (
                <div className="aq-tab-body">
                  <Detail label="Workflow ID:">{workflow?.workflowId ?? "—"}</Detail>
                  <Detail label="Status:">{workflow?.status ?? "—"}</Detail>
                  <Detail label="Current Stage:">{workflow?.currentStage ?? "—"}</Detail>
                  <Detail label="Required Role:">{expectedRole ?? "—"}</Detail>
                  <h3>Decision History</h3>
                  {decisions.map(decision => (
                    <div key={decision.decisionId} className="aq-rule">
                      <strong>{decision.decision} — {decision.actorId}</strong>
                      <small>{formatDate(decision.decidedAt)}</small>
                      <p>{decision.comments}</p>
                    </div>
                  ))}
                  {!decisions.length && <p>No decisions recorded yet.</p>}
                  <Link href={ROUTES.approvalDetails(selectedRow.workflowId)}>
                    Open Full Workflow
                  </Link>
                </div>
              )}

              {tab === "documents" && (
                <div className="aq-tab-body">
                  <p>Supporting documents are managed through the linked transaction.</p>
                  <Link href={ROUTES.transactionDetails(selectedRow.transactionId)}>
                    Open Transaction Documents
                  </Link>
                </div>
              )}

              <footer className="aq-actions">
                <Link className="aq-outline"
                  href={ROUTES.approvalDetails(selectedRow.workflowId)}>
                  <Icon name="comment" size={18} /> Add Note / Escalate
                </Link>
                <button type="button" className="aq-reject"
                  disabled={!canAct}
                  onClick={() => setAction("Rejected")}>
                  <Icon name="close" size={18} /> Reject
                </button>
                <button type="button" className="aq-approve"
                  disabled={!canAct}
                  onClick={() => setAction("Approved")}>
                  <Icon name="check" size={18} /> Approve
                </button>
              </footer>
            </div>
          )}
        </Panel>
      </div>

      {action && (
        <div className="aq-modal-overlay">
          <div className="aq-modal" role="dialog" aria-modal="true">
            <h2>{action === "Approved" ? "Approve" : "Reject"} Workflow</h2>
            <p>Reviewer: {actor?.name} ({actor?.role})</p>
            <p>Current stage: {workflow?.currentStage}</p>
            <label>
              {action === "Rejected" ? "Rejection reason" : "Decision comments"}
              <textarea
                rows={5}
                required
                value={comments}
                onChange={event => setComments(event.target.value)}
                placeholder="Record the reason for this decision..."
              />
            </label>
            <div className="aq-modal-actions">
              <button disabled={busy} onClick={() => setAction(null)}>Cancel</button>
              <button disabled={busy || !comments.trim() || !canAct}
                className={action === "Approved" ? "aq-approve" : "aq-reject"}
                onClick={() => void submitDecision()}>
                {busy ? "Submitting..." : `Confirm ${action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
