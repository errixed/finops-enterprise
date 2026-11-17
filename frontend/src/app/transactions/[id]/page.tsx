"use client";

import {
  use,
  useCallback,
  useEffect,
  useState
} from "react";
import Link from "next/link";
import {
  type TransactionDetails,
  getTransaction,
  processTransaction
} from "@/services/transactions";
import {
  type AccountDetails,
  getAccount,
  formatMoney
} from "@/services/accounts";
import {
  type RiskAssessmentDetails,
  getRiskAssessment
} from "@/services/risk-assessments";
import {
  type ApprovalWorkflow,
  type WorkflowDecision,
  getApprovalWorkflow,
  getApprovalDecisions
} from "@/services/approval-workflows";
import TransactionDocumentsPanel from "@/components/transactions/TransactionDocumentsPanel";
import { getTransactionDocuments } from "@/services/transaction-documents";
import { ROUTES } from "../../../../config";
import "../../approvals/approval-ui.css";
import "./transaction-details.css";

type Tab = "overview" | "risk" | "documents" | "audit";

interface Props {
  params: Promise<{ id: string }>;
}

interface DetailsData {
  transaction: TransactionDetails;
  accounts: Record<string, AccountDetails>;
  risk: RiskAssessmentDetails | null;
  workflow: ApprovalWorkflow | null;
  decisions: WorkflowDecision[];
  documentCount: number | null;
}

function Icon({
  name,
  size = 22
}: {
  name: string;
  size?: number;
}) {
  return (
    <span
      className="material-symbols-rounded"
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

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

function dateOnly(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function Badge({ value }: { value?: string | null }) {
  const text = value || "Not available";

  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  return (
    <span className={`txd-badge txd-badge-${normalized}`}>
      {text}
    </span>
  );
}

function Panel({
  title,
  icon,
  children,
  action
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="txd-panel">
      <header className="txd-panel-heading">
        <h2>
          <Icon name={icon} size={24} />
          {title}
        </h2>
        {action}
      </header>
      <div className="txd-panel-body">{children}</div>
    </section>
  );
}

function Row({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="txd-info-row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function getStageLabel(role: string) {
  return role
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ");
}

function AccountCard({
  label,
  account,
  details
}: {
  label: string;
  account: TransactionDetails["sourceAccount"];
  details?: AccountDetails;
}) {
  return (
    <div className="txd-account">
      <Icon name="account_balance_wallet" size={34} />
      <div>
        <span>{label}</span>
        <Link href={ROUTES.accountDetails(account.accountId)}>
          {account.accountNumber}
        </Link>
        <small>
          {details?.accountName || details?.accountType || account.currency}
        </small>
      </div>
    </div>
  );
}

function StatusWorkflow({
  workflow,
  transaction
}: {
  workflow: ApprovalWorkflow | null;
  transaction: TransactionDetails;
}) {
  if (transaction.approvalRequired === false) {
    return (
      <div className="txd-empty">
        <Icon name="verified" size={28} />
        No manual approval required under the current risk policy.
      </div>
    );
  }
  if (transaction.approvalRequired !== true) {
    return (
      <div className="txd-empty">
        <Icon name="info" size={28} />
        Approval requirement information is unavailable.
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="txd-empty">
        The approval workflow could not be loaded.
      </div>
    );
  }

  return (
    <div className="txd-workflow">
      <div className="txd-workflow-stage txd-stage-approved">
        <span className="txd-stage-circle">
          <Icon name="check" size={21} />
        </span>
        <strong>Submitted</strong>
        <small>{dateTime(workflow.createdAt)}</small>
      </div>

      {workflow.requiredStages.map(stage => {
        const active =
          workflow.currentStage === stage.stageNumber &&
          ["Pending", "InReview", "Escalated"].includes(workflow.status);

        const approved = stage.status === "Approved";

        return (
          <div
            key={stage.stageNumber}
            className={`txd-workflow-stage ${approved ? "txd-stage-approved" :
                active ? "txd-stage-active" : ""
              }`}
          >
            <span className="txd-stage-circle">
              {approved
                ? <Icon name="check" size={21} />
                : stage.stageNumber}
            </span>
            <strong>
              {stage.stageNumber}. {getStageLabel(stage.requiredRole)}
            </strong>
            <small>
              {stage.status === "Waiting" ? "Waiting" : stage.status}
            </small>
            {stage.actorId && (
              <small>Actor: {stage.actorId}</small>
            )}
            {stage.decidedAt && (
              <small>{dateTime(stage.decidedAt)}</small>
            )}
          </div>
        );
      })}
    </div>
  );
}

function eligibility(
  transaction: TransactionDetails,
  workflow: ApprovalWorkflow | null
) {
  if (transaction.status === "Completed") {
    return {
      eligible: false,
      title: "Transaction Completed",
      detail: "The financial transfer has already been processed.",
      tone: "success"
    };
  }

  if (transaction.status === "Rejected") {
    return {
      eligible: false,
      title: "Transaction Rejected",
      detail: transaction.rejectionReason || "The transfer was rejected.",
      tone: "danger"
    };
  }

  if (transaction.status === "Processing") {
    return {
      eligible: false,
      title: "Processing",
      detail: "The transaction is being processed.",
      tone: "warning"
    };
  }

  if (transaction.isLegacy) {
    return {
      eligible: false,
      title: "Processing Unavailable",
      detail: "Legacy transactions cannot be processed through this workflow.",
      tone: "warning"
    };
  }

  if (transaction.approvalRequired === true) {
    if (
      transaction.approvalStatus !== "Approved" ||
      !transaction.approvalWorkflowId ||
      workflow?.status !== "Approved"
    ) {
      return {
        eligible: false,
        title: "Blocked — Awaiting Approval",
        detail: `The transaction requires approval before financial processing. Current workflow status: ${workflow?.status ?? transaction.approvalStatus ?? "Unknown"}.`,
        tone: "danger"
      };
    }
  } else if (
    transaction.approvalRequired !== false ||
    transaction.approvalStatus !== "NotRequired"
  ) {
    return {
      eligible: false,
      title: "Processing Eligibility Unavailable",
      detail: "The approval requirements have not been confirmed.",
      tone: "warning"
    };
  }

  return {
    eligible: true,
    title: "Eligible for Processing",
    detail: "Approval conditions are satisfied. Final financial checks occur during processing.",
    tone: "success"
  };
}

export default function TransactionDetailsPage({ params }: Props) {
  const { id } = use(params);

  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<DetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const transaction = await getTransaction(id);

    const accountIds = [
      transaction.sourceAccount.accountId,
      transaction.destinationAccount.accountId
    ];

    const uniqueAccountIds = [...new Set(accountIds)];

    const [accounts, risk, workflow, documents] = await Promise.all([
      Promise.allSettled(uniqueAccountIds.map(accountId => getAccount(accountId))),
      transaction.riskAssessmentId
        ? getRiskAssessment(transaction.riskAssessmentId).catch(() => null)
        : Promise.resolve(null),
      transaction.approvalWorkflowId
        ? getApprovalWorkflow(transaction.approvalWorkflowId).catch(() => null)
        : Promise.resolve(null),
      getTransactionDocuments(transaction.transactionId).catch(() => null)
    ]);

    const mapped: Record<string, AccountDetails> = {};

    accounts.forEach((result, index) => {
      if (result.status === "fulfilled") {
        mapped[uniqueAccountIds[index]] = result.value;
      }
    });

    const decisions = workflow
      ? await getApprovalDecisions(workflow.workflowId).catch(() => [])
      : [];

    setData({
      transaction,
      accounts: mapped,
      risk,
      workflow,
      decisions,
      documentCount: documents?.length ?? null
    });
  }, [id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    load()
      .catch(err => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load transaction.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [load]);

  useEffect(() => {
    if (!data || !["Pending", "Processing"].includes(data.transaction.status)) {
      return;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load().catch(() => { });
      }
    }, 20000);

    return () => window.clearInterval(interval);
  }, [data?.transaction.status, load]);

  async function refresh() {
    if (refreshing || processing) return;

    setRefreshing(true);
    setNotice("");

    try {
      await load();
      setNotice("Transaction information refreshed.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function process() {
    if (!data || processing) return;

    if (!eligibility(data.transaction, data.workflow).eligible) return;

    setProcessing(true);
    setNotice("");

    try {
      await processTransaction(data.transaction.transactionId);
      await load();
      setNotice("Transaction processing request completed.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Processing failed.");

      try {
        await load();
      } catch { }
    } finally {
      setProcessing(false);
    }
  }

  function download() {
    if (!data) return;

    const t = data.transaction;

    const rows = [
      ["Transaction ID", t.transactionId],
      ["Reference Number", t.referenceNumber],
      ["Type", t.transactionType],
      ["Amount Minor", t.amountMinor],
      ["Currency", t.currency],
      ["Description", t.description],
      ["Source Account", t.sourceAccount.accountNumber],
      ["Destination Account", t.destinationAccount.accountNumber],
      ["Financial Status", t.status],
      ["Risk Level", t.riskLevel ?? ""],
      ["Risk Score", t.riskScore ?? ""],
      ["Approval Status", t.approvalStatus ?? ""],
      ["Created At", t.createdAt],
      ["Updated At", t.updatedAt]
    ];

    const csv = rows.map(row =>
      row.map(value => {
        let text = String(value ?? "");
        if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
        return `"${text.replaceAll('"', '""')}"`;
      }).join(",")
    ).join("\r\n");

    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = `transaction-${t.referenceNumber}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="txd-page">Loading transaction details...</div>;
  }

  if (error || !data) {
    return (
      <div className="txd-page">
        <div className="txd-alert">{error || "Transaction not found."}</div>
        <Link href={ROUTES.transactions}>Back to Transaction Directory</Link>
      </div>
    );
  }

  const { transaction: t, accounts, risk, workflow, decisions } = data;
  const state = eligibility(t, workflow);

  const audit = [
    {
      id: "created",
      title: "Transaction Created",
      timestamp: t.createdAt,
      description: "Transaction record initiated"
    },
    ...(risk ? [{
      id: "risk",
      title: "Risk Assessment Completed",
      timestamp: risk.assessedAt,
      description: `Risk level: ${risk.riskLevel}, score: ${risk.riskScore}/100`
    }] : []),
    ...(workflow ? [{
      id: "workflow",
      title: "Approval Workflow Created",
      timestamp: workflow.createdAt,
      description: `Required stages: ${workflow.requiredStages.length}`
    }] : []),
    ...decisions.map(decision => ({
      id: decision.decisionId,
      title: `Approval Decision: ${decision.decision}`,
      timestamp: decision.decidedAt,
      description: `${decision.actorRole} (${decision.actorId})${decision.comments ? ` — ${decision.comments}` : ""}`
    })),
    ...(t.processedAt ? [{
      id: "processed",
      title: "Transaction Processed",
      timestamp: t.processedAt,
      description: `Financial status: ${t.status}`
    }] : [])
  ].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() -
      new Date(a.timestamp).getTime()
  );

  return (
    <div className="txd-page">
      <div className="txd-top">
        <div>
          <nav className="txd-breadcrumb">
            <Link href={ROUTES.transactions}>
              <Icon name="home" size={18} />
              Transactions
            </Link>
            <Icon name="chevron_right" size={17} />
            {t.referenceNumber}
          </nav>

          <div className="txd-title">
            <span className="txd-title-icon">
              <Icon name="swap_horiz" size={32} />
            </span>
            <div>
              <h1>Transaction Details</h1>
              <p>
                View transaction information, risk assessment, approval workflow,
                documents, and audit trail.
              </p>
            </div>
          </div>
        </div>

        <div className="txd-actions">
          <Link href={ROUTES.transactions}>
            <Icon name="arrow_back" size={20} />
            Back to Directory
          </Link>
          <button type="button" onClick={download}>
            <Icon name="download" size={20} />
            Download
          </button>
          <button type="button" onClick={() => window.print()}>
            <Icon name="print" size={20} />
            Print
          </button>
        </div>
      </div>

      <section className="txd-summary">
        <div className="txd-summary-identity">
          <Icon name="receipt_long" size={34} />
          <div>
            <strong>{t.referenceNumber}</strong>
            <span>{t.transactionType || "Transfer"}</span>
          </div>
        </div>
        <div>
          <small>Amount</small>
          <strong>{formatMoney(t.amountMinor, t.currency)} {t.currency}</strong>
        </div>
        <div>
          <small>Financial Status</small>
          <Badge value={t.status} />
        </div>
        <div>
          <small>Risk Level</small>
          <Badge value={t.riskLevel} />
        </div>
        <div>
          <small>Approval Status</small>
          <Badge value={t.approvalStatus} />
        </div>
        <div>
          <small>Created On</small>
          <strong>{dateTime(t.createdAt)}</strong>
        </div>
      </section>

      <nav className="txd-tabs" aria-label="Transaction details tabs">
        {([
          ["overview", "Overview", "home"],
          ["risk", "Risk Assessment", "shield"],
          ["documents", `Documents${data.documentCount === null ? "" : ` (${data.documentCount})`}`, "description"],
          ["audit", "Audit Trail", "history"]
        ] as const).map(([value, label, icon]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? "active" : ""}
            aria-current={tab === value ? "page" : undefined}
            onClick={() => setTab(value)}
          >
            <Icon name={icon} size={21} />
            {label}
          </button>
        ))}
      </nav>

      {notice && <div className="txd-notice" role="status">{notice}</div>}

      {tab === "overview" && (
        <>
          <div className="txd-columns">
            <Panel title="Transaction Information" icon="info">
              <Row label="Transaction ID">{t.transactionId}</Row>
              <Row label="Reference No.">{t.referenceNumber}</Row>
              <Row label="Type">{t.transactionType || "Transfer"}</Row>
              <Row label="Amount">
                {formatMoney(t.amountMinor, t.currency)} {t.currency}
              </Row>
              <Row label="Currency">{t.currency}</Row>
              <Row label="Description">{t.description || "—"}</Row>
              <Row label="Created On">{dateTime(t.createdAt)}</Row>
              <Row label="Last Updated">{dateTime(t.updatedAt)}</Row>
              <Row label="Processed On">{dateTime(t.processedAt)}</Row>
            </Panel>

            <div className="txd-stack">
              <Panel title="Accounts Involved" icon="layers">
                <div className="txd-account-flow">
                  <AccountCard
                    label="Source Account"
                    account={t.sourceAccount}
                    details={accounts[t.sourceAccount.accountId]}
                  />
                  <Icon name="arrow_circle_right" size={28} />
                  <AccountCard
                    label="Destination Account"
                    account={t.destinationAccount}
                    details={accounts[t.destinationAccount.accountId]}
                  />
                </div>
              </Panel>

              <Panel
                title="Approval Workflow"
                icon="account_tree"
                action={t.approvalWorkflowId && (
                  <Link href={ROUTES.approvalDetails(t.approvalWorkflowId)}>
                    View Details <Icon name="arrow_forward" size={16} />
                  </Link>
                )}
              >
                <StatusWorkflow workflow={workflow} transaction={t} />
              </Panel>

              <Panel
                title="Transaction Status Update"
                icon="sync"
                action={
                  <button
                    type="button"
                    className="txd-refresh"
                    onClick={() => void refresh()}
                    disabled={refreshing || processing}
                  >
                    <Icon name="refresh" size={18} />
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </button>
                }
              >
                <div className="txd-status-strip">
                  <div>
                    <small>Current Status</small>
                    <Badge value={t.approvalRequired
                      ? (workflow?.status ?? t.approvalStatus)
                      : t.status}
                    />
                  </div>
                  <div>
                    <small>Stage</small>
                    <strong>
                      {workflow?.currentStage == null
                        ? "No active review stage"
                        : getStageLabel(
                          workflow.requiredStages.find(
                            stage => stage.stageNumber === workflow.currentStage
                          )?.requiredRole ?? "Review"
                        )}
                    </strong>
                  </div>
                  <div>
                    <small>Updated</small>
                    <strong>{dateTime(workflow?.updatedAt ?? t.updatedAt)}</strong>
                  </div>
                </div>
                <p className="txd-status-note">
                  Status is refreshed every 20 seconds while the transaction is pending or processing.
                </p>
              </Panel>
            </div>
          </div>

          <section className={`txd-eligibility txd-${state.tone}`}>
            <Icon
              name={state.eligible ? "check_circle" : "gpp_maybe"}
              size={27}
            />
            <div>
              <strong>{state.title}</strong>
              <p>{state.detail}</p>
            </div>
            {state.eligible && (
              <button
                type="button"
                disabled={processing || refreshing}
                onClick={() => void process()}
              >
                {processing ? "Processing..." : "Process Transaction"}
              </button>
            )}
          </section>
        </>
      )}

      {tab === "risk" && (
        <div className="txd-columns">
          <Panel title="Risk Assessment" icon="shield">
            {risk ? (
              <>
                <div className="txd-risk-summary">
                  <div>
                    <small>Risk Level</small>
                    <Badge value={risk.riskLevel} />
                  </div>
                  <div>
                    <small>Risk Score</small>
                    <strong>{risk.riskScore} / 100</strong>
                  </div>
                  <div>
                    <small>Approval Required</small>
                    <strong>{risk.approvalRequired ? "Yes" : "No"}</strong>
                  </div>
                </div>
                <Row label="Assessed On">{dateTime(risk.assessedAt)}</Row>
                <Row label="Policy Version">{risk.policyVersion}</Row>
                <h3>Triggered Risk Rules</h3>
                {risk.triggeredRules.length ? (
                  <div className="txd-rule-list">
                    {risk.triggeredRules.map((rule, index) => (
                      <div key={`${rule.ruleId}-${index}`}>
                        <div>
                          <strong>{rule.ruleId}</strong>
                          <p>{rule.reason}</p>
                        </div>
                        <b>+{rule.points}</b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No risk rules triggered.</p>
                )}
                <Link href={ROUTES.riskAssessmentDetails(risk.assessmentId)}>
                  View Complete Risk Assessment
                </Link>
              </>
            ) : (
              <p>No risk assessment record is available.</p>
            )}
          </Panel>

          <Panel title="Approval Requirements" icon="account_tree">
            <Row label="Approval Required">
              {t.approvalRequired === undefined
                ? "Unknown"
                : t.approvalRequired ? "Yes" : "No"}
            </Row>
            <Row label="Approval Status">
              <Badge value={t.approvalStatus} />
            </Row>
            <Row label="Required Stages">
              {workflow?.requiredStages.length ?? (t.approvalRequired ? "—" : 0)}
            </Row>
            <StatusWorkflow workflow={workflow} transaction={t} />
            {t.approvalWorkflowId && (
              <Link href={ROUTES.approvalDetails(t.approvalWorkflowId)}>
                Open Approval Workflow
              </Link>
            )}
          </Panel>
        </div>
      )}

      {tab === "documents" && (
        <div className="txd-document-area">
          <TransactionDocumentsPanel
            transactionId={t.transactionId}
            allowUpload={
              t.status === "Pending" &&
              !["Approved", "Rejected", "Cancelled"].includes(
                t.approvalStatus ?? ""
              )
            }
          />
        </div>
      )}

      {tab === "audit" && (
        <Panel title="Transaction Audit Trail" icon="history">
          <div className="txd-timeline">
            {audit.length ? audit.map(event => (
              <div key={event.id} className="txd-timeline-event">
                <span className="txd-timeline-dot" />
                <div>
                  <strong>{event.title}</strong>
                  <time>{dateTime(event.timestamp)}</time>
                  <p>{event.description}</p>
                </div>
              </div>
            )) : (
              <p>No lifecycle events are available.</p>
            )}
          </div>
          <p className="txd-status-note">
            This timeline includes transaction, risk, approval, and processing records.
            Document access events are stored separately and are not yet included here.
          </p>
        </Panel>
      )}
    </div>
  );
}
