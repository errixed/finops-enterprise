
"use client";
import {
    useEffect,
    useMemo,
    useState
} from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import {
    getApprovalPolicies,
    getApprovalPolicyDetails,
    type ManagedApprovalPolicy,
    type PolicyDetailsResult,
    type PolicyListResult
} from "@/services/approval-policy-management";
import "./approval-policies.css";
import { useRouter } from "next/navigation";

const riskOrder = ["Low", "Medium", "High", "Critical"];

function readable(value: string) {
    return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function date(value: string | null | undefined) {
    if (!value) return "—";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";

    return parsed.toLocaleDateString("en-CA", {
        timeZone: "America/Toronto",
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function Status({ value }: { value: string }) {
    return (
        <span className={`apol-status apol-status-${value.toLowerCase()}`}>
            {value}
        </span>
    );
}

function Risk({ value }: { value: string }) {
    return (
        <span className={`apol-risk apol-risk-${value.toLowerCase()}`}>
            {value}
        </span>
    );
}

function Metric({
    label,
    value,
    icon,
    color
}: {
    label: string;
    value: number | string;
    icon: string;
    color: string;
}) {
    return (
        <article className="apol-metric">
            <div className={`apol-metric-icon ${color}`}>
                <Icon name={icon} size={30} />
            </div>
            <div>
                <strong>{label}</strong>
                <b>{value}</b>
            </div>
        </article>
    );
}

function Panel({
    title,
    icon,
    children,
    action
}: {
    title: string;
    icon?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="apol-panel">
            <header className="apol-panel-heading">
                <h2>
                    {icon && <Icon name={icon} size={26} />}
                    {title}
                </h2>
                {action}
            </header>
            {children}
        </section>
    );
}

function exportPolicies(
    policies: ManagedApprovalPolicy[],
    format: "csv" | "json"
) {
    let content: string;
    let type: string;

    if (format === "json") {
        content = JSON.stringify(policies, null, 2);
        type = "application/json";
    } else {
        const quote = (value: unknown) =>
            `"${String(value ?? "").replace(/"/g, '""')}"`;

        const columns = [
            "Policy ID", "Policy Name", "Version", "Status",
            "Effective Date", "Owner", "Risk Coverage", "Description"
        ];

        const rows = policies.map(item => [
            item.policyId,
            item.name,
            item.versionLabel,
            item.status,
            item.effectiveDate ?? "",
            item.owner,
            item.riskLevels.join("; "),
            item.description
        ]);

        content = [columns, ...rows]
            .map(row => row.map(quote).join(","))
            .join("\r\n");

        type = "text/csv;charset=utf-8";
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `approval-policies.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export default function ApprovalPoliciesPage() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("All");
    const [data, setData] = useState<PolicyListResult | null>(null);
    const [selectedId, setSelectedId] = useState("");
    const [details, setDetails] = useState<PolicyDetailsResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [error, setError] = useState("");
    const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
    const [showAllVersions, setShowAllVersions] = useState(false);

    useEffect(() => {
        let active = true;

        getApprovalPolicies()
            .then(result => {
                if (!active) return;

                setData(result);
                setSelectedId(result.policies[0]?.policyId ?? "");
            })
            .catch(err => {
                if (active) setError(
                    err instanceof Error ? err.message : "Unable to load policies."
                );
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!selectedId) {
            setDetails(null);
            return;
        }

        let active = true;
        setDetailsLoading(true);

        getApprovalPolicyDetails(selectedId)
            .then(result => {
                if (active) {
                    setDetails(result);
                    setShowAllVersions(false);
                }
            })
            .catch(err => {
                if (active) {
                    setDetails(null);
                    setError(
                        err instanceof Error ? err.message : "Unable to load policy."
                    );
                }
            })
            .finally(() => {
                if (active) setDetailsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [selectedId]);

    const filtered = useMemo(() => {
        const query = search.toLowerCase().trim();

        return (data?.policies ?? []).filter(item =>
            (status === "All" || item.status === status) &&
            (!query || [
                item.name,
                item.description,
                item.policyId,
                item.versionLabel
            ].some(value => value.toLowerCase().includes(query)))
        );
    }, [data, search, status]);

    const selected = filtered.find(item => item.policyId === selectedId);
    useEffect(() => {
        if (!filtered.length) {
            if (selectedId) setSelectedId("");
            return;
        }

        if (!filtered.some(item => item.policyId === selectedId)) {
            setSelectedId(filtered[0].policyId);
        }
    }, [filtered, selectedId]);
    const policy =
        details && selected?.policyId === details.policy.policyId
            ? details.policy
            : null;

    const mappings = details?.mappings ?? [];
    const versions = details?.versions ?? [];
    const metrics = data?.summary;

    return (
        <main className="apol-page">
            <div className="apol-breadcrumb">
                <Link href="/approvals">Approval Management</Link>
                <Icon name="chevron_right" size={17} />
                <strong>Approval Policies</strong>
            </div>

            <header className="apol-heading">
                <div className="apol-heading-text">
                    <h1>
                        <Icon name="layers" size={36} />
                        Approval Policies
                    </h1>
                    <p>
                        Define and version the business rules that determine approval
                        workflows, risk thresholds, reviewers, SLAs, and escalation.
                    </p>
                </div>

                <div className="apol-heading-actions">
                    <button
                        type="button"
                        className="apol-primary"
                        onClick={() => router.push("/approvals/policies/new")}
                    >
                        <Icon name="add" size={21} />
                        New Approval Policy (Draft)
                    </button>

                    <div className="apol-export">
                        <select
                            aria-label="Export format"
                            value={exportFormat}
                            onChange={event =>
                                setExportFormat(event.target.value as "csv" | "json")
                            }
                        >
                            <option value="csv">CSV</option>
                            <option value="json">JSON</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => exportPolicies(filtered, exportFormat)}
                        >
                            <Icon name="download" size={19} />
                            Export
                        </button>
                    </div>
                </div>
            </header>

            {error && <p className="apol-error" role="alert">{error}</p>}

            <div className="apol-metrics">
                <Metric label="Total Policies" value={metrics?.total ?? "—"} icon="layers" color="blue" />
                <Metric label="Active" value={metrics?.active ?? "—"} icon="check_circle" color="green" />
                <Metric label="Draft" value={metrics?.draft ?? "—"} icon="edit_square" color="cyan" />
                <Metric label="Pending Approval" value={metrics?.pending ?? "—"} icon="schedule" color="amber" />
                <Metric label="Archived" value={metrics?.archived ?? "—"} icon="inventory_2" color="gray" />
            </div>

            <div className="apol-columns">
                <Panel title={`Approval Policies${loading ? "" : ` (${filtered.length})`}`}>
                    <div className="apol-searchbar">
                        <label className="apol-search">
                            <Icon name="search" size={20} />
                            <input
                                aria-label="Search approval policies"
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                placeholder="Search by policy name, version, or description..."
                            />
                        </label>

                        <label className="apol-status-filter">
                            <Icon name="filter_alt" size={19} />
                            <select
                                aria-label="Filter by policy status"
                                value={status}
                                onChange={event => {
                                    setStatus(event.target.value);
                                    setSelectedId("");
                                }}
                            >
                                <option value="All">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Draft">Draft</option>
                                <option value="Pending">Pending Approval</option>
                                <option value="Archived">Archived</option>
                                <option value="Superseded">Superseded</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </label>
                    </div>

                    <div className="apol-table-scroll">
                        <table className="apol-directory-table">
                            <thead>
                                <tr>
                                    <th>Policy Name</th>
                                    <th>Version</th>
                                    <th>Status</th>
                                    <th>Effective Date</th>
                                    <th>Risk Coverage</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(item => (
                                    <tr
                                        key={item.policyId}
                                        className={selectedId === item.policyId ? "selected" : ""}
                                        onClick={() => setSelectedId(item.policyId)}
                                        tabIndex={0}
                                        onKeyDown={event => {
                                            if (event.key === "Enter") {
                                                setSelectedId(item.policyId);
                                            }
                                        }}
                                    >
                                        <td>
                                            <span className="apol-policy-name">
                                                <Icon name="layers" size={25} />
                                                <span>
                                                    <strong>{item.name}</strong>
                                                    <small>{item.description}</small>
                                                </span>
                                            </span>
                                        </td>
                                        <td>{item.versionLabel}</td>
                                        <td><Status value={item.status} /></td>
                                        <td>{date(item.effectiveDate)}</td>
                                        <td>
                                            <div className="apol-risk-list">
                                                {item.riskLevels.map(level => (
                                                    <Risk key={level} value={level} />
                                                ))}
                                                {!item.riskLevels.length && "—"}
                                            </div>
                                        </td>
                                        <td>
                                            <Icon name="chevron_right" size={22} />
                                        </td>
                                    </tr>
                                ))}
                                {!filtered.length && (
                                    <tr>
                                        <td colSpan={6} className="apol-empty">
                                            {loading
                                                ? "Loading approval policies..."
                                                : "No matching approval policies found."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Panel>

                <div className="apol-details">
                    {policy ? (
                        <>
                            <section className="apol-detail-heading">
                                {policy.status === "Draft" && policy.hasWizardConfig && (
                                    <div className="apol-draft-action">
                                        <button
                                            type="button"
                                            className="apol-primary"
                                            onClick={() => router.push(
                                                `/approvals/policies/new?draft=${encodeURIComponent(policy.policyId)}`
                                            )}
                                        >
                                            <Icon name="edit" size={18} />
                                            Continue Editing Draft
                                        </button>
                                    </div>
                                )}
                                <div className="apol-detail-heading-main">
                                    <Icon name="layers" size={34} />
                                    <h2>{policy.name}</h2>
                                    <Status value={policy.status} />
                                </div>
                                <div className="apol-detail-meta">
                                    <span><b>Version:</b> {policy.versionLabel}</span>
                                    <span><b>Effective:</b> {date(policy.effectiveDate)}</span>
                                    <span><b>Owner:</b> {policy.owner}</span>
                                </div>
                            </section>

                            <section className="apol-detail-card">
                                <h3><Icon name="info" size={21} /> Policy Description</h3>
                                <p className="apol-description">
                                    {policy.description || "No description provided."}
                                </p>
                            </section>

                            <section className="apol-detail-card">
                                <h3>
                                    <Icon name="account_tree" size={21} />
                                    Risk-to-Workflow Mapping
                                </h3>
                                <div className="apol-table-scroll">
                                    <table className="apol-small-table">
                                        <thead>
                                            <tr>
                                                <th>Risk Level</th>
                                                <th>Workflow (Approval Sequence)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...mappings].sort(
                                                (a, b) =>
                                                    riskOrder.indexOf(a.riskLevel) -
                                                    riskOrder.indexOf(b.riskLevel)
                                            ).map((mapping, index) => (
                                                <tr key={`${mapping.riskLevel}-${index}`}>
                                                    <td>
                                                        <Risk value={mapping.riskLevel} />
                                                    </td>
                                                    <td>
                                                        {mapping.workflowId ? (
                                                            <Link
                                                                href={`/approvals/workflows/${encodeURIComponent(mapping.workflowId)}`}
                                                            >
                                                                {mapping.workflowId}
                                                            </Link>
                                                        ) : (
                                                            <span>Not linked to a catalog definition</span>
                                                        )}
                                                        <span className="apol-sequence">
                                                            {mapping.stages.length
                                                                ? mapping.stages.map(readable).join(" → ")
                                                                : "No approval required"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {!mappings.length && (
                                                <tr>
                                                    <td colSpan={2} className="apol-empty">
                                                        No risk-to-workflow mapping configured.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <section className="apol-detail-card">
                                <div className="apol-version-heading">
                                    <h3>
                                        <Icon name="history" size={22} />
                                        Policy Version History
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setShowAllVersions(value => !value)}
                                    >
                                        {showAllVersions ? "Show Recent" : "View Full History"}
                                        <Icon name="chevron_right" size={17} />
                                    </button>
                                </div>
                                <div className="apol-table-scroll">
                                    <table className="apol-small-table">
                                        <thead>
                                            <tr>
                                                <th>Version</th>
                                                <th>Status</th>
                                                <th>Effective Date</th>
                                                <th>Changed By</th>
                                                <th>Change Summary</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(showAllVersions
                                                ? versions
                                                : versions.slice(0, 3)
                                            ).map(item => (
                                                <tr key={`${item.policyId}-${item.version}`}>
                                                    <td><strong>{item.versionLabel}</strong></td>
                                                    <td><Status value={item.status} /></td>
                                                    <td>{date(item.effectiveDate)}</td>
                                                    <td>{item.changedBy}</td>
                                                    <td>{item.changeSummary || "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </>
                    ) : (
                        <section className="apol-panel apol-placeholder">
                            {detailsLoading
                                ? "Loading policy details..."
                                : "Select an approval policy to view its configuration."}
                        </section>
                    )}
                </div>
            </div>
        </main>
    );
}
