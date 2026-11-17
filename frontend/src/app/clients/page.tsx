"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PAGINATION, ROUTES } from "../../../config";
import ClientTransactionTrend from "@/components/clients/ClientTransactionTrend";
import {
  Client,
  ClientProfile,
  ClientListResult,
  ClientOptions,
  ClientDirectoryMetrics,
  ClientOperationalReport,
  ClientInput,
  ClientRiskLevel,
  ClientWithRisk,
  getClients,
  getClient,
  getClientOptions,
  getClientDirectoryMetrics,
  getClientOperationalReport,
  getClientsFilteredByRisk,
  deriveClientRiskLevel,
  parseClientCsv,
  registerClient
} from "@/services/clients";

import { Icon, StatusBadge } from "@/components/ui";
import "./clients.css";

type ProfileTab =
  | "overview"
  | "accounts"
  | "transactions"
  | "risk"
  | "approvals"
  | "documents"
  | "contacts";

const tabItems: {
  id: ProfileTab;
  label: string;
  icon: string;
}[] = [
    { id: "overview", label: "Overview", icon: "domain" },
    { id: "accounts", label: "Accounts", icon: "layers" },
    { id: "transactions", label: "Transactions", icon: "swap_horiz" },
    { id: "risk", label: "Risk Profile", icon: "shield" },
    { id: "approvals", label: "Approvals", icon: "assignment_turned_in" },
    { id: "documents", label: "Documents", icon: "description" },
    { id: "contacts", label: "Contacts", icon: "groups" }
  ];

const formatNumber = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("en-CA");

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-CA", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
};

function StatCard({
  label,
  value,
  subtitle,
  icon,
  tone
}: {
  label: string;
  value: number | null;
  subtitle: string;
  icon: string;
  tone: string;
}) {
  return (
    <article className={`cd-stat cd-stat-${tone}`}>
      <Icon name={icon} size={36} />
      <div className="cd-stat-info">
        <span>{label}</span>
        <div className="cd-stat-value">
          <strong>{formatNumber(value)}</strong>
          {subtitle && <small>{subtitle}</small>}
        </div>
      </div>
    </article>
  );
}

function Detail({
  icon,
  label,
  children
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="cd-detail-row">
      <Icon name={icon} size={19} />
      <span>
        <strong>{label}:</strong> {children}
      </span>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
  tone
}: {
  label: string;
  value: string;
  icon: string;
  tone: string;
}) {
  return (
    <div className={`cd-mini-stat cd-mini-${tone}`}>
      <Icon name={icon} size={28} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function Placeholder({
  title,
  description,
  href,
  linkText
}: {
  title: string;
  description: string;
  href?: string;
  linkText?: string;
}) {
  return (
    <div className="cd-placeholder">
      <Icon name="info" size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
      {href && (
        <Link href={href} className="cd-secondary-button">
          {linkText ?? "Open Module"}
          <Icon name="arrow_forward" size={17} />
        </Link>
      )}
    </div>
  );
}

function ClientRiskSummary({
  report
}: {
  report: ClientOperationalReport | null;
}) {
  if (!report) {
    return <p className="cd-unavailable">Risk data unavailable.</p>;
  }

  return (
    <div className="cd-risk-summary">
      <div className="cd-risk-summary-row">
        <span>Latest Assessment</span>
        <strong>
          {report.latestRisk
            ? `${report.latestRisk.riskLevel} (${report.latestRisk.riskScore})`
            : "Not assessed"}
        </strong>
      </div>

      {report.riskDistribution.map(item => (
        <div className="cd-risk-summary-row" key={item.level}>
          <span>{item.level} Transactions</span>
          <strong>{item.count}</strong>
        </div>
      ))}

      {report.latestRisk && (
        <Link
          href={ROUTES.riskAssessmentDetails(
            report.latestRisk.assessmentId
          )}
          className="cd-insight-link"
        >
          View Latest Risk Assessment
          <Icon name="arrow_forward" size={17} />
        </Link>
      )}
    </div>
  );
}

function ClientPendingActions({
  report
}: {
  report: ClientOperationalReport | null;
}) {
  if (!report) {
    return <p className="cd-unavailable">Approvals unavailable.</p>;
  }

  if (report.pendingApprovals.length === 0) {
    return (
      <p className="cd-unavailable">
        No pending approval workflows.
      </p>
    );
  }

  return (
    <div className="cd-pending-actions">
      {report.pendingApprovals.slice(0, 5).map(item => (
        <Link
          key={item.workflowId}
          href={ROUTES.approvalDetails(item.workflowId)}
          className="cd-pending-row"
        >
          <Icon name="hourglass_top" size={20} />

          <span>
            {item.transaction?.referenceNumber ??
              item.transactionId.slice(0, 8)}
          </span>

          <StatusBadge status={item.status} />

          <Icon name="chevron_right" size={18} />
        </Link>
      ))}
    </div>
  );
}

function SelectedClientProfile({
  client,
  profile,
  loading,
  error,
  report
}: {
  client: Client;
  profile: ClientProfile | null;
  loading: boolean;
  error: string;
  report: ClientOperationalReport | null;
}) {
  const [tab, setTab] = useState<ProfileTab>("overview");

  useEffect(() => {
    setTab("overview");
  }, [client.clientId]);

  const accounts = profile?.accounts ?? [];
  const hasAccounts = profile !== null;
  const displayName = client.companyName;

  return (
    <section className="cd-profile">
      <header className="cd-profile-header">
        <div className="cd-profile-title">
          <Icon name="domain" size={31} />
          <div>
            <div className="cd-profile-name">
              <h2>{displayName}</h2>
              <StatusBadge status={client.status} />
            </div>
            <p>Client ID: {client.clientId}</p>
          </div>
        </div>

        <nav className="cd-profile-tabs" aria-label="Client profile sections">
          {tabItems.map(item => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {loading && (
        <div className="cd-profile-notice" role="status">
          Loading selected client details...
        </div>
      )}

      {error && (
        <div className="cd-profile-notice cd-error" role="alert">
          {error}
        </div>
      )}

      {tab === "overview" && (
        <div className="cd-overview">
          <div className="cd-client-info">
            <Detail icon="business" label="Industry">
              {client.industry}
            </Detail>

            <Detail icon="public" label="Country">
              {client.country}
            </Detail>

            <Detail icon="badge" label="Registration">
              {client.registrationNumber}
            </Detail>

            <Detail icon="calendar_month" label="Since">
              {formatDate(client.createdAt)}
            </Detail>

            <Detail icon="update" label="Updated">
              {formatDate(client.updatedAt)}
            </Detail>

            <Detail icon="call" label="Phone">
              {client.contactPhone || "Not provided"}
            </Detail>

            <Detail icon="mail" label="Email">
              <a href={`mailto:${client.contactEmail}`}>
                {client.contactEmail}
              </a>
            </Detail>

            <Detail icon="person" label="Relationship Manager">
              Not assigned
            </Detail>
          </div>

          <div className="cd-overview-right">
            <div className="cd-mini-stats">

              <MiniStat
                label="Total Accounts"
                value={report ? formatNumber(report.accountCount) : "—"}
                icon="layers"
                tone="blue"
              />

              <MiniStat
                label="Account Balances"
                value={
                  report
                    ? report.balancesByCurrency
                      .map(item =>
                        `${item.currency} ${(
                          Number(item.balanceMinor) / 100
                        ).toLocaleString("en-CA", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}`
                      )
                      .join(" / ") || "—"
                    : "—"
                }
                icon="account_balance"
                tone="green"
              />

              <MiniStat
                label="Transactions"
                value={report ? formatNumber(report.transactionCount) : "—"}
                icon="swap_horiz"
                tone="purple"
              />

              <MiniStat
                label="Latest Risk Assessment"
                value={
                  report?.latestRisk
                    ? `${report.latestRisk.riskLevel} (${report.latestRisk.riskScore})`
                    : "Not assessed"
                }
                icon="warning"
                tone="red"
              />

            </div>

            <div className="cd-insight-grid">
              <div className="cd-insight">
                <h3>
                  <Icon name="monitoring" size={20} />
                  Transaction Trend (Last 6 Months)
                </h3>

                <ClientTransactionTrend report={report} currency="CAD" />
              </div>

              <div className="cd-insight">
                <h3>
                  <Icon name="shield" size={20} />
                  Risk Summary
                </h3>

                <ClientRiskSummary report={report} />
              </div>

              <div className="cd-insight">
                <h3>
                  <Icon name="assignment_turned_in" size={20} />
                  Pending Actions
                </h3>

                <ClientPendingActions report={report} />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "accounts" && (
        <div className="cd-tab-content">
          <div className="cd-tab-heading">
            <h3>Linked Accounts</h3>
            <span>{formatNumber(client.accountCount)} accounts</span>
          </div>

          {hasAccounts ? (
            accounts.length > 0 ? (
              <div className="cd-inner-table-scroll">
                <table className="cd-inner-table">
                  <thead>
                    <tr>
                      <th>Account Number</th>
                      <th>Type</th>
                      <th>Currency</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map(account => (
                      <tr key={account.accountId}>
                        <td>{account.accountNumber}</td>
                        <td>{account.accountType}</td>
                        <td>{account.currency}</td>
                        <td>
                          <StatusBadge status={account.status} />
                        </td>
                        <td>
                          <Link href={ROUTES.accountDetails(account.accountId)}>
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Placeholder
                title="No accounts found"
                description="This client has no linked accounts."
              />
            )
          ) : (
            <p className="cd-profile-notice">
              Account information is unavailable.
            </p>
          )}
        </div>
      )}

      {tab === "transactions" && (
        <Placeholder
          title="Client Transactions"
          description="The transaction list is available through the Transactions module. Client-scoped transaction reporting has not yet been connected here."
          href={ROUTES.transactions}
          linkText="Open Transactions"
        />
      )}

      {tab === "risk" && (
        <Placeholder
          title="Risk Profile"
          description="Risk assessments are recorded against transactions. A client-level risk aggregation is needed to display the score breakdown in the mockup."
          href={ROUTES.riskAssessments}
          linkText="Open Risk Management"
        />
      )}

      {tab === "approvals" && (
        <Placeholder
          title="Client Approvals"
          description="Approval workflows must be joined to the selected client's transactions before they can be shown here."
          href={ROUTES.approvalsQueue}
          linkText="Open Approval Queue"
        />
      )}

      {tab === "documents" && (
        <Placeholder
          title="Client Documents"
          description="No client document-management API is currently connected to this profile. No document counts or expiry dates are assumed."
        />
      )}

      {tab === "contacts" && (
        <div className="cd-tab-content">
          <h3>Primary Contact</h3>
          <div className="cd-contact-card">
            <Detail icon="domain" label="Client">
              {client.companyName}
            </Detail>
            <Detail icon="mail" label="Email">
              <a href={`mailto:${client.contactEmail}`}>
                {client.contactEmail}
              </a>
            </Detail>
            <Detail icon="call" label="Telephone">
              {client.contactPhone || "Not provided"}
            </Detail>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ClientsPage() {
  const [result, setResult] = useState<ClientListResult | null>(null);
  const [options, setOptions] = useState<ClientOptions | null>(null);
  const [statistics, setStatistics] =
    useState<ClientDirectoryMetrics | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState("");

  const [clientType, setClientType] = useState("");
  const [relationshipManager, setRelationshipManager] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(8);

  const [selectedClientId, setSelectedClientId] =
    useState<string | null>(null);


  const [selectedClients, setSelectedClients] =
    useState<Record<string, Client>>({});

  const [riskLevels, setRiskLevels] =
    useState<ClientRiskLevel[]>([]);

  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");

  const importInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [operationalReport, setOperationalReport] =
    useState<ClientOperationalReport | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getClientOptions().then(data => {
      if (active) setOptions(data);
    }).catch(() => {
      if (active) setOptions(null);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    getClientDirectoryMetrics().then(data => {
      if (active) setStatistics(data);
    }).catch(() => {
      if (active) setStatistics(null);
    });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const filters = {
          search,
          industry,
          country,
          status,
          clientType,
          relationshipManager,
          dateFrom,
          dateTo,
          page,
          pageSize
        };

        const data = riskLevels.length > 0
          ? await getClientsFilteredByRisk(filters, riskLevels)
          : await getClients(filters);

        if (!active) return;

        setResult(data);

        setSelectedClientId(current =>
          data.data.some(client => client.clientId === current)
            ? current
            : data.data[0]?.clientId ?? null
        );
      } catch (err) {
        if (!active) return;

        setResult(null);
        setSelectedClientId(null);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load clients."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [
    search,
    industry,
    country,
    status,
    clientType,
    relationshipManager,
    dateFrom,
    dateTo,
    riskLevels,
    page,
    pageSize,
    refreshKey
  ]);

  useEffect(() => {
    if (!selectedClientId) {
      setProfile(null);
      setProfileError("");
      setProfileLoading(false);
      return;
    }

    let active = true;
    setProfile(null);
    setProfileLoading(true);
    setProfileError("");

    getClient(selectedClientId)
      .then(data => {
        if (active) setProfile(data);
      })
      .catch(err => {
        if (active) {
          setProfileError(
            err instanceof Error
              ? err.message
              : "Unable to load client profile."
          );
        }
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedClientId, refreshKey]);

  useEffect(() => {
    if (!selectedClientId) {
      setOperationalReport(null);
      return;
    }

    let active = true;
    setOperationalReport(null);

    getClientOperationalReport(selectedClientId)
      .then(result => {
        if (active) {
          setOperationalReport(result.report);
        }
      })
      .catch(() => {
        if (active) {
          setOperationalReport(null);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedClientId, refreshKey]);

  function applyFilters() {
    setSearch(searchInput.trim());
    setPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setIndustry("");
    setCountry("");
    setStatus("");
    setClientType("");
    setRelationshipManager("");
    setDateFrom("");
    setDateTo("");
    setRiskLevels([]);
    setPage(1);
    setTransferMessage("");
  }

  function exportSelectedClients() {
    const rows = Object.values(selectedClients);

    if (rows.length === 0) {
      setTransferMessage("Select at least one client to export.");
      return;
    }

    setExporting(true);
    setTransferMessage("");

    try {
      const headers = [
        "Client ID",
        "Client Name",
        "Registration Number",
        "Client Type",
        "Industry",
        "Country",
        "Relationship Manager",
        "Status",
        "Contact Email",
        "Contact Phone",
        "Created At",
        "Next Review"
      ];

      const records = rows.map(client => [
        client.clientId,
        client.companyName,
        client.registrationNumber,
        client.clientType ?? "",
        client.industry,
        client.country,
        client.relationshipManager ?? "",
        client.status,
        client.contactEmail,
        client.contactPhone,
        client.createdAt ?? "",
        client.nextReviewAt ?? ""
      ]);

      const csvCell = (value: string) => {
        let text = value;

        if (/^[=+\-@\t\r]/.test(text)) {
          text = `'${text}`;
        }

        return `"${text.replaceAll('"', '""')}"`;
      };

      const csv = [headers, ...records]
        .map(row => row.map(csvCell).join(","))
        .join("\r\n");

      const blob = new Blob(
        ["\uFEFF", csv],
        { type: "text/csv;charset=utf-8" }
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `finops-selected-clients-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);

      setTransferMessage(
        `Exported ${rows.length} selected client(s).`
      );
    } catch (error) {
      setTransferMessage(
        error instanceof Error
          ? error.message
          : "Unable to export selected clients."
      );
    } finally {
      setExporting(false);
    }
  }


  async function importClientsFromCsv(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    event.target.value = "";
    setTransferMessage("");

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setTransferMessage("Please select a CSV file.");
      return;
    }

    if (file.size > 1024 * 1024) {
      setTransferMessage("CSV file must be smaller than 1 MB.");
      return;
    }

    setImporting(true);

    try {
      const contents = await file.text();
      const parsed = parseClientCsv(contents);

      if (parsed.length < 2) {
        throw new Error("CSV does not contain client records.");
      }

      const normalize = (value: string) =>
        value.trim().toLowerCase().replace(/[\s_-]/g, "");

      const headers = parsed[0].map(normalize);
      const records = parsed.slice(1);

      const required = [
        "companyName",
        "registrationNumber",
        "industry",
        "country",
        "contactEmail",
        "contactPhone"
      ];

      const aliases: Record<string, string[]> = {
        companyName: ["companyname", "clientname", "name"],
        registrationNumber: ["registrationnumber"],
        industry: ["industry"],
        country: ["country"],
        contactEmail: ["contactemail", "email"],
        contactPhone: ["contactphone", "phone", "telephone"],
        clientType: ["clienttype", "type"],
        relationshipManager: ["relationshipmanager"],
        nextReviewAt: ["nextreviewat", "nextreview"]
      };

      const indexOf = (field: string) =>
        headers.findIndex(header =>
          aliases[field]?.includes(header)
        );

      const missing = required.filter(field => indexOf(field) < 0);

      if (missing.length > 0) {
        throw new Error(
          `Missing CSV columns: ${missing.join(", ")}`
        );
      }

      if (records.length > 100) {
        throw new Error(
          "Maximum 100 clients per import. Split the CSV into smaller files."
        );
      }

      const get = (row: string[], field: string) => {
        const index = indexOf(field);
        return index < 0 ? "" : (row[index] ?? "").trim();
      };

      const clientsToImport: ClientInput[] = records.map((row, index) => {
        const rawType = get(row, "clientType");

        if (
          rawType &&
          rawType !== "Corporate" &&
          rawType !== "Individual"
        ) {
          throw new Error(
            `Row ${index + 2}: invalid client type "${rawType}".`
          );
        }

        return {
          companyName: get(row, "companyName"),
          registrationNumber: get(row, "registrationNumber"),
          industry: get(row, "industry"),
          country: get(row, "country"),
          contactEmail: get(row, "contactEmail"),
          contactPhone: get(row, "contactPhone"),
          clientType: (rawType ||
            "Corporate") as "Corporate" | "Individual",
          relationshipManager:
            get(row, "relationshipManager") || null,
          nextReviewAt: get(row, "nextReviewAt") || null
        };
      });

      const normalizedRegistrations = new Set<string>();

      for (let i = 0; i < clientsToImport.length; i++) {
        const client = clientsToImport[i];
        const registration = client.registrationNumber
          .replace(/[\s-]/g, "")
          .toUpperCase();

        if (
          !client.companyName ||
          !client.registrationNumber ||
          !client.industry ||
          !client.country ||
          !client.contactEmail ||
          !client.contactPhone
        ) {
          throw new Error(
            `Row ${i + 2}: required client fields cannot be empty.`
          );
        }

        if (normalizedRegistrations.has(registration)) {
          throw new Error(
            `Row ${i + 2}: duplicate registration number in CSV.`
          );
        }

        normalizedRegistrations.add(registration);
      }

      const confirmed = window.confirm(
        `Import ${clientsToImport.length} client(s)? ` +
        "This creates new database records. Existing clients will not be overwritten."
      );

      if (!confirmed) {
        setTransferMessage("Import cancelled.");
        return;
      }

      let imported = 0;
      const failed: string[] = [];

      for (let index = 0; index < clientsToImport.length; index++) {
        try {
          await registerClient(clientsToImport[index]);
          imported++;
        } catch (error) {
          failed.push(
            `Row ${index + 2}: ${error instanceof Error ? error.message : "Import failed"
            }`
          );
        }

        setTransferMessage(
          `Importing clients: ${index + 1}/${clientsToImport.length}`
        );
      }

      setTransferMessage(
        `${imported} client(s) imported. ${failed.length} failed.` +
        (failed.length ? ` ${failed.slice(0, 5).join(" | ")}` : "")
      );

      setRefreshKey(current => current + 1);
      setPage(1);
    } catch (error) {
      setTransferMessage(
        error instanceof Error
          ? error.message
          : "Unable to import CSV."
      );
    } finally {
      setImporting(false);
    }
  }

  const clients = result?.data ?? [];

  const selectedClient =
    clients.find(c => c.clientId === selectedClientId) ?? null;

  const total = result?.pagination.total ?? 0;
  const totalPages = result?.pagination.totalPages ?? 0;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const visiblePages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => {
      const first = Math.max(
        1,
        Math.min(page - 2, totalPages - 4)
      );
      return first + index;
    }
  );

  const allChecked =
    clients.length > 0 &&
    clients.every(client => Boolean(selectedClients[client.clientId]));

  const selectedCount = Object.keys(selectedClients).length;

  const activePercentage =
    statistics && statistics.totalClients > 0
      ? (statistics.activeClients / statistics.totalClients) * 100
      : null;

  return (
    <section className="cd-page">

      <div className="cd-stats">
        <StatCard
          label="Total Clients"
          value={statistics?.totalClients ?? null}
          subtitle="All registered clients"
          icon="groups"
          tone="blue"
        />

        <StatCard
          label="Active Clients"
          value={statistics?.activeClients ?? null}
          subtitle={
            statistics && statistics.totalClients > 0
              ? `${(
                statistics.activeClients /
                statistics.totalClients * 100
              ).toFixed(1)}% of total`
              : "—"
          }
          icon="sync"
          tone="green"
        />

        <StatCard
          label="Corporate"
          value={statistics?.corporateClients ?? null}
          subtitle="Corporate clients"
          icon="apartment"
          tone="amber"
        />

        <StatCard
          label="Individual"
          value={statistics?.individualClients ?? null}
          subtitle="Individual clients"
          icon="person"
          tone="purple"
        />

        <StatCard
          label="High-Risk Clients"
          value={statistics?.highRiskClients ?? null}
          subtitle="High or critical transactions"
          icon="warning"
          tone="red"
        />

        <StatCard
          label="New (30 Days)"
          value={statistics?.newClients30Days ?? null}
          subtitle="Recent registrations"
          icon="calendar_month"
          tone="royal"
        />
      </div>


      <div className="cd-directory-layout">
        <aside className="cd-filters">
          <div className="cd-panel-title">
            <h2>
              <Icon name="filter_alt" size={25} />
              Filters
            </h2>

            <button type="button" onClick={clearFilters}>
              Clear All
            </button>
          </div>

          <div className="cd-filter-content">
            <label className="cd-search-field">
              <Icon name="search" size={19} />
              <input
                type="search"
                placeholder="Client name, ID or registration..."
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter") applyFilters();
                }}
              />
            </label>


            <fieldset className="cd-filter-group">
              <legend>Client Type</legend>

              {["Corporate", "Individual"].map(type => (
                <label className="cd-filter-checkbox" key={type}>
                  <input
                    type="checkbox"
                    checked={clientType === type}
                    onChange={event => {
                      setClientType(event.target.checked ? type : "");
                      setPage(1);
                    }}
                  />
                  {type}
                </label>
              ))}
            </fieldset>


            <div className="cd-filter-group">
              <label htmlFor="cd-status">Status</label>

              <select
                id="cd-status"
                value={status}
                onChange={event => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Statuses</option>
                {(options?.statuses ?? []).map(item => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>


            <fieldset className="cd-filter-group">
              <legend>Risk Level</legend>

              {(["Low", "Medium", "High", "Critical", "Not Assessed"] as ClientRiskLevel[])
                .map(level => (
                  <label className="cd-filter-checkbox" key={level}>
                    <input
                      type="checkbox"
                      checked={riskLevels.includes(level)}
                      onChange={event => {
                        setRiskLevels(current =>
                          event.target.checked
                            ? [...current, level]
                            : current.filter(item => item !== level)
                        );
                        setPage(1);
                      }}
                    />
                    {level}
                  </label>
                ))}
            </fieldset>


            <div className="cd-filter-group">
              <label htmlFor="cd-country">Country</label>

              <select
                id="cd-country"
                value={country}
                onChange={event => {
                  setCountry(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Countries</option>
                {(options?.countries ?? []).map(item => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="cd-filter-group">
              <label htmlFor="cd-industry">Industry</label>

              <select
                id="cd-industry"
                value={industry}
                onChange={event => {
                  setIndustry(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Industries</option>
                {(options?.industries ?? []).map(item => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>


            <div className="cd-filter-group">
              <label htmlFor="cd-manager">Relationship Manager</label>

              <input
                id="cd-manager"
                type="text"
                placeholder="Manager name"
                value={relationshipManager}
                onChange={event => setRelationshipManager(event.target.value)}
              />
            </div>



            <fieldset className="cd-filter-group">
              <legend>Registration Date</legend>

              <label htmlFor="cd-date-from">From</label>
              <input
                id="cd-date-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={event => {
                  setDateFrom(event.target.value);
                  setPage(1);
                }}
              />

              <label htmlFor="cd-date-to">To</label>
              <input
                id="cd-date-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={event => {
                  setDateTo(event.target.value);
                  setPage(1);
                }}
              />
            </fieldset>


            <button
              type="button"
              className="cd-apply-button"
              onClick={applyFilters}
              disabled={loading}
            >
              <Icon name="search" size={21} />
              Apply Filters
            </button>
          </div>
        </aside>

        <div className="cd-main">
          <section className="cd-table-panel">
            <header className="cd-table-header">
              <h2>
                <Icon name="groups" size={29} />
                Client Directory
              </h2>


              <div className="cd-toolbar-actions">
                <Link
                  href={ROUTES.clientRegistration}
                  className="cd-primary-button"
                >
                  <Icon name="add" size={20} />
                  New Client
                </Link>

                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="cd-file-input"
                  aria-label="Import clients from CSV"
                  onChange={importClientsFromCsv}
                />

                <button
                  type="button"
                  className="cd-secondary-button"
                  disabled={importing}
                  onClick={() => importInputRef.current?.click()}
                >
                  <Icon name="upload_file" size={20} />
                  {importing ? "Importing..." : "Import"}
                </button>

                <button
                  type="button"
                  className="cd-secondary-button"
                  onClick={exportSelectedClients}
                  disabled={exporting || selectedCount === 0}
                  title={`Export ${selectedCount} selected clients`}
                >
                  <Icon name="download" size={20} />
                  Export ({selectedCount})
                </button>

                <button
                  type="button"
                  className="cd-icon-button"
                  onClick={() => setRefreshKey(current => current + 1)}
                  aria-label="Refresh clients"
                  title="Refresh"
                  disabled={loading || importing}
                >
                  <Icon name="refresh" size={21} />
                </button>
              </div>

            </header>

            {transferMessage && (
              <div className="cd-transfer-message" role="status">
                <Icon name="info" size={19} />
                <span>{transferMessage}</span>
                <button
                  type="button"
                  aria-label="Dismiss message"
                  onClick={() => setTransferMessage("")}
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
            )}

            <div className="cd-table-scroll">
              <table className="cd-table">
                <thead>
                  <tr>
                    <th>

                      <input
                        type="checkbox"
                        checked={allChecked}
                        aria-label="Select all clients on this page"
                        onChange={event => {
                          setSelectedClients(current => {
                            const next = { ...current };

                            for (const client of clients) {
                              if (event.target.checked) {
                                next[client.clientId] = client;
                              } else {
                                delete next[client.clientId];
                              }
                            }

                            return next;
                          });
                        }}
                      />

                    </th>
                    <th>Client ID</th>
                    <th>Client Name</th>
                    <th>Type</th>
                    <th>Industry</th>
                    <th>Relationship Manager</th>
                    <th>Risk Level</th>
                    <th>Accounts</th>
                    <th>Total Exposure</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="cd-table-message">
                        Loading clients...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={11} className="cd-table-message cd-error">
                        {error}
                      </td>
                    </tr>
                  ) : clients.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="cd-table-message">
                        No clients match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    clients.map(client => (
                      <tr
                        key={client.clientId}
                        className={
                          selectedClientId === client.clientId
                            ? "cd-selected-row"
                            : ""
                        }
                        onClick={() =>
                          setSelectedClientId(client.clientId)
                        }
                      >
                        <td onClick={event => event.stopPropagation()}>

                          <input
                            type="checkbox"
                            aria-label={`Select ${client.companyName}`}
                            checked={Boolean(selectedClients[client.clientId])}
                            onChange={event => {
                              setSelectedClients(current => {
                                const next = { ...current };

                                if (event.target.checked) {
                                  next[client.clientId] = client;
                                } else {
                                  delete next[client.clientId];
                                }

                                return next;
                              });
                            }}
                          />

                        </td>

                        <td>
                          <button
                            className="cd-client-link"
                            type="button"
                            onClick={() =>
                              setSelectedClientId(client.clientId)
                            }
                          >
                            {client.clientId.slice(0, 8)}
                          </button>
                        </td>

                        <td className="cd-name">
                          {client.companyName}
                        </td>


                        <td>{client.clientType ?? "Unclassified"}</td>

                        <td>{client.industry}</td>

                        <td>{client.relationshipManager ?? "Unassigned"}</td>


                        <td>
                          {(() => {
                            const riskLevel =
                              (client as ClientWithRisk).derivedRiskLevel ??
                              (client.clientId === selectedClientId && operationalReport
                                ? deriveClientRiskLevel(operationalReport)
                                : null);

                            return riskLevel
                              ? <StatusBadge status={riskLevel} />
                              : <span className="cd-muted">—</span>;
                          })()}
                        </td>



                        <td className="cd-numeric">
                          {formatNumber(client.accountCount)}
                        </td>

                        <td className="cd-muted">—</td>

                        <td>
                          <StatusBadge status={client.status} />
                        </td>

                        <td>
                          <div
                            className="cd-row-actions"
                            onClick={event => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              title="Preview client"
                              aria-label={`Preview ${client.companyName}`}
                              onClick={() =>
                                setSelectedClientId(client.clientId)
                              }
                            >
                              <Icon name="visibility" size={20} />
                            </button>

                            <Link
                              href={ROUTES.clientEdit(client.clientId)}
                              title="Edit client"
                              aria-label={`Edit ${client.companyName}`}
                            >
                              <Icon name="edit" size={20} />
                            </Link>

                            <Link
                              href={ROUTES.clientDetails(client.clientId)}
                              title="Client details"
                              aria-label={`View ${client.companyName} details`}
                            >
                              <Icon name="more_vert" size={20} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <footer className="cd-table-footer">
              <p>
                Showing {formatNumber(start)} – {formatNumber(end)} of{" "}
                {formatNumber(total)} clients
              </p>

              <div className="cd-selection-summary">
                <strong>{selectedCount} selected</strong>

                {selectedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedClients({})}
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              <div className="cd-pagination">
                <label htmlFor="cd-page-size">Rows per page:</label>

                <select
                  id="cd-page-size"
                  value={pageSize}
                  onChange={event => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  {Array.from(
                    new Set([8, ...PAGINATION.PAGE_SIZE_OPTIONS])
                  ).sort((a, b) => a - b).map(size => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(n => n - 1)}
                >
                  <Icon name="chevron_left" size={23} />
                </button>

                {visiblePages.map(value => (
                  <button
                    type="button"
                    key={value}
                    className={page === value ? "active" : ""}
                    onClick={() => setPage(value)}
                    disabled={loading}
                    aria-current={page === value ? "page" : undefined}
                  >
                    {value}
                  </button>
                ))}

                {totalPages > 5 && (
                  <span>… {totalPages}</span>
                )}

                <button
                  type="button"
                  aria-label="Next page"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage(n => n + 1)}
                >
                  <Icon name="chevron_right" size={23} />
                </button>
              </div>
            </footer>
          </section>

          {selectedClient ? (
            <SelectedClientProfile
              client={selectedClient}
              profile={profile}
              report={operationalReport}
              loading={profileLoading}
              error={profileError}
            />
          ) : (
            <section className="cd-profile cd-empty-profile">
              Select a client to view their profile.
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
