"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ClientProfile,
  ClientOperationalReport,
  getClient,
  getClientOperationalReport
} from "@/services/clients";
import { Icon, StatusBadge } from "@/components/ui";
import { ROUTES } from "../../../../config";
import "../client-profile.css";
import ClientTransactionTrend from "@/components/clients/ClientTransactionTrend";

interface Props {
  params: Promise<{ id: string }>;
}

type Tab = "overview" | "accounts" | "transactions" | "contacts" | "activity";

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "accounts", label: "Accounts", icon: "layers" },
  { id: "transactions", label: "Transactions", icon: "swap_horiz" },
  { id: "contacts", label: "Contacts", icon: "groups" },
  { id: "activity", label: "Activity", icon: "schedule" }
];

function dateText(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function dateTimeText(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatNumber(value: number | null | undefined) {
  return value == null ? "—" : value.toLocaleString("en-CA");
}

function formatMinor(value: string | number, currency: string) {
  try {
    const amount = BigInt(value);
    const negative = amount < BigInt(0);
    const absolute = negative ? -amount : amount;
    const major = absolute / BigInt(100);
    const cents = absolute % BigInt(100);

    return `${negative ? "-" : ""}${major.toLocaleString("en-CA")}.${cents
      .toString()
      .padStart(2, "0")} ${currency}`;
  } catch {
    return "—";
  }
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
    <section className="cpd-panel">
      <header className="cpd-panel-heading">
        <h2>
          <Icon name={icon} size={24} />
          {title}
        </h2>
        {action}
      </header>
      <div className="cpd-panel-content">{children}</div>
    </section>
  );
}

function InformationRow({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="cpd-information-row">
      <strong>{label}</strong>
      <span>{children}</span>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="cpd-empty">{message}</div>;
}

function AccountTable({
  client
}: {
  client: ClientProfile;
}) {
  const accounts = client.accounts ?? [];

  return (
    <div className="cpd-table-scroll">
      <table className="cpd-table">
        <thead>
          <tr>
            <th>Account No.</th>
            <th>Type</th>
            <th>Currency</th>
            <th>Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <Empty message="No accounts found for this client." />
              </td>
            </tr>
          ) : accounts.map(account => (
            <tr key={account.accountId}>
              <td>
                <Link href={ROUTES.accountDetails(account.accountId)}>
                  {account.accountNumber}
                </Link>
              </td>
              <td>{account.accountType}</td>
              <td>{account.currency}</td>
              <td>
                {formatMinor(
                  account.balanceMinor,
                  account.currency
                )}
              </td>
              <td><StatusBadge status={account.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Contacts({
  client
}: {
  client: ClientProfile;
}) {
  const contacts = client.contacts ?? [];

  return (
    <div className="cpd-contacts">
      {contacts.length === 0 ? (
        <div className="cpd-contact">
          <Icon name="person" size={26} />
          <div className="cpd-contact-name">
            <strong>Business Contact</strong>
            <span>Primary client information</span>
          </div>
          <div className="cpd-contact-info">
            <a href={`mailto:${client.contactEmail}`}>
              <Icon name="mail" size={16} />
              {client.contactEmail}
            </a>
            <span>
              <Icon name="call" size={16} />
              {client.contactPhone || "Not provided"}
            </span>
          </div>
        </div>
      ) : contacts.map(contact => (
        <div className="cpd-contact" key={contact.id}>
          <Icon name="person" size={26} />
          <div className="cpd-contact-name">
            <strong>{contact.name}</strong>
            <span>
              {contact.role}
              {contact.primary ? " · Primary" : ""}
            </span>
          </div>
          <div className="cpd-contact-info">
            {contact.phone && (
              <a href={`tel:${contact.phone}`}>
                <Icon name="call" size={16} />
                {contact.phone}
              </a>
            )}

            {contact.email && (
              <a href={`mailto:${contact.email}`}>
                <Icon name="mail" size={16} />
                {contact.email}
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TransactionTable({
  report,
  limit
}: {
  report: ClientOperationalReport;
  limit?: number;
}) {
  const transactions = limit
    ? report.recentTransactions.slice(0, limit)
    : report.recentTransactions;

  return (
    <div className="cpd-table-scroll">
      <table className="cpd-table">
        <thead>
          <tr>
            <th>Txn ID</th>
            <th>Date & Time</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <Empty message="No recent transactions." />
              </td>
            </tr>
          ) : transactions.map(transaction => (
            <tr key={transaction.transactionId}>
              <td>
                <Link href={ROUTES.transactionDetails(transaction.transactionId)}>
                  {transaction.referenceNumber}
                </Link>
              </td>
              <td>{dateTimeText(transaction.createdAt)}</td>
              <td>{transaction.transactionType}</td>
              <td>
                {formatMinor(
                  transaction.amountMinor,
                  transaction.currency
                )}
              </td>
              <td><StatusBadge status={transaction.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ActivityItem = {
  id: string;
  date: string;
  label: string;
  tone: "blue" | "green" | "amber";
};

function createActivity(
  client: ClientProfile,
  report: ClientOperationalReport
): ActivityItem[] {
  const transactions: ActivityItem[] = report.recentTransactions.map(t => ({
    id: `transaction-${t.transactionId}`,
    date: t.processedAt ?? t.createdAt,
    label: `Transaction ${t.referenceNumber} — ${t.status} (${formatMinor(
      t.amountMinor,
      t.currency
    )})`,
    tone: t.status === "Completed" ? "green" : "blue"
  }));

  const approvals: ActivityItem[] = report.pendingApprovals.map(a => ({
    id: `approval-${a.workflowId}`,
    date: a.createdAt,
    label: `Approval workflow ${a.status} for ${
      a.transaction?.referenceNumber ?? a.transactionId.slice(0, 8)
    }`,
    tone: "amber"
  }));

  const profileEvent: ActivityItem = {
    id: `profile-${client.clientId}`,
    date: client.updatedAt,
    label: "Client profile last updated",
    tone: "blue"
  };

  return [...transactions, ...approvals, profileEvent]
    .filter(item => !Number.isNaN(new Date(item.date).getTime()))
    .sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
}

function ActivityTimeline({
  items,
  limit
}: {
  items: ActivityItem[];
  limit?: number;
}) {
  const visible = limit ? items.slice(0, limit) : items;

  if (!visible.length) {
    return <Empty message="No recorded activity." />;
  }

  return (
    <div className="cpd-activity">
      {visible.map(item => (
        <div className="cpd-activity-item" key={item.id}>
          <span className={`cpd-activity-dot cpd-dot-${item.tone}`} />
          <time>{dateTimeText(item.date)}</time>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function QuickActions({
  client,
  changeTab
}: {
  client: ClientProfile;
  changeTab: (tab: Tab) => void;
}) {
  const links = [
    {
      label: "Edit Client",
      icon: "edit",
      href: ROUTES.clientEdit(client.clientId)
    },
    {
      label: "New Account",
      icon: "layers",
      href: ROUTES.accountRegistration
    },
    {
      label: "New Transaction",
      icon: "swap_horiz",
      href: ROUTES.transactionCreate
    },
    {
      label: "View Accounts",
      icon: "account_balance",
      tab: "accounts" as Tab
    },
    {
      label: "Add Contact",
      icon: "person_add",
      href: ROUTES.clientEdit(client.clientId)
    },
    {
      label: "View Activity",
      icon: "assignment_turned_in",
      tab: "activity" as Tab
    },
    {
      label: "View Reports",
      icon: "monitoring",
      tab: "transactions" as Tab
    },
    {
      label: "More Actions",
      icon: "more_horiz",
      tab: "contacts" as Tab
    }
  ];

  return (
    <div className="cpd-quick-actions">
      {links.map(item =>
        "href" in item && item.href ? (
          <Link href={item.href} key={item.label}>
            <Icon name={item.icon} size={28} />
            <span>{item.label}</span>
          </Link>
        ) : (
          <button
            type="button"
            key={item.label}
            onClick={() => changeTab(item.tab as Tab)}
          >
            <Icon name={item.icon} size={28} />
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>
  );
}

export default function ClientDetailsPage({ params }: Props) {
  const { id } = use(params);

  const [client, setClient] = useState<ClientProfile | null>(null);
  const [report, setReport] = useState<ClientOperationalReport | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [clientResponse, reportResponse] = await Promise.all([
        getClient(id),
        getClientOperationalReport(id)
      ]);

      setClient(clientResponse);
      setReport(reportResponse.report);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load client details."
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <section className="cpd-page"><Empty message="Loading client details..." /></section>;
  }

  if (error || !client || !report) {
    return (
      <section className="cpd-page">
        <div className="cpd-error" role="alert">
          {error || "Unable to load client details."}
        </div>
        <Link href={ROUTES.clients}>Back to Client Directory</Link>
      </section>
    );
  }

  const activity = createActivity(client, report);
  const accounts = client.accounts ?? [];
  const contacts = client.contacts ?? [];

  const balances = report.balancesByCurrency ?? [];
  const cad = balances.find(b => b.currency === "CAD");
  const usd = balances.find(b => b.currency === "USD");

  const currentYear = new Date().getUTCFullYear();
  const ytdTransactions = report.transactionTrend
    .filter(p => p.month.startsWith(`${currentYear}-`))
    .reduce((sum, p) => sum + p.count, 0);

  const companyProfile = (
    <div className="cpd-profile-info">
      <InformationRow label="Legal Name">
        {client.companyName}
      </InformationRow>
      <InformationRow label="Operating Name">
        {client.operatingName || "—"}
      </InformationRow>
      <InformationRow label="Registration / Tax ID">
        {client.registrationNumber}
      </InformationRow>
      <InformationRow label="Incorporation Date">
        {dateText(client.incorporationDate)}
      </InformationRow>
      <InformationRow label="Organization Size">
        {client.organizationSize || "—"}
      </InformationRow>
      <InformationRow label="Head Office">
        {[
          client.businessAddress,
          client.city,
          client.provinceState,
          client.postalCode,
          client.country
        ].filter(Boolean).join(", ") || "—"}
      </InformationRow>
    </div>
  );

  return (
    <section className="cpd-page">
      <header className="cpd-client-banner">
        <div className="cpd-client-avatar">
          <Icon
            name={client.clientType === "Individual" ? "person" : "domain"}
            size={75}
          />
        </div>

        <div className="cpd-client-identity">
          <div className="cpd-client-name">
            <h1>{client.companyName}</h1>
            <StatusBadge status={client.status} />
          </div>

          <p>
            <Icon name="groups" size={18} />
            Client ID: {client.clientId}
            <span className="cpd-separator">|</span>
            Type: {client.clientType ?? "Unclassified"}
          </p>

          <p>
            <Icon name="business_center" size={18} />
            Industry: {client.industry}
            <span className="cpd-separator">|</span>
            Country: {client.country}
          </p>
        </div>

        <div className="cpd-banner-metrics">
          <div>
            <Icon name="layers" size={31} />
            <strong>{formatNumber(report.accountCount)}</strong>
            <span>Accounts</span>
          </div>

          <div>
            <Icon name="swap_horiz" size={31} />
            <strong>{formatNumber(ytdTransactions)}</strong>
            <span>YTD Transactions (available 6 months)</span>
          </div>

          <div>
            <Icon name="database" size={31} />
            <strong>{cad ? formatMinor(cad.balanceMinor, "CAD") : "—"}</strong>
            <span>CAD Account Balances</span>
            {usd && <small>{formatMinor(usd.balanceMinor, "USD")}</small>}
          </div>
        </div>
      </header>

      <div className="cpd-toolbar">
        <nav className="cpd-tabs" aria-label="Client details tabs">
          {tabs.map(item => (
            <button
              type="button"
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
            >
              <Icon name={item.icon} size={24} />
              <span>
                {item.id === "accounts"
                  ? `Accounts (${accounts.length})`
                  : item.id === "contacts"
                    ? `Contacts (${contacts.length})`
                    : item.label}
              </span>
            </button>
          ))}
        </nav>

        <Link href={ROUTES.clientEdit(client.clientId)} className="cpd-edit-button">
          <Icon name="edit" size={20} /> Edit Client
        </Link>
      </div>

      {tab === "overview" && (
        <div className="cpd-overview-grid">
          <Panel title="Company Profile" icon="apartment">
            {companyProfile}
          </Panel>

          <Panel title={`Accounts (${accounts.length})`} icon="layers">
            <AccountTable client={client} />
          </Panel>

          <Panel
            title="Primary Contacts"
            icon="groups"
            action={
              <Link href={ROUTES.clientEdit(client.clientId)}
                className="cpd-panel-action">
                <Icon name="add" size={17} /> Add Contact
              </Link>
            }
          >
            <Contacts client={client} />
          </Panel>

          <Panel title="Transaction Trend (Last 6 Months)" icon="monitoring">
            <ClientTransactionTrend report={report} currency="CAD" />
          </Panel>

          <div className="cpd-bottom-grid">
            <Panel
              title="Recent Transactions"
              icon="swap_horiz"
              action={
                <button
                  type="button"
                  onClick={() => setTab("transactions")}
                  className="cpd-view-all"
                >
                  View All <Icon name="arrow_forward" size={17} />
                </button>
              }
            >
              <TransactionTable report={report} limit={5} />
            </Panel>

            <Panel
              title="Recent Activity"
              icon="schedule"
              action={
                <button
                  type="button"
                  onClick={() => setTab("activity")}
                  className="cpd-view-all"
                >
                  View All <Icon name="arrow_forward" size={17} />
                </button>
              }
            >
              <ActivityTimeline items={activity} limit={4} />
            </Panel>

            <Panel title="Quick Actions" icon="bolt">
              <QuickActions client={client} changeTab={setTab} />
            </Panel>
          </div>
        </div>
      )}

      {tab === "accounts" && (
        <Panel
          title={`Accounts (${accounts.length})`}
          icon="layers"
          action={
            <Link href={ROUTES.accountRegistration} className="cpd-panel-action">
              <Icon name="add" size={18} /> New Account
            </Link>
          }
        >
          <AccountTable client={client} />
        </Panel>
      )}

      {tab === "transactions" && (
        <div className="cpd-single-tab">
          <Panel title="Transaction Trend (Last 6 Months)" icon="monitoring">
            <ClientTransactionTrend report={report} currency="CAD" />
          </Panel>

          <Panel
            title="Recent Client Transactions"
            icon="swap_horiz"
            action={
              <Link href={ROUTES.transactions} className="cpd-view-all">
                Open Transactions <Icon name="arrow_forward" size={17} />
              </Link>
            }
          >
            <TransactionTable report={report} />
          </Panel>
        </div>
      )}

      {tab === "contacts" && (
        <Panel
          title={`Contacts (${contacts.length})`}
          icon="groups"
          action={
            <Link href={ROUTES.clientEdit(client.clientId)}
              className="cpd-panel-action">
              <Icon name="add" size={17} /> Add Contact
            </Link>
          }
        >
          <Contacts client={client} />
        </Panel>
      )}

      {tab === "activity" && (
        <Panel
          title="Client Activity"
          icon="schedule"
          action={
            <button type="button" onClick={() => void load()}
              className="cpd-view-all">
              <Icon name="refresh" size={18} /> Refresh
            </button>
          }
        >
          <ActivityTimeline items={activity} />
        </Panel>
      )}
    </section>
  );
}