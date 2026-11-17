"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type AccountDetails,
  type Transaction,
  type AccountOperationsReport,
  formatMoney,
  getAccount,
  getAccountOperationsReport,
  downloadAccountStatement
} from "@/services/accounts";
import { Icon, StatusBadge } from "@/components/ui";
import AccountBalanceTrend from "@/components/accounts/AccountBalanceTrend";
import { ROUTES } from "../../../../config";
import "../account-profile.css";

interface Props {
  params: Promise<{ id: string }>;
}

type Tab = "overview" | "transactions" | "documents" | "activity";
type Period = 3 | 6 | 12;

type AccountRecord = AccountDetails & {
  accountName?: string | null;
  purpose?: string | null;
  openedAt?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleDateString("en-CA", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString("en-CA", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
}

function Panel({
  title,
  icon,
  children,
  action,
  className = ""
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`ap-card ${className}`}>
      <header className="ap-card-header">
        <Icon name={icon} size={23} />
        <h2>{title}</h2>
        {action && <div className="ap-header-action">{action}</div>}
      </header>

      <div className="ap-card-body">
        {children}
      </div>
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
    <div className="ap-detail-row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function transactionDirection(
  transaction: Transaction,
  accountId: string
) {
  if (transaction.destinationAccountId === accountId) {
    return "Credit";
  }

  if (transaction.sourceAccountId === accountId) {
    return "Debit";
  }

  return "Other";
}

function getCompletedTotals(
  transactions: Transaction[],
  accountId: string
) {
  let credits = 0;
  let debits = 0;

  for (const transaction of transactions) {
    if (transaction.status !== "Completed") continue;

    const direction = transactionDirection(transaction, accountId);

    if (direction === "Credit") {
      credits += transaction.amountMinor;
    } else if (direction === "Debit") {
      debits += transaction.amountMinor;
    }
  }

  return { credits, debits };
}

function TransactionsTable({
  transactions,
  account,
  showBalance = false
}: {
  transactions: Transaction[];
  account: AccountDetails;
  showBalance?: boolean;
}) {
  if (transactions.length === 0) {
    return (
      <p className="ap-empty">
        No transactions are associated with this account.
      </p>
    );
  }

  return (
    <div className="ap-table-scroll">
      <table className="ap-table ap-transactions-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Transaction ID</th>
            <th>Type</th>
            <th>Description</th>
            <th>Amount ({account.currency})</th>
            {showBalance && <th>Balance ({account.currency})</th>}
          </tr>
        </thead>

        <tbody>
          {transactions.map(transaction => {
            const direction = transactionDirection(
              transaction,
              account.accountId
            );

            const completed = transaction.status === "Completed";
            const credit = completed && direction === "Credit";
            const debit = completed && direction === "Debit";

            const description = (
              transaction as Transaction & {
                description?: string | null;
              }
            ).description;

            const isAccountCurrency =
              transaction.currency === account.currency;

            return (
              <tr key={transaction.transactionId}>
                <td>{formatDate(transaction.createdAt)}</td>

                <td>
                  <Link
                    href={ROUTES.transactionDetails(
                      transaction.transactionId
                    )}
                  >
                    {transaction.referenceNumber ??
                      transaction.transactionId}
                  </Link>
                </td>

                <td>
                  <span className={
                    credit
                      ? "ap-direction ap-direction-credit"
                      : debit
                        ? "ap-direction ap-direction-debit"
                        : "ap-direction ap-direction-other"
                  }>
                    {direction}
                  </span>
                </td>

                <td>
                  {description || transaction.transactionType || "Transfer"}

                  {!completed && (
                    <span className="ap-transaction-status">
                      <StatusBadge status={transaction.status} />
                    </span>
                  )}
                </td>

                <td className={
                  credit ? "ap-positive"
                    : debit ? "ap-negative"
                      : ""
                }>
                  {credit ? "+" : debit ? "−" : ""}
                  {formatMoney(
                    transaction.amountMinor,
                    transaction.currency
                  )}
                  {!isAccountCurrency && (
                    <small className="ap-currency-warning">
                      Different currency
                    </small>
                  )}
                </td>

                {showBalance && (
                  <td className="ap-muted">
                    See balance history
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AccountDetailsPage({ params }: Props) {
  const { id } = use(params);

  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [operations, setOperations] =
    useState<AccountOperationsReport | null>(null);

  const [tab, setTab] = useState<Tab>("overview");
  const [period, setPeriod] = useState<Period>(6);

  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [statementLoading, setStatementLoading] = useState(false);

  const [error, setError] = useState("");
  const [reportError, setReportError] = useState("");
  const [actionError, setActionError] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  const [statementDates, setStatementDates] = useState(() => {
    const today = new Date();

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };

    const previousMonth = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1
    );

    return {
      from: formatDate(previousMonth),
      to: formatDate(today)
    };
  });

  const statementFrom = statementDates.from;
  const statementTo = statementDates.to;


  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    getAccount(id)
      .then(result => {
        if (active) setAccount(result);
      })
      .catch(err => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load account."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;

    setReportLoading(true);
    setReportError("");

    getAccountOperationsReport(id, period)
      .then(result => {
        if (active) setOperations(result);
      })
      .catch(err => {
        if (active) {
          setOperations(null);
          setReportError(
            err instanceof Error
              ? err.message
              : "Unable to load account reporting."
          );
        }
      })
      .finally(() => {
        if (active) setReportLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, period]);

  const transactions = useMemo(
    () => [...(account?.transactions ?? [])].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    ),
    [account]
  );

  const completedTransactions = useMemo(
    () => transactions.filter(
      transaction => transaction.status === "Completed"
    ),
    [transactions]
  );

  const totals = useMemo(
    () => getCompletedTotals(
      transactions,
      account?.accountId ?? ""
    ),
    [transactions, account?.accountId]
  );

  async function generateStatement() {
    if (!account) return;

    if (!statementFrom || !statementTo) {
      setActionError("Please select a statement date range.");
      return;
    }

    if (statementFrom > statementTo) {
      setActionError("The start date cannot be after the end date.");
      return;
    }

    setStatementLoading(true);
    setActionError("");

    try {
      await downloadAccountStatement(
        account.accountId,
        statementFrom,
        statementTo
      );
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to generate account statement."
      );
    } finally {
      setStatementLoading(false);
    }
  }

  function exportTransactions() {
    if (!account) return;

    const headers = [
      "Date",
      "Transaction ID",
      "Reference",
      "Direction",
      "Description",
      "Status",
      "Amount Minor",
      "Currency"
    ];

    const csvValue = (value: unknown) => {
      let text = String(value ?? "");

      if (/^[=+\-@\t\r]/.test(text)) {
        text = `'${text}`;
      }

      return `"${text.replaceAll('"', '""')}"`;
    };

    const rows = transactions.map(transaction => {
      const description = (
        transaction as Transaction & {
          description?: string | null;
        }
      ).description;

      return [
        transaction.createdAt,
        transaction.transactionId,
        transaction.referenceNumber,
        transactionDirection(transaction, account.accountId),
        description ?? transaction.transactionType ?? "Transfer",
        transaction.status,
        transaction.amountMinor,
        transaction.currency
      ];
    });

    const csv = [headers, ...rows]
      .map(row => row.map(csvValue).join(","))
      .join("\r\n");

    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8"
      })
    );

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `account-${account.accountNumber}-transactions.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="ap-message">Loading account details...</div>
    );
  }

  if (!account) {
    return (
      <section className="ap-page">
        <p role="alert">{error || "Account not found."}</p>
        <Link href={ROUTES.accounts}>Back to Accounts</Link>
      </section>
    );
  }

  const accountName =
    account.accountName?.trim() ||
    `${account.accountType} Account`;

  const tabs: {
    id: Tab;
    label: string;
    icon: string;
  }[] = [
      { id: "overview", label: "Overview", icon: "dashboard" },
      { id: "transactions", label: "Transactions", icon: "swap_horiz" },
      { id: "documents", label: "Documents", icon: "description" },
      { id: "activity", label: "Activity", icon: "schedule" }
    ];

  return (
    <section className="ap-page ap-account-details-v2">
      <nav className="ap-breadcrumb" aria-label="Breadcrumb">
        <Link href={ROUTES.accounts}>
          <Icon name="home" size={17} />
          Accounts
        </Link>
        <Icon name="chevron_right" size={17} />
        <span>Account Details</span>
      </nav>

      <div className="ap-page-heading">
        <div>
          <h1>
            <Icon name="layers" size={34} />
            Account Details
          </h1>
          <p>
            View account information, balance, transactions,
            and related activity.
          </p>
        </div>

        <div className="ap-heading-actions">
          <Link href={ROUTES.accounts} className="ap-secondary-button">
            <Icon name="arrow_back" size={20} />
            Back to Accounts
          </Link>

          <div className="ap-more-container">
            <button
              type="button"
              className="ap-secondary-button"
              onClick={() => setMoreOpen(current => !current)}
              aria-expanded={moreOpen}
            >
              <Icon name="more_horiz" size={21} />
              More Actions
              <Icon name="expand_more" size={17} />
            </button>

            {moreOpen && (
              <div className="ap-more-menu">
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    setTab("transactions");
                  }}
                >
                  <Icon name="receipt_long" size={18} />
                  Transactions
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    void generateStatement();
                  }}
                >
                  <Icon name="description" size={18} />
                  Generate Statement
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    exportTransactions();
                  }}
                >
                  <Icon name="download" size={18} />
                  Export Transactions
                </button>

                <Link
                  href={ROUTES.clientDetails(account.clientId)}
                  onClick={() => setMoreOpen(false)}
                >
                  <Icon name="groups" size={18} />
                  Client Details
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {actionError && (
        <div className="ap-error-message" role="alert">
          {actionError}
          <button type="button" onClick={() => setActionError("")}>
            <Icon name="close" size={18} />
          </button>
        </div>
      )}

      <div className="ap-account-banner">
        <div className="ap-account-avatar">
          <Icon name="account_balance" size={49} />
        </div>

        <div className="ap-account-identity">
          <div className="ap-account-name">
            <h2>{accountName}</h2>
            <StatusBadge status={account.status} />
          </div>

          <p>
            <Icon name="domain" size={19} />
            <Link href={ROUTES.clientDetails(account.clientId)}>
              {account.companyName}
            </Link>
            <span>({account.clientId})</span>
          </p>

          <p>
            <Icon name="layers" size={19} />
            {account.accountType}
            <span className="ap-identity-separator">|</span>
            {account.currency}
          </p>

          <small>Account {account.accountNumber}</small>
        </div>

        <div className="ap-account-metrics">
          <div>
            <Icon name="layers" size={27} />
            <div>
              <span>Current Balance</span>
              <strong>
                {formatMoney(
                  account.balanceMinor,
                  account.currency
                )}
              </strong>
            </div>
          </div>

          <div>
            <Icon name="north" size={30} />
            <div>
              <span>Total Credits (Completed)</span>
              <strong className="ap-positive">
                {formatMoney(totals.credits, account.currency)}
              </strong>
            </div>
          </div>

          <div>
            <Icon name="south" size={30} />
            <div>
              <span>Total Debits (Completed)</span>
              <strong className="ap-negative">
                {formatMoney(totals.debits, account.currency)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <nav className="ap-tabs" role="tablist" aria-label="Account sections">
        {tabs.map(item => (
          <button
            key={item.id}
            type="button"
            id={`ap-tab-${item.id}`}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`ap-panel-${item.id}`}
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
          >
            <Icon name={item.icon} size={22} />
            {item.label}
          </button>
        ))}
      </nav>

      <div
        role="tabpanel"
        id={`ap-panel-${tab}`}
        aria-labelledby={`ap-tab-${tab}`}
      >
        {tab === "overview" && (
          <div className="ap-overview-layout">
            <div className="ap-overview-main">
              <div className="ap-overview-top">
                <Panel title="Account Information" icon="layers">
                  <div className="ap-details-list">
                    <Detail label="Account ID">
                      {account.accountNumber}
                    </Detail>

                    <Detail label="Account Type">
                      {account.accountType}
                    </Detail>

                    <Detail label="Account Name">
                      {account.accountName || `${account.accountType} Account`}
                    </Detail>

                    <Detail label="Currency">
                      {account.currency}
                    </Detail>

                    <Detail label="Purpose">
                      {account.purpose || "Not specified"}
                    </Detail>

                    <Detail label="Open Date">
                      {formatDate(account.openDate || account.createdAt)}
                    </Detail>

                    <Detail label="Status">
                      <StatusBadge status={account.status} />
                    </Detail>
                  </div>
                </Panel>

                <Panel
                  title="Balance Trend"
                  icon="monitoring"
                  action={
                    <select
                      aria-label="Balance trend period"
                      className="ap-period-select"
                      value={period}
                      onChange={event => setPeriod(
                        Number(event.target.value) as Period
                      )}
                    >
                      <option value={3}>Last 3 Months</option>
                      <option value={6}>Last 6 Months</option>
                      <option value={12}>Last 12 Months</option>
                    </select>
                  }
                >
                  {reportLoading ? (
                    <p className="ap-empty">Loading balance trend...</p>
                  ) : operations ? (
                    <AccountBalanceTrend
                      points={operations.history.months}
                      currency={account.currency}
                    />
                  ) : (
                    <p className="ap-empty">
                      {reportError || "Balance history unavailable."}
                    </p>
                  )}
                </Panel>
              </div>

              <Panel
                title="Recent Transactions"
                icon="swap_horiz"
                action={
                  <button
                    type="button"
                    className="ap-text-action"
                    onClick={() => setTab("transactions")}
                  >
                    View All Transactions
                    <Icon name="arrow_forward" size={18} />
                  </button>
                }
              >
                <TransactionsTable
                  transactions={transactions.slice(0, 5)}
                  account={account}
                />
              </Panel>
            </div>

            <aside className="ap-overview-sidebar">
              <Panel title="Quick Actions" icon="bolt">
                <div className="ap-quick-actions">
                  <Link href={ROUTES.transactionCreate}>
                    <Icon name="add" size={21} />
                    New Transaction
                  </Link>

                  <Link href={ROUTES.transactionCreate}>
                    <Icon name="swap_horiz" size={21} />
                    Transfer Funds
                  </Link>

                  <button
                    type="button"
                    disabled={statementLoading}
                    onClick={() => void generateStatement()}
                  >
                    <Icon name="description" size={21} />
                    {statementLoading
                      ? "Generating..."
                      : "Generate Statement"}
                  </button>

                  <button
                    type="button"
                    onClick={exportTransactions}
                  >
                    <Icon name="download" size={21} />
                    Export Transactions
                  </button>
                </div>
              </Panel>

              <Panel title="Related Information" icon="link">
                <div className="ap-related-links">
                  <Link href={ROUTES.clientDetails(account.clientId)}>
                    <Icon name="groups" size={21} />
                    Client Details
                  </Link>

                  <Link href={ROUTES.accounts}>
                    <Icon name="layers" size={21} />
                    All Client Accounts
                  </Link>

                  <button
                    type="button"
                    onClick={() => setTab("activity")}
                  >
                    <Icon name="shield" size={21} />
                    Account Activity
                  </button>
                </div>
              </Panel>
            </aside>
          </div>
        )}

        {tab === "transactions" && (
          <div className="ap-tab-stack">
            <div className="ap-transaction-summary">
              <div>
                <span>Total Recorded Transactions</span>
                <strong>{transactions.length.toLocaleString("en-CA")}</strong>
              </div>
              <div>
                <span>Completed Transactions</span>
                <strong>
                  {completedTransactions.length.toLocaleString("en-CA")}
                </strong>
              </div>
              <div>
                <span>Total Credits</span>
                <strong className="ap-positive">
                  {formatMoney(totals.credits, account.currency)}
                </strong>
              </div>
              <div>
                <span>Total Debits</span>
                <strong className="ap-negative">
                  {formatMoney(totals.debits, account.currency)}
                </strong>
              </div>
            </div>

            <Panel
              title="Transaction History"
              icon="receipt_long"
              action={
                <button
                  type="button"
                  className="ap-text-action"
                  onClick={exportTransactions}
                >
                  <Icon name="download" size={18} />
                  Export CSV
                </button>
              }
            >
              <TransactionsTable
                transactions={transactions}
                account={account}
              />
            </Panel>
          </div>
        )}


        {tab === "documents" && (
          <div className="ap-tab-stack">
            <Panel title="Account Statements" icon="description">
              <div className="ap-documents-empty">
                <Icon name="receipt_long" size={45} />

                <h3>Account Statements</h3>

                <p>
                  Generate a statement containing completed transactions
                  for this account during the selected reporting period.
                </p>

                <div className="ap-statement-date-range">
                  <label>
                    From
                    <input
                      type="date"
                      value={statementFrom}
                      max={statementTo}
                      onChange={event =>
                        setStatementDates(current => ({
                          ...current,
                          from: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label>
                    To
                    <input
                      type="date"
                      value={statementTo}
                      min={statementFrom}
                      onChange={event =>
                        setStatementDates(current => ({
                          ...current,
                          to: event.target.value
                        }))
                      }
                    />
                  </label>
                </div>

                <button
                  type="button"
                  className="ap-secondary-button"
                  disabled={statementLoading}
                  onClick={() => void generateStatement()}
                >
                  <Icon name="download" size={20} />

                  {statementLoading
                    ? "Generating Statement..."
                    : "Download Account Statement"}
                </button>
              </div>
            </Panel>
          </div>
        )}


        {tab === "activity" && (
          <Panel title="Account Activity History" icon="history">
            {reportLoading ? (
              <p className="ap-empty">Loading account activity...</p>
            ) : operations?.audit.length ? (
              <div className="ap-activity-list">
                {operations.audit.map(event => (
                  <div className="ap-activity-item" key={event.eventId}>
                    <span className="ap-activity-indicator">
                      <Icon name="history" size={18} />
                    </span>

                    <div>
                      <strong>
                        {event.eventType.replaceAll("_", " ")}
                      </strong>
                      <p>
                        {formatDateTime(event.occurredAt)}
                      </p>
                      <small>Actor: {event.actorId}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ap-activity-list">
                {transactions.slice(0, 20).map(transaction => (
                  <div
                    className="ap-activity-item"
                    key={transaction.transactionId}
                  >
                    <span className="ap-activity-indicator">
                      <Icon name="swap_horiz" size={18} />
                    </span>

                    <div>
                      <strong>
                        {transactionDirection(
                          transaction,
                          account.accountId
                        )} — {transaction.referenceNumber}
                      </strong>
                      <p>{formatDateTime(transaction.createdAt)}</p>
                      <small>Status: {transaction.status}</small>
                    </div>
                  </div>
                ))}

                {transactions.length === 0 && (
                  <p className="ap-empty">
                    {reportError ||
                      "No recorded account activity is available."}
                  </p>
                )}
              </div>
            )}
          </Panel>
        )}
      </div>
    </section>
  );
}