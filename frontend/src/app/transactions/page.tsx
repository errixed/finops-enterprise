
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PAGINATION, ROUTES } from "../../../config";
import {
  type DirectoryFilters,
  type DirectoryResult,
  type DirectoryTransaction,
  type TransactionDetails,
  getTransactionDirectory,
  getTransaction
} from "@/services/transactions";
import {
  type Client,
  getClients
} from "@/services/clients";
import {
  type Account,
  getAccounts,
  formatMoney
} from "@/services/accounts";
import { Icon, StatusBadge } from "@/components/ui";
import "./transaction-directory.css";

type PreviewTab = "financial" | "audit" | "documents";

const initialFilters: DirectoryFilters = {
  search: "",
  clientId: "",
  accountId: "",
  transactionType: "",
  status: "",
  riskLevel: "",
  approvalStatus: "",
  dateFrom: "",
  dateTo: "",
  page: 1,
  pageSize: 10
};

function dateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-CA", {
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

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-CA", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
}

function minorMoney(value: string, currency = "CAD") {
  try {
    const amount = BigInt(value);
    const negative = amount < BigInt(0);
    const absolute = negative ? -amount : amount;
    const dollars = absolute / BigInt(100);
    const cents = absolute % BigInt(100);

    return `${negative ? "−" : ""}${dollars.toLocaleString("en-CA")}.${String(cents).padStart(2, "0")} ${currency}`;
  } catch {
    return "—";
  }
}

function Stat({
  title,
  value,
  icon,
  tone
}: {
  title: string;
  value: string;
  icon: string;
  tone: string;
}) {
  return (
    <article className={`td-stat td-stat-${tone}`}>
      <Icon name={icon} size={30} />
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </article>
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
    <div className="td-detail-row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function TransactionPreview({
  transaction,
  details,
  loading
}: {
  transaction: DirectoryTransaction;
  details: TransactionDetails | null;
  loading: boolean;
}) {
  const [tab, setTab] = useState<PreviewTab>("financial");

  const auditEvents = useMemo(() => {
    if (!details) return [];

    const events = [
      {
        label: "Transaction created",
        date: details.createdAt,
        description: "Transaction record was initiated"
      }
    ];

    if (details.updatedAt !== details.createdAt) {
      events.push({
        label: "Transaction updated",
        date: details.updatedAt,
        description: `Current financial status: ${details.status}`
      });
    }

    if (details.processedAt) {
      events.push({
        label: "Transaction processed",
        date: details.processedAt,
        description: `Processing result: ${details.status}`
      });
    }

    return events.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [details]);

  return (
    <section className="td-panel td-selected-preview">
      <header className="td-panel-header td-preview-heading">
        <h2>
          <Icon name="description" size={25} />
          Transaction Details — {transaction.referenceNumber}
        </h2>

        <div className="td-heading-actions">
          <Link href={ROUTES.transactionDetails(transaction.transactionId)}>
            <Icon name="receipt_long" size={18} />
            View Receipt / Details
          </Link>

          <Link href={ROUTES.accountDetails(transaction.sourceAccountId)}>
            <Icon name="layers" size={18} />
            View Account
          </Link>

          {transaction.clientId && (
            <Link href={ROUTES.clientDetails(transaction.clientId)}>
              <Icon name="groups" size={18} />
              View Client
            </Link>
          )}

          <Link
            className="td-primary-action"
            href={ROUTES.transactionDetails(transaction.transactionId)}
          >
            <Icon name="visibility" size={18} />
            Full Details
          </Link>
        </div>
      </header>

      <div className="td-preview-content">
        <div className="td-preview-summary">
          <Detail label="Client">
            {transaction.clientId ? (
              <Link href={ROUTES.clientDetails(transaction.clientId)}>
                {transaction.companyName ?? transaction.clientId}
              </Link>
            ) : (
              "Not available"
            )}
          </Detail>

          <Detail label="Account">
            <Link href={ROUTES.accountDetails(transaction.sourceAccountId)}>
              {transaction.sourceAccountNumber ?? "Account"}
            </Link>
            {transaction.sourceAccountName
              ? ` — ${transaction.sourceAccountName}`
              : ""}
          </Detail>

          <Detail label="Type">{transaction.transactionType}</Detail>

          <Detail label="Amount">
            {formatMoney(transaction.amountMinor, transaction.currency)}
          </Detail>

          <Detail label="Date & Time">
            {dateTime(transaction.createdAt)}
          </Detail>

          <Detail label="Reference">
            {transaction.referenceNumber}
          </Detail>

          <Detail label="Description">
            {transaction.description || "Not provided"}
          </Detail>
        </div>

        <div className="td-preview-right">
          <nav className="td-preview-tabs" aria-label="Transaction detail sections">
            {([
              ["financial", "Financial & Risk", "monitoring"],
              ["audit", "Audit Trail", "schedule"],
              ["documents", "Related Documents", "description"]
            ] as const).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? "active" : ""}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                <Icon name={icon} size={19} />
                {label}
              </button>
            ))}
          </nav>

          {tab === "financial" && (
            <div className="td-financial-grid">
              <div>
                <Detail label="Financial Status">
                  <StatusBadge status={transaction.status} />
                </Detail>
                <Detail label="Approval Status">
                  {transaction.approvalStatus
                    ? <StatusBadge status={transaction.approvalStatus} />
                    : "Not required or unavailable"}
                </Detail>
                <Detail label="Risk Level">
                  {transaction.riskLevel
                    ? <StatusBadge status={transaction.riskLevel} />
                    : "Not assessed"}
                </Detail>
              </div>

              <div>
                <Detail label="Risk Score">
                  {transaction.riskScore == null
                    ? "Not assessed"
                    : `${transaction.riskScore} / 100`}
                </Detail>
                <Detail label="Processing Eligible">
                  {loading
                    ? "Loading..."
                    : details?.status === "Pending"
                      ? details.approvalRequired === false ||
                        details.approvalStatus === "Approved"
                        ? "Approval conditions met"
                        : "Requires verification"
                      : "Not pending"}
                </Detail>
                <Detail label="Last Updated">
                  {loading
                    ? "Loading..."
                    : dateTime(details?.updatedAt ?? transaction.createdAt)}
                </Detail>
              </div>
            </div>
          )}

          {tab === "audit" && (
            <div className="td-audit-timeline">
              {loading ? (
                <p>Loading transaction history...</p>
              ) : auditEvents.length ? (
                auditEvents.map((event, index) => (
                  <div key={`${event.label}-${index}`}>
                    <Icon name="history" size={19} />
                    <div>
                      <strong>{event.label}</strong>
                      <time>{dateTime(event.date)}</time>
                      <p>{event.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p>No transaction lifecycle timestamps available.</p>
              )}
              <small>
                This shows stored transaction timestamps, not a complete user-action audit log.
              </small>
            </div>
          )}

          {tab === "documents" && (
            <div className="td-documents-panel">
              <Icon name="folder_open" size={32} />
              <strong>No linked documents available</strong>
              <p>
                The current transaction API does not have stored document
                references for this transaction.
              </p>
              <Link href={ROUTES.transactionDetails(transaction.transactionId)}>
                Open Transaction Details
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function TransactionsPage() {
  const [draft, setDraft] = useState<DirectoryFilters>({ ...initialFilters });
  const [filters, setFilters] = useState<DirectoryFilters>({ ...initialFilters });

  const [result, setResult] = useState<DirectoryResult | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, DirectoryTransaction>>({});
  const [details, setDetails] = useState<TransactionDetails | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    Promise.all([
      getClients({ page: 1, pageSize: 100 }),
      getAccounts()
    ]).then(([clientResult, accountResult]) => {
      if (!active) return;
      setClients(clientResult.data);
      setAccounts(accountResult);
    }).catch(() => {
      if (active) setMessage("Some filter options could not be loaded.");
    });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    getTransactionDirectory(filters)
      .then(data => {
        if (!active) return;

        setResult(data);
        setSelectedId(current =>
          data.data.some(t => t.transactionId === current)
            ? current
            : data.data[0]?.transactionId ?? null
        );
      })
      .catch(err => {
        if (!active) return;

        setResult(null);
        setSelectedId(null);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load transactions."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [filters, refreshKey]);

  const transactions = result?.data ?? [];

  const selected = transactions.find(
    transaction => transaction.transactionId === selectedId
  ) ?? null;

  useEffect(() => {
    if (!selected) {
      setDetails(null);
      return;
    }

    let active = true;

    setDetails(null);
    setDetailsLoading(true);

    getTransaction(selected.transactionId)
      .then(data => {
        if (active) setDetails(data);
      })
      .catch(() => {
        if (active) setDetails(null);
      })
      .finally(() => {
        if (active) setDetailsLoading(false);
      });

    return () => { active = false; };
  }, [selected?.transactionId]);

  const availableAccounts = useMemo(
    () => accounts.filter(account =>
      !draft.clientId || account.clientId === draft.clientId
    ),
    [accounts, draft.clientId]
  );

  const accountTypes = useMemo(
    () => Array.from(new Set(
      transactions.map(transaction => transaction.transactionType)
    )).sort(),
    [transactions]
  );

  const total = result?.pagination.total ?? 0;
  const page = result?.pagination.page ?? filters.page ?? 1;
  const pageSize = result?.pagination.pageSize ?? filters.pageSize ?? 10;
  const totalPages = result?.pagination.totalPages ?? 0;

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  const visiblePages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => Math.max(
      1,
      Math.min(page - 2, totalPages - 4)
    ) + index
  );

  const allChecked = transactions.length > 0 &&
    transactions.every(t => checked[t.transactionId]);

  const summary = result?.summary;

  function setFilter(
    field: keyof DirectoryFilters,
    value: string
  ) {
    setDraft(current => ({
      ...current,
      [field]: value,
      ...(field === "clientId" ? { accountId: "" } : {})
    }));
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      draft.dateFrom &&
      draft.dateTo &&
      draft.dateFrom > draft.dateTo
    ) {
      setFilterError("Start date must not be after end date.");
      return;
    }

    setFilterError("");
    setFilters({
      ...draft,
      page: 1,
      pageSize
    });
  }

  function clearFilters() {
    setDraft({ ...initialFilters, pageSize });
    setFilters({ ...initialFilters, pageSize });
    setSelectedId(null);
    setFilterError("");
  }

  function changePage(next: number) {
    setFilters(current => ({ ...current, page: next }));
  }

  function exportRows(rows: DirectoryTransaction[], filename: string) {
    const escape = (value: unknown) => {
      let string = String(value ?? "");
      if (/^[=+\-@\t\r]/.test(string)) string = `'${string}`;
      return `"${string.replaceAll('"', '""')}"`;
    };

    const header = [
      "Date", "Reference", "Client", "Source Account",
      "Destination Account", "Type", "Amount Minor",
      "Currency", "Status", "Risk Level", "Approval Status"
    ];

    const lines = rows.map(t => [
      t.createdAt,
      t.referenceNumber,
      t.companyName,
      t.sourceAccountNumber,
      t.destinationAccountNumber,
      t.transactionType,
      t.amountMinor,
      t.currency,
      t.status,
      t.riskLevel,
      t.approvalStatus
    ]);

    const csv = [header, ...lines]
      .map(row => row.map(escape).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportSelected() {
    const rows = Object.values(checked);

    if (rows.length === 0) {
      setMessage("Select transactions before exporting.");
      return;
    }

    exportRows(rows, "finops-selected-transactions.csv");
    setMessage(`${rows.length} transactions exported.`);
  }

  return (
    <section className="td-page td-directory-v2">
      <div className="td-stats">
        <Stat
          title="Total Transactions"
          value={(summary?.totalTransactions ?? 0).toLocaleString("en-CA")}
          icon="database"
          tone="blue"
        />
        <Stat
          title="Total Inflows (CAD)"
          value={minorMoney(summary?.totalInternalCreditsCADMinor ?? "0")}
          icon="north"
          tone="green"
        />
        <Stat
          title="Total Outflows (CAD)"
          value={minorMoney(summary?.totalInternalDebitsCADMinor ?? "0")}
          icon="south"
          tone="red"
        />
        <Stat
          title="Net Change (CAD)"
          value={minorMoney(summary?.netInternalChangeCADMinor ?? "0")}
          icon="layers"
          tone="green"
        />
        <Stat
          title="High/Critical Risk"
          value={String(summary?.highCriticalRisk ?? 0)}
          icon="warning"
          tone="red"
        />
        <Stat
          title="Pending Approval"
          value={String(summary?.pendingApproval ?? 0)}
          icon="hourglass_top"
          tone="amber"
        />
      </div>

      <div className="td-layout">
        <aside className="td-panel td-filters">
          <header className="td-panel-header">
            <h2><Icon name="filter_alt" size={23} /> Filters</h2>
          </header>

          <form className="td-filter-form" onSubmit={applyFilters}>
            <label className="td-field">
              <span>Search</span>
              <input
                placeholder="Reference, client, account..."
                value={draft.search ?? ""}
                onChange={e => setFilter("search", e.target.value)}
              />
            </label>

            <label className="td-field">
              <span>Date From</span>
              <input
                type="date"
                value={draft.dateFrom ?? ""}
                onChange={e => setFilter("dateFrom", e.target.value)}
              />
            </label>

            <label className="td-field">
              <span>Date To</span>
              <input
                type="date"
                value={draft.dateTo ?? ""}
                onChange={e => setFilter("dateTo", e.target.value)}
              />
            </label>

            <label className="td-field">
              <span>Client</span>
              <select
                value={draft.clientId ?? ""}
                onChange={e => setFilter("clientId", e.target.value)}
              >
                <option value="">All Clients</option>
                {clients.map(client => (
                  <option key={client.clientId} value={client.clientId}>
                    {client.companyName}
                  </option>
                ))}
              </select>
            </label>

            <label className="td-field">
              <span>Account</span>
              <select
                value={draft.accountId ?? ""}
                onChange={e => setFilter("accountId", e.target.value)}
              >
                <option value="">All Accounts</option>
                {availableAccounts.map(account => (
                  <option key={account.accountId} value={account.accountId}>
                    {account.accountNumber}
                  </option>
                ))}
              </select>
            </label>

            <label className="td-field">
              <span>Transaction Type</span>
              <select
                value={draft.transactionType ?? ""}
                onChange={e => setFilter("transactionType", e.target.value)}
              >
                <option value="">All Types</option>
                {Array.from(new Set(["Transfer", ...accountTypes])).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>

            <label className="td-field">
              <span>Financial Status</span>
              <select
                value={draft.status ?? ""}
                onChange={e => setFilter("status", e.target.value)}
              >
                <option value="">All Statuses</option>
                {["Pending", "Processing", "Completed", "Rejected"].map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>

            <label className="td-field">
              <span>Risk Level</span>
              <select
                value={draft.riskLevel ?? ""}
                onChange={e => setFilter("riskLevel", e.target.value)}
              >
                <option value="">All Risk Levels</option>
                {["Low", "Medium", "High", "Critical"].map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>

            <label className="td-field">
              <span>Approval Status</span>
              <select
                value={draft.approvalStatus ?? ""}
                onChange={e => setFilter("approvalStatus", e.target.value)}
              >
                <option value="">All Approval Statuses</option>
                {[
                  "Pending", "InReview", "Escalated",
                  "Approved", "Rejected", "Cancelled"
                ].map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>

            {filterError && (
              <p className="td-error" role="alert">{filterError}</p>
            )}

            <button type="submit" className="td-apply-button" disabled={loading}>
              <Icon name="search" size={20} />
              Apply Filters
            </button>

            <button
              type="button"
              className="td-clear-button"
              onClick={clearFilters}
            >
              <Icon name="close" size={20} />
              Clear Filters
            </button>
          </form>
        </aside>

        <main className="td-main">
          <section className="td-panel">
            <header className="td-panel-header td-directory-heading">
              <h2>
                <Icon name="list" size={24} />
                Transactions ({total.toLocaleString("en-CA")})
              </h2>

              <div className="td-heading-actions">
                <Link className="td-primary-action" href={ROUTES.transactionCreate}>
                  <Icon name="add" size={19} />
                  New Transaction
                </Link>

                <button type="button" onClick={exportSelected}>
                  <Icon name="download" size={19} />
                  Export ({Object.keys(checked).length})
                </button>
                <Link href={ROUTES.transactionHistory}>
                  <Icon name="history" size={19} />
                  Transaction History
                </Link>

                <button
                  type="button"
                  aria-label="Refresh transactions"
                  title="Refresh transactions"
                  onClick={() => setRefreshKey(value => value + 1)}
                >
                  <Icon name="refresh" size={20} />
                </button>

              </div>
            </header>

            {(error || message) && (
              <div className="td-notice" role="status">{error || message}</div>
            )}

            <div className="td-table-scroll">
              <table className="td-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Select visible transactions"
                        checked={Boolean(allChecked)}
                        onChange={event => setChecked(current => {
                          const next = { ...current };

                          for (const transaction of transactions) {
                            if (event.target.checked) {
                              next[transaction.transactionId] = transaction;
                            } else {
                              delete next[transaction.transactionId];
                            }
                          }

                          return next;
                        })}
                      />
                    </th>
                    <th>Date & Time</th>
                    <th>Transaction ID</th>
                    <th>Client</th>
                    <th>Account</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Financial Status</th>
                    <th>Risk Level</th>
                    <th>Approval Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td className="td-table-empty" colSpan={11}>
                        Loading transactions...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td className="td-table-empty" colSpan={11}>
                        No transactions match your filters.
                      </td>
                    </tr>
                  ) : transactions.map(transaction => (
                    <tr
                      key={transaction.transactionId}
                      className={
                        selectedId === transaction.transactionId
                          ? "td-row-selected"
                          : ""
                      }
                      onClick={() => setSelectedId(transaction.transactionId)}
                    >
                      <td onClick={event => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${transaction.referenceNumber}`}
                          checked={Boolean(checked[transaction.transactionId])}
                          onChange={event => setChecked(current => {
                            const next = { ...current };

                            if (event.target.checked) {
                              next[transaction.transactionId] = transaction;
                            } else {
                              delete next[transaction.transactionId];
                            }

                            return next;
                          })}
                        />
                      </td>

                      <td>{dateTime(transaction.createdAt)}</td>

                      <td>
                        <button
                          type="button"
                          className="td-reference"
                          onClick={() => setSelectedId(transaction.transactionId)}
                        >
                          {transaction.referenceNumber}
                        </button>
                      </td>

                      <td>
                        {transaction.clientId ? (
                          <Link
                            href={ROUTES.clientDetails(transaction.clientId)}
                            onClick={event => event.stopPropagation()}
                          >
                            {transaction.companyName ?? transaction.clientId}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>
                        <Link
                          href={ROUTES.accountDetails(transaction.sourceAccountId)}
                          onClick={event => event.stopPropagation()}
                        >
                          {transaction.sourceAccountNumber ?? "View Account"}
                        </Link>
                      </td>

                      <td>{transaction.transactionType}</td>

                      <td className="td-amount">
                        {formatMoney(
                          transaction.amountMinor,
                          transaction.currency
                        )}
                      </td>

                      <td><StatusBadge status={transaction.status} /></td>

                      <td>
                        {transaction.riskLevel
                          ? <StatusBadge status={transaction.riskLevel} />
                          : <span className="td-muted">Not assessed</span>}
                      </td>

                      <td>
                        {transaction.approvalStatus
                          ? <StatusBadge status={transaction.approvalStatus} />
                          : <span className="td-muted">Not required / unavailable</span>}
                      </td>

                      <td onClick={event => event.stopPropagation()}>
                        <div className="td-row-actions">
                          <button
                            type="button"
                            title="Preview transaction"
                            aria-label={`Preview ${transaction.referenceNumber}`}
                            onClick={() => setSelectedId(transaction.transactionId)}
                          >
                            <Icon name="visibility" size={20} />
                          </button>

                          <Link
                            href={ROUTES.transactionDetails(transaction.transactionId)}
                            title="Full transaction details"
                          >
                            <Icon name="more_horiz" size={20} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="td-footer">
              <div>
                <label htmlFor="td-page-size">Show:</label>
                <select
                  id="td-page-size"
                  value={pageSize}
                  onChange={event => setFilters(current => ({
                    ...current,
                    page: 1,
                    pageSize: Number(event.target.value)
                  }))}
                >
                  {PAGINATION.PAGE_SIZE_OPTIONS.map(value => (
                    <option key={value} value={value}>
                      {value} per page
                    </option>
                  ))}
                </select>
                <span>{first}–{last} of {total.toLocaleString("en-CA")}</span>
              </div>

              <nav className="td-pagination" aria-label="Transaction pages">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => changePage(1)}
                  aria-label="First page"
                >
                  <Icon name="first_page" />
                </button>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => changePage(page - 1)}
                  aria-label="Previous page"
                >
                  <Icon name="chevron_left" />
                </button>

                {visiblePages.map(number => (
                  <button
                    type="button"
                    key={number}
                    className={page === number ? "active" : ""}
                    onClick={() => changePage(number)}
                    aria-current={page === number ? "page" : undefined}
                  >
                    {number}
                  </button>
                ))}

                {totalPages > 5 && <span>… {totalPages}</span>}

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => changePage(page + 1)}
                  aria-label="Next page"
                >
                  <Icon name="chevron_right" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => changePage(totalPages)}
                  aria-label="Last page"
                >
                  <Icon name="last_page" />
                </button>
              </nav>
            </footer>
          </section>

          {selected && (
            <TransactionPreview
              key={selected.transactionId}
              transaction={selected}
              details={details}
              loading={detailsLoading}
            />
          )}
        </main>
      </div>
    </section>
  );
}
