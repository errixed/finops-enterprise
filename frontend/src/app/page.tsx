"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
    getDashboardSummary,
    DashboardSummary,
    RecentTransaction
} from "@/services/dashboard";
import { formatMoney } from "@/services/accounts";
import { ROUTES } from "../../config";

const emptySummary: DashboardSummary = {
    totalClients: 0,
    activeClients: 0,
    totalAccounts: 0,
    activeAccounts: 0,
    totalTransactions: 0,
    pendingTransactions: 0,
    processingTransactions: 0,
    completedTransactions: 0,
    rejectedTransactions: 0,
    transactionStatuses: {
        Pending: 0,
        Processing: 0,
        Completed: 0,
        Rejected: 0
    },
    completedVolumes: {
        CAD: 0,
        USD: 0
    },
    recentTransactions: [],
    recentProcessingActivity: [],
    growthStatistics: {
        newClientsThisMonth: 0,
        newAccountsThisMonth: 0,
        completedTransactionsThisWeek: 0
    },
};

function formatDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric"
    });
}

function MetricCard({
    label,
    value,
    tone,
    growth,
    growthPeriod
}: {
    label: string;
    value: number;
    tone?: string;
    growth?: number;
    growthPeriod?: string;
}) {
    return (
        <div className="finops-stat-card">
            <span className="finops-stat-label">
                {label}
            </span>

            <strong className={`finops-stat-value ${tone ?? ""}`}>
                {value.toLocaleString("en-CA")}
            </strong>

            {growth !== undefined && growthPeriod && (
                <div className="finops-stat-growth">
                    <span className="material-symbols-rounded">
                        arrow_upward
                    </span>

                    <span>
                        +{growth.toLocaleString("en-CA")} {growthPeriod}
                    </span>
                </div>
            )}
        </div>
    );
}

function VolumeSection({
    currency,
    amountMinor,
    percentage
}: {
    currency: "CAD" | "USD";
    amountMinor: number;
    percentage: number;
}) {
    return (
        <div className={`finops-volume-item ${currency.toLowerCase()}`}>
            <span className="finops-volume-marker" />

            <div className="finops-volume-content">
                <strong className="finops-volume-amount">
                    {currency} {formatMoney(amountMinor, currency)}
                </strong>

                <div
                    className="finops-volume-track"
                    role="progressbar"
                    aria-label={`${currency} share of completed transaction volume`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(percentage)}
                >
                    <div
                        className="finops-volume-fill"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

function ActivityTable({
    transactions
}: {
    transactions: RecentTransaction[];
}) {
    return (
        <div className="finops-activity-scroll">
            <table className="finops-activity-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>From Account</th>
                        <th>To Account</th>
                        <th>Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>

                <tbody>
                    {transactions.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="finops-empty">
                                No recent processing activity
                            </td>
                        </tr>
                    ) : (
                        transactions.map(transaction => (
                            <tr key={transaction.transactionId}>
                                <td>
                                    {formatDate(
                                        transaction.updatedAt ??
                                        transaction.createdAt
                                    )}
                                </td>

                                <td>
                                    <Link
                                        href={ROUTES.transactionDetails(
                                            transaction.transactionId
                                        )}
                                        className="finops-reference-link"
                                    >
                                        {transaction.referenceNumber}
                                    </Link>
                                </td>

                                <td>
                                    {transaction.sourceAccountNumber ||
                                        transaction.sourceAccountId}
                                </td>

                                <td>
                                    {transaction.destinationAccountNumber ||
                                        transaction.destinationAccountId}
                                </td>

                                <td>
                                    {formatMoney(
                                        transaction.amountMinor,
                                        transaction.currency
                                    )}
                                </td>

                                <td>
                                    <span
                                        className={`finops-status ${transaction.status.toLowerCase()
                                            }`}
                                    >
                                        {transaction.status}
                                    </span>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default function DashboardPage() {
    const [summary, setSummary] =
        useState<DashboardSummary>(emptySummary);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        async function loadDashboard() {
            try {
                setLoading(true);
                setError("");

                const data = await getDashboardSummary(
                    controller.signal
                );

                setSummary(data);
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load dashboard"
                    );

                    setSummary(emptySummary);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        loadDashboard();

        return () => controller.abort();
    }, []);

    const cadVolume = summary.completedVolumes.CAD;
    const usdVolume = summary.completedVolumes.USD;
    const totalVolume = cadVolume + usdVolume;

    const cadPercentage =
        totalVolume > 0 ? (cadVolume / totalVolume) * 100 : 0;

    const usdPercentage =
        totalVolume > 0 ? (usdVolume / totalVolume) * 100 : 0;

    return (
        <section className="finops-dashboard">
            {loading && (
                <p className="finops-dashboard-message" role="status">
                    Loading dashboard...
                </p>
            )}

            {error && !loading && (
                <div className="finops-dashboard-error" role="alert">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <>
                    <div className="finops-stat-grid">

                        <MetricCard
                            label="Total Clients"
                            value={summary.totalClients}
                            growth={summary.growthStatistics.newClientsThisMonth}
                            growthPeriod="this month"
                        />

                        <MetricCard
                            label="Total Accounts"
                            value={summary.totalAccounts}
                            growth={summary.growthStatistics.newAccountsThisMonth}
                            growthPeriod="this month"
                        />

                        <MetricCard
                            label="Pending Transactions"
                            value={summary.pendingTransactions}
                            tone="danger"
                        />

                        <MetricCard
                            label="Processing Transactions"
                            value={summary.processingTransactions}
                            tone="info"
                        />

                        <MetricCard
                            label="Completed Transactions"
                            value={summary.completedTransactions}
                            growth={summary.growthStatistics.completedTransactionsThisWeek}
                            growthPeriod="this week"
                        />

                        <MetricCard
                            label="Rejected Transactions"
                            value={summary.rejectedTransactions}
                            tone="danger"
                        />
                    </div>

                    <div className="finops-dashboard-panels">
                        <section className="finops-panel finops-volume-panel">
                            <h2>Completed Transaction Volume</h2>

                            <div className="finops-volume-list">
                                <VolumeSection
                                    currency="CAD"
                                    amountMinor={cadVolume}
                                    percentage={cadPercentage}
                                />

                                <VolumeSection
                                    currency="USD"
                                    amountMinor={usdVolume}
                                    percentage={usdPercentage}
                                />
                            </div>
                        </section>

                        <section className="finops-panel finops-activity-panel">
                            <div className="finops-panel-heading">
                                <h2>Recent Processing Activity</h2>

                                <Link
                                    href={ROUTES.transactions}
                                    className="finops-view-all"
                                >
                                    View All
                                </Link>
                            </div>

                            <ActivityTable
                                transactions={
                                    summary.recentProcessingActivity
                                }
                            />
                        </section>
                    </div>
                </>
            )}
        </section>
    );
}