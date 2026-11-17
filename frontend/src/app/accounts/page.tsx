
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ENUMS, ROUTES } from "../../../config";
import {
  Account,
  AccountDetails,
  Transaction,
  AccountInput,
  getAccounts,
  getAccount,
  registerAccount,
  formatMoney,
  parseMoney
} from "@/services/accounts";
import { getClients } from "@/services/clients";
import { Icon, StatusBadge } from "@/components/ui";
import "./accounts-directory.css";

import {
  type AccountOperationsReport,
  getAccountOperationsReport,
  getAccountsWithActivity,
  downloadAccountStatement
} from "@/services/accounts";

import AccountBalanceTrend from "@/components/accounts/AccountBalanceTrend";

type Tab = "overview" | "transactions" | "limits" | "activity" | "client";

type FilterState = {
  client: string;
  types: string[];
  statuses: string[];
  currency: string;
  minBalance: string;
  maxBalance: string;
};

const initialFilters: FilterState = {
  client: "",
  types: [],
  statuses: [],
  currency: "",
  minBalance: "",
  maxBalance: ""
};

const tabs: { id: Tab; title: string; icon: string }[] = [
  { id: "overview", title: "Overview", icon: "monitoring" },
  { id: "transactions", title: "Transactions", icon: "swap_horiz" },
  { id: "limits", title: "Limits & Terms", icon: "verified_user" },
  { id: "activity", title: "Activity", icon: "schedule" },
  { id: "client", title: "Related Client", icon: "groups" }
];

function dateText(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-CA", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
}

function dateTimeText(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-CA", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
}

function countText(value: number) {
  return value.toLocaleString("en-CA");
}

function percentage(part: number, total: number) {
  return total > 0
    ? `${(part / total * 100).toFixed(1)}%`
    : "0.0%";
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  tone: string;
}) {
  return (
    <article className={`ad-stat ad-stat-${tone}`}>
      <Icon name={icon} size={39} />
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{subtitle}</small>
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
    <section className="ad-detail-panel">
      <header>
        <h3>
          <Icon name={icon} size={21} />
          {title}
        </h3>
      </header>
      <div className="ad-detail-body">{children}</div>
    </section>
  );
}

function TransactionTable({
  transactions
}: {
  transactions: Transaction[];
}) {
  if (transactions.length === 0) {
    return <p className="ad-empty">No transactions recorded for this account.</p>;
  }

  return (
    <div className="ad-table-scroll">
      <table className="ad-table">
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Date</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(transaction => (
            <tr key={transaction.transactionId}>
              <td>
                <Link href={ROUTES.transactionDetails(transaction.transactionId)}>
                  {transaction.referenceNumber}
                </Link>
              </td>
              <td>{dateTimeText(transaction.createdAt)}</td>
              <td>{transaction.transactionType ?? "Transfer"}</td>
              <td>{formatMoney(transaction.amountMinor, transaction.currency)}</td>
              <td><StatusBadge status={transaction.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountPreview({
  account,
  details,
  loading
}: {
  account: Account;
  details: AccountDetails | null;
  loading: boolean;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  const [operations, setOperations] =
    useState<AccountOperationsReport | null>(null);

  const [operationsError, setOperationsError] = useState("");

  useEffect(() => {
    let active = true;

    setOperations(null);
    setOperationsError("");

    getAccountOperationsReport(account.accountId)
      .then(result => {
        if (active) setOperations(result);
      })
      .catch(error => {
        if (active) {
          setOperationsError(
            error instanceof Error
              ? error.message
              : "Unable to load account reporting."
          );
        }
      });

    return () => {
      active = false;
    };
  }, [account.accountId]);

  useEffect(() => {
    setTab("overview");
  }, [account.accountId]);

  const transactions = details?.transactions ?? [];

  const sortedTransactions = useMemo(() =>
    [...transactions].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    ), [transactions]
  );

  const latest = sortedTransactions[0];

  const accountInformation = (
    <div className="ad-account-information">
      <div>
        <Icon name="layers" size={20} />
        <span>Account Type</span>
        <strong>{account.accountType}</strong>
      </div>
      <div>
        <Icon name="paid" size={20} />
        <span>Currency</span>
        <strong>{account.currency}</strong>
      </div>
      <div>
        <Icon name="account_balance_wallet" size={20} />
        <span>Current Balance</span>
        <strong>{formatMoney(account.balanceMinor, account.currency)}</strong>
      </div>
      <div>
        <Icon name="calendar_month" size={20} />
        <span>Opened On</span>
        <strong>{dateText(account.createdAt)}</strong>
      </div>
      <div>
        <Icon name="schedule" size={20} />
        <span>Last Transaction</span>
        <strong>
          {loading ? "Loading..." : dateText(latest?.createdAt)}
        </strong>
      </div>
    </div>
  );

  return (
    <section className="ad-account-preview">
      <header className="ad-account-preview-header">
        <div className="ad-account-preview-title">
          <Icon name="layers" size={32} />
          <div>
            <div>
              <h2>Account {account.accountNumber}</h2>
              <StatusBadge status={account.status} />
            </div>
            <p>
              Client: {details?.companyName ?? account.companyName ?? "Loading..."}
            </p>
          </div>
        </div>

        <nav className="ad-account-tabs" aria-label="Account preview tabs">
          {tabs.map(item => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
            >
              <Icon name={item.icon} size={19} />
              {item.title}
            </button>
          ))}
        </nav>
      </header>

      {tab === "overview" && (
        <div className="ad-account-overview">
          {accountInformation}

          <Panel title="Balance Trend (Last 6 Months)" icon="monitoring">
            {operations ? (
              <AccountBalanceTrend
                points={operations.history.months}
                currency={operations.history.currency}
              />
            ) : (
              <p className="ad-empty">
                {operationsError || "Loading balance history..."}
              </p>
            )}
          </Panel>

          <Panel title="Key Details" icon="description">
            <div className="ad-key-details">
              <div className="ad-key-detail-row">
                <span>Credit Limit:</span>

                <strong>
                  {operations?.financial.creditLimitMinor == null
                    ? "Not configured"
                    : formatMoney(
                      operations.financial.creditLimitMinor,
                      account.currency
                    )}
                </strong>
              </div>

              <div className="ad-key-detail-row">
                <span>Available Limit:</span>

                <strong>
                  {operations?.financial.availableLimitMinor == null
                    ? "Not available"
                    : formatMoney(
                      operations.financial.availableLimitMinor,
                      account.currency
                    )}
                </strong>
              </div>

              <div className="ad-key-detail-row">
                <span>Utilization:</span>

                {operations?.financial.utilizationPercent == null ? (
                  <strong>Not available</strong>
                ) : (
                  <div className="ad-utilization-value">
                    <div
                      className="ad-utilization-track"
                      role="progressbar"
                      aria-label="Credit utilization"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(
                        100,
                        Math.max(0, operations.financial.utilizationPercent)
                      )}
                    >
                      <div
                        className="ad-utilization-fill"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, operations.financial.utilizationPercent)
                          )}%`
                        }}
                      />
                    </div>

                    <strong>
                      {operations.financial.utilizationPercent.toFixed(1)}%
                    </strong>
                  </div>
                )}
              </div>

              <div className="ad-key-detail-row">
                <span>Account Status:</span>

                <StatusBadge status={account.status} />
              </div>
            </div>
          </Panel>

          <Panel title="Quick Actions" icon="bolt">
            <div className="ad-preview-quick-actions">

              <Link href={ROUTES.transactionCreate}>
                <Icon name="swap_horiz" size={21} />
                New Transaction
              </Link>

              <button
                type="button"
                onClick={() => setTab("transactions")}
              >
                <Icon name="receipt_long" size={21} />
                View Transactions
              </button>

              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  const from = new Date(today);
                  from.setUTCMonth(from.getUTCMonth() - 1);

                  void downloadAccountStatement(
                    account.accountId,
                    from.toISOString().slice(0, 10),
                    today.toISOString().slice(0, 10)
                  ).catch(error => {
                    window.alert(
                      error instanceof Error
                        ? error.message
                        : "Unable to download statement."
                    );
                  });
                }}
              >
                <Icon name="description" size={21} />
                Account Statement
              </button>
            </div>
          </Panel>

        </div>
      )}

      {tab === "transactions" && (
        <div className="ad-tab-content">
          <TransactionTable transactions={sortedTransactions} />
        </div>
      )}

      {tab === "limits" && (
        <div className="ad-tab-content">
          <Panel title="Limits & Terms" icon="verified_user">
            <p className="ad-empty">
              Credit limits, available facilities, utilization and account terms
              have not been configured in the account data model.
            </p>
          </Panel>
        </div>
      )}

      {tab === "activity" && (
        <div className="ad-tab-content">
          <Panel title="Account Audit History" icon="history">
            {!operations ? (
              <p className="ad-empty">
                {operationsError || "Loading audit history..."}
              </p>
            ) : operations.audit.length === 0 ? (
              <p className="ad-empty">
                No account audit events have been recorded yet.
              </p>
            ) : (
              <div className="ad-activity-timeline">
                {operations.audit.map(event => (
                  <div key={event.eventId}>
                    <span className="ad-activity-dot" />

                    <time>
                      {dateTimeText(event.occurredAt)}
                    </time>

                    <p>
                      <strong>
                        {event.eventType.replaceAll("_", " ")}
                      </strong>
                      <span>
                        {" "}· {event.actorId}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {tab === "client" && (
        <div className="ad-tab-content">
          <Panel title="Related Client" icon="groups">
            <div className="ad-key-details">
              <div>
                <span>Client</span>
                <strong>{details?.companyName ?? account.companyName ?? "—"}</strong>
              </div>
              <div>
                <span>Client Status</span>
                {details ? (
                  <StatusBadge status={details.clientStatus} />
                ) : (
                  <span>Unavailable</span>
                )}
              </div>
            </div>
            <Link
              className="ad-preview-client-link"
              href={ROUTES.clientDetails(account.clientId)}
            >
              Open Client Details
              <Icon name="arrow_forward" size={17} />
            </Link>
          </Panel>
        </div>
      )}
    </section>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [draft, setDraft] = useState<FilterState>(initialFilters);
  const [applied, setApplied] = useState<FilterState>(initialFilters);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, Account>>({});

  const [details, setDetails] = useState<AccountDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    getAccountsWithActivity()
      .then(data => {
        if (active) setAccounts(data);
      })
      .catch(err => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load accounts.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [refreshKey]);

  const availableTypes = useMemo(
    () => Array.from(new Set([
      ...ENUMS.ACCOUNT_TYPES,
      ...accounts.map(account => account.accountType)
    ])).sort(),
    [accounts]
  );

  const availableStatuses = useMemo(
    () => Array.from(new Set([
      ...ENUMS.ACCOUNT_STATUSES,
      ...accounts.map(account => account.status)
    ])).sort(),
    [accounts]
  );

  const filtered = useMemo(() =>
    accounts.filter(account => {
      const query = applied.client.trim().toLowerCase();

      if (query && ![
        account.companyName,
        account.clientId,
        account.accountNumber
      ].some(value => (value ?? "").toLowerCase().includes(query))) {
        return false;
      }

      if (applied.types.length &&
        !applied.types.includes(account.accountType)) return false;

      if (applied.statuses.length &&
        !applied.statuses.includes(account.status)) return false;

      if (applied.currency &&
        applied.currency !== account.currency) return false;

      if (applied.minBalance !== "" &&
        account.balanceMinor / 100 < Number(applied.minBalance)) return false;

      if (applied.maxBalance !== "" &&
        account.balanceMinor / 100 > Number(applied.maxBalance)) return false;

      return true;
    }),
    [accounts, applied]
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  const selected = filtered.find(a => a.accountId === selectedId) ??
    visible[0] ?? null;

  useEffect(() => {
    if (!selected) {
      setDetails(null);
      return;
    }

    let active = true;
    setDetails(null);
    setDetailsLoading(true);

    getAccount(selected.accountId)
      .then(result => {
        if (active) setDetails(result);
      })
      .catch(() => {
        if (active) setDetails(null);
      })
      .finally(() => {
        if (active) setDetailsLoading(false);
      });

    return () => { active = false; };
  }, [selected?.accountId, refreshKey]);

  const activeCount = accounts.filter(a => a.status === "Active").length;
  const reviewCount = accounts.filter(a => a.status === "In Review").length;
  const suspendedCount = accounts.filter(a =>
    a.status === "Suspended" || a.status === "Frozen"
  ).length;

  const cadBalance = accounts
    .filter(a => a.currency === "CAD")
    .reduce((sum, a) => sum + a.balanceMinor, 0);

  const selectedCount = Object.keys(checked).length;

  const allChecked = visible.length > 0 &&
    visible.every(a => Boolean(checked[a.accountId]));

  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);

  const firstPage = Math.max(
    1,
    Math.min(page - 2, totalPages - 4)
  );

  const visiblePages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => firstPage + index
  );

  function toggleFilter(field: "types" | "statuses", value: string) {
    setDraft(current => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter(item => item !== value)
        : [...current[field], value]
    }));
  }

  function applyFilters() {
    if ((draft.minBalance || draft.maxBalance) && !draft.currency) {
      setError("Select a currency before applying a balance range.");
      return;
    }

    if (draft.minBalance !== "" &&
      draft.maxBalance !== "" &&
      Number(draft.minBalance) > Number(draft.maxBalance)) {
      setError("Minimum balance cannot exceed maximum balance.");
      return;
    }

    setError("");
    setApplied({ ...draft });
    setPage(1);
    setSelectedId(null);
  }

  function clearFilters() {
    setDraft(initialFilters);
    setApplied(initialFilters);
    setPage(1);
    setSelectedId(null);
    setError("");
  }

  function exportSelected() {
    const records = Object.values(checked);

    if (!records.length) {
      setMessage("Select at least one account to export.");
      return;
    }

    const headers = [
      "Account ID", "Account Number", "Client ID", "Client Name",
      "Account Type", "Currency", "Balance Minor", "Status", "Opened On"
    ];

    const escape = (value: unknown) => {
      let text = String(value ?? "");
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };

    const rows = records.map(a => [
      a.accountId,
      a.accountNumber,
      a.clientId,
      a.companyName ?? "",
      a.accountType,
      a.currency,
      a.balanceMinor,
      a.status,
      a.createdAt
    ]);

    const csv = [headers, ...rows].map(
      row => row.map(escape).join(",")
    ).join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "finops-selected-accounts.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    setMessage(`${records.length} selected accounts exported.`);
  }

  async function importCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (file.size > 1024 * 1024) {
      setMessage("CSV file must be smaller than 1 MB.");
      return;
    }

    setImporting(true);
    setMessage("");

    try {
      const text = (await file.text()).replace(/^\uFEFF/, "");
      const lines = text.trim().split(/\r?\n/);
      const header = lines.shift()?.split(",").map(x =>
        x.trim().replace(/^"|"$/g, "").toLowerCase()
      ) ?? [];

      const required = [
        "client id", "account type", "currency", "opening balance"
      ];

      if (!required.every(name => header.includes(name))) {
        throw new Error(
          "CSV columns must be: Client ID, Account Type, Currency, Opening Balance"
        );
      }

      if (lines.length > 100) {
        throw new Error("Maximum 100 accounts per import.");
      }

      const confirmed = window.confirm(
        `Create ${lines.length} accounts from this CSV?`
      );

      if (!confirmed) return;

      let success = 0;
      let failed = 0;

      for (const line of lines) {
        const values = line.split(",").map(x =>
          x.trim().replace(/^"|"$/g, "")
        );

        const field = (name: string) =>
          values[header.indexOf(name)] ?? "";

        try {

          const accountType = field("account type");
          const clientId = field("client id");
          const openingBalance = field("opening balance");

          const input: AccountInput = {
            clientId,
            accountType,
            accountName: field("account name") || `${accountType} Account`,
            currency: field("currency"),
            purpose: field("purpose") || "Imported account",
            status: field("status") || "Active",
            openDate: field("open date") || new Date().toISOString().slice(0, 10),
            balanceMinor: parseMoney(openingBalance),
            creditLimitMinor: null,
            allowTransactions: true,
            allowInternationalTransactions: false,
            requireDualApproval: false,
            temporaryAccount: false,
            notes: ""
          };


          await registerAccount(input);
          success++;
        } catch {
          failed++;
        }
      }

      setMessage(`${success} accounts imported, ${failed} failed.`);
      setRefreshKey(value => value + 1);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Import failed."
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="account-directory-page ad-milestone">
      <div className="ad-stats-grid">
        <StatCard title="Total Accounts"
          value={loading ? "—" : countText(accounts.length)}
          subtitle="All registered accounts"
          icon="layers" tone="blue" />

        <StatCard title="Active"
          value={loading ? "—" : countText(activeCount)}
          subtitle={percentage(activeCount, accounts.length)}
          icon="check_circle" tone="green" />

        <StatCard title="In Review"
          value={loading ? "—" : countText(reviewCount)}
          subtitle={percentage(reviewCount, accounts.length)}
          icon="hourglass_top" tone="amber" />

        <StatCard title="Restricted"
          value={loading ? "—" : countText(suspendedCount)}
          subtitle="Frozen or suspended"
          icon="warning" tone="red" />

        <StatCard title="Total Balance (CAD)"
          value={loading ? "—" : formatMoney(cadBalance, "CAD")}
          subtitle="CAD accounts only"
          icon="database" tone="purple" />
      </div>

      <div className="ad-layout">
        <aside className="ad-panel ad-filter-panel">
          <header className="ad-panel-heading">
            <h2><Icon name="filter_alt" size={24} /> Filters</h2>
            <button type="button" onClick={clearFilters}>Clear All</button>
          </header>

          <form className="ad-filter-content" onSubmit={event => {
            event.preventDefault();
            applyFilters();
          }}>
            <div className="ad-field">
              <label htmlFor="ad-client">Client</label>
              <input id="ad-client"
                placeholder="Search client name or ID..."
                value={draft.client}
                onChange={event => setDraft(current => ({
                  ...current, client: event.target.value
                }))} />
            </div>

            <fieldset className="ad-checkbox-group">
              <legend>Account Type</legend>
              {availableTypes.map(item => (
                <label key={item}>
                  <input type="checkbox"
                    checked={draft.types.includes(item)}
                    onChange={() => toggleFilter("types", item)} />
                  {item}
                </label>
              ))}
            </fieldset>

            <fieldset className="ad-checkbox-group">
              <legend>Status</legend>
              {availableStatuses.map(item => (
                <label key={item}>
                  <input type="checkbox"
                    checked={draft.statuses.includes(item)}
                    onChange={() => toggleFilter("statuses", item)} />
                  {item}
                </label>
              ))}
            </fieldset>

            <div className="ad-field">
              <label htmlFor="ad-currency">Currency</label>
              <select id="ad-currency"
                value={draft.currency}
                onChange={event => setDraft(current => ({
                  ...current, currency: event.target.value
                }))}>
                <option value="">All Currencies</option>
                {ENUMS.CURRENCIES.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="ad-field">
              <label>Balance Range</label>
              <div className="ad-balance-range">
                <input type="number" min="0" step="0.01"
                  placeholder="From"
                  value={draft.minBalance}
                  onChange={event => setDraft(current => ({
                    ...current, minBalance: event.target.value
                  }))} />
                <input type="number" min="0" step="0.01"
                  placeholder="To"
                  value={draft.maxBalance}
                  onChange={event => setDraft(current => ({
                    ...current, maxBalance: event.target.value
                  }))} />
              </div>
              <small>Select a currency for balance filtering.</small>
            </div>

            <button type="submit" className="ad-apply-button">
              <Icon name="search" size={21} />
              Apply Filters
            </button>
          </form>
        </aside>

        <div className="ad-main">
          <section className="ad-panel">
            <header className="ad-panel-heading ad-directory-heading">
              <h2><Icon name="layers" size={27} /> Account Directory</h2>
              <div className="ad-directory-actions">
                <Link href={ROUTES.accountRegistration}
                  className="ad-new-button">
                  <Icon name="add" size={20} /> New Account
                </Link>

                <input ref={importInput}
                  className="ad-hidden-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={importCsv} />

                <button type="button" disabled={importing}
                  onClick={() => importInput.current?.click()}>
                  <Icon name="upload_file" size={19} />
                  {importing ? "Importing..." : "Import"}
                </button>

                <button type="button"
                  onClick={exportSelected}
                  disabled={selectedCount === 0}>
                  <Icon name="download" size={19} />
                  Export ({selectedCount})
                </button>

                <button type="button" title="Refresh accounts"
                  onClick={() => setRefreshKey(value => value + 1)}>
                  <Icon name="refresh" size={20} />
                </button>
              </div>
            </header>

            {(error || message) && (
              <div className="ad-message-banner" role="status">
                {error || message}
              </div>
            )}

            <div className="ad-table-scroll">
              <table className="ad-table ad-directory-table">
                <thead>
                  <tr>
                    <th>
                      <input type="checkbox"
                        aria-label="Select all visible accounts"
                        checked={allChecked}
                        onChange={event => setChecked(current => {
                          const next = { ...current };
                          for (const account of visible) {
                            if (event.target.checked) {
                              next[account.accountId] = account;
                            } else {
                              delete next[account.accountId];
                            }
                          }
                          return next;
                        })} />
                    </th>
                    <th>Account No.</th>
                    <th>Client Name</th>
                    <th>Account Type</th>
                    <th>Currency</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Opened On</th>
                    <th>Last Activity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={10}>Loading accounts...</td></tr>
                  ) : visible.length === 0 ? (
                    <tr><td colSpan={10}>No accounts match the filters.</td></tr>
                  ) : visible.map(account => (
                    <tr key={account.accountId}
                      className={selected?.accountId === account.accountId
                        ? "ad-row-active" : ""}
                      onClick={() => setSelectedId(account.accountId)}>
                      <td onClick={event => event.stopPropagation()}>
                        <input type="checkbox"
                          aria-label={`Select ${account.accountNumber}`}
                          checked={Boolean(checked[account.accountId])}
                          onChange={event => setChecked(current => {
                            const next = { ...current };
                            if (event.target.checked) {
                              next[account.accountId] = account;
                            } else {
                              delete next[account.accountId];
                            }
                            return next;
                          })} />
                      </td>
                      <td>
                        <button className="ad-account-number"
                          type="button"
                          onClick={() => setSelectedId(account.accountId)}>
                          {account.accountNumber}
                        </button>
                      </td>
                      <td>
                        <Link href={ROUTES.clientDetails(account.clientId)}
                          onClick={event => event.stopPropagation()}>
                          {account.companyName ?? "View Client"}
                        </Link>
                      </td>
                      <td>{account.accountType}</td>
                      <td>{account.currency}</td>
                      <td className="ad-money">
                        {formatMoney(account.balanceMinor, account.currency)}
                      </td>
                      <td><StatusBadge status={account.status} /></td>
                      <td>{dateText(account.createdAt)}</td>
                      <td>
                        {dateText(
                          (account as Account & {
                            lastActivityAt?: string | null;
                          }).lastActivityAt
                        )}
                      </td>
                      <td onClick={event => event.stopPropagation()}>
                        <div className="ad-row-actions">
                          <button type="button"
                            aria-label="Preview account"
                            onClick={() => setSelectedId(account.accountId)}>
                            <Icon name="visibility" size={19} />
                          </button>
                          <Link href={ROUTES.accountDetails(account.accountId)}
                            aria-label="View account details">
                            <Icon name="open_in_new" size={19} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="ad-table-footer">
              <p>Showing {start}–{end} of {total} accounts</p>

              <div className="ad-pagination">
                {selectedCount > 0 && (
                  <button type="button" onClick={() => setChecked({})}>
                    {selectedCount} selected · Clear
                  </button>
                )}

                <label htmlFor="ad-pagesize">Rows per page:</label>
                <select id="ad-pagesize" value={pageSize}
                  onChange={event => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}>
                  {[8, 10, 20, 50].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>

                <button type="button" disabled={page === 1}
                  onClick={() => setPage(value => value - 1)}>
                  <Icon name="chevron_left" />
                </button>

                {visiblePages.map(value => (
                  <button type="button" key={value}
                    className={value === page ? "active" : ""}
                    onClick={() => setPage(value)}>
                    {value}
                  </button>
                ))}

                {totalPages > 5 && <span>… {totalPages}</span>}

                <button type="button" disabled={page >= totalPages}
                  onClick={() => setPage(value => value + 1)}>
                  <Icon name="chevron_right" />
                </button>
              </div>
            </footer>
          </section>

          {selected && (
            <AccountPreview
              key={selected.accountId}
              account={selected}
              details={details}
              loading={detailsLoading}
            />
          )}
        </div>
      </div>
    </section>
  );
}