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
    recentProcessingActivity: []
};

function formatDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return date.toLocaleString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function TransactionTable({
    transactions,
    dateField
}: {
    transactions: RecentTransaction[];
    dateField: "createdAt" | "updatedAt";
}) {
    return (
        <div className="dashboard-table-wrap">
            <table className="dashboard-table">
                <thead>
                    <tr>
                        <th>Reference #</th>
                        <th>Amount</th>
                        <th>Currency</th>
                        <th>Status</th>
                        <th>
                            {dateField === "updatedAt"
                                ? "Last Updated"
                                : "Date"}
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {transactions.length === 0 ? (
                        <tr>
                            <td
                                colSpan={5}
                                className="empty-row"
                            >
                                No recent transactions
                            </td>
                        </tr>
                    ) : (
                        transactions.map(transaction => (
                            <tr key={transaction.transactionId}>
                                <td>
                                    <Link
                                        href={ROUTES.transactionDetails(
                                            transaction.transactionId
                                        )}
                                        className="table-link"
                                    >
                                        {transaction.referenceNumber}
                                    </Link>
                                </td>

                                <td>
                                    {formatMoney(
                                        transaction.amountMinor,
                                        transaction.currency
                                    )}
                                </td>

                                <td>{transaction.currency}</td>

                                <td>
                                    <span
                                        className={`status-pill ${transaction.status.toLowerCase()}`}
                                    >
                                        {transaction.status}
                                    </span>
                                </td>

                                <td>
                                    {formatDate(
                                        transaction[dateField]
                                    )}
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

    const statuses = summary.transactionStatuses;

    const totalStatusCount =
        statuses.Pending +
        statuses.Processing +
        statuses.Completed +
        statuses.Rejected;

    const percentage = (count: number) =>
        totalStatusCount > 0
            ? (count / totalStatusCount) * 100
            : 0;

    const completedEnd = percentage(statuses.Completed);

    const processingEnd =
        completedEnd + percentage(statuses.Processing);

    const pendingEnd =
        processingEnd + percentage(statuses.Pending);

    const rejectedEnd =
        pendingEnd + percentage(statuses.Rejected);

    const donutStyle = {
        background: `conic-gradient(
            #22c55e 0% ${completedEnd}%,
            #3b82f6 ${completedEnd}% ${processingEnd}%,
            #fbbf24 ${processingEnd}% ${pendingEnd}%,
            #ef4444 ${pendingEnd}% ${rejectedEnd}%,
            #e5e7eb ${rejectedEnd}% 100%
        )`
    };

    const metricCards = [
        {
            label: "Total Clients",
            value: summary.totalClients,
            icon: "group",
            tone: "blue"
        },
        {
            label: "Active Clients",
            value: summary.activeClients,
            icon: "person",
            tone: "green"
        },
        {
            label: "Active Accounts",
            value: summary.activeAccounts,
            icon: "account_balance_wallet",
            tone: "indigo"
        },
        {
            label: "Total Transactions",
            value: summary.totalTransactions,
            icon: "receipt_long",
            tone: "red"
        },
        {
            label: "Pending Transactions",
            value: statuses.Pending,
            icon: "schedule",
            tone: "indigo"
        },
        {
            label: "Processing Transactions",
            value: statuses.Processing,
            icon: "sync",
            tone: "blue"
        },
        {
            label: "Completed Transactions",
            value: statuses.Completed,
            icon: "check_circle",
            tone: "green"
        },
        {
            label: "Rejected Transactions",
            value: statuses.Rejected,
            icon: "cancel",
            tone: "red"
        }
    ];

    const volumeCards = [
        {
            label: "Completed CAD Volume",
            currency: "CAD",
            amountMinor: summary.completedVolumes.CAD,
            icon: "payments",
            tone: "green"
        },
        {
            label: "Completed USD Volume",
            currency: "USD",
            amountMinor: summary.completedVolumes.USD,
            icon: "payments",
            tone: "blue"
        }
    ];

    const statusLegend = [
        {
            label: "Completed",
            value: statuses.Completed,
            tone: "completed"
        },
        {
            label: "Processing",
            value: statuses.Processing,
            tone: "processing"
        },
        {
            label: "Pending",
            value: statuses.Pending,
            tone: "pending"
        },
        {
            label: "Rejected",
            value: statuses.Rejected,
            tone: "rejected"
        }
    ];

    return (
        <section className="dashboard-page">
            <div className="dashboard-header">
                <h1>Operations Dashboard</h1>
                <p>
                    Overview of clients, accounts and
                    transaction activity
                </p>
            </div>

            {loading && (
                <p className="dashboard-message" role="status">
                    Loading dashboard...
                </p>
            )}

            {error && !loading && (
                <div className="dashboard-error" role="alert">
                    <p>{error}</p>
                </div>
            )}

            {!loading && !error && (
                <>
                    <div className="dashboard-metric-grid">
                        {metricCards.map(card => (
                            <div
                                key={card.label}
                                className="dashboard-metric-card"
                            >
                                <div
                                    className={`metric-icon ${card.tone}`}
                                >
                                    <span className="material-symbols-rounded">
                                        {card.icon}
                                    </span>
                                </div>

                                <div className="metric-copy">
                                    <h2>{card.value}</h2>
                                    <p>{card.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="dashboard-volume-grid">
                        {volumeCards.map(card => (
                            <div
                                key={card.currency}
                                className="dashboard-metric-card"
                            >
                                <div
                                    className={`metric-icon ${card.tone}`}
                                >
                                    <span className="material-symbols-rounded">
                                        {card.icon}
                                    </span>
                                </div>

                                <div className="metric-copy">
                                    <h2>
                                        {formatMoney(
                                            card.amountMinor,
                                            card.currency
                                        )}
                                    </h2>
                                    <p>{card.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="dashboard-panels">
                        <div className="dashboard-panel">
                            <div className="dashboard-panel-header">
                                <h2>Transactions by Status</h2>
                            </div>

                            <div className="status-section">
                                <div className="status-donut-wrap">
                                    <div
                                        className="status-donut"
                                        style={donutStyle}
                                    >
                                        <div className="status-donut-inner">
                                            <strong>
                                                {summary.totalTransactions}
                                            </strong>
                                            <span>Total</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="status-legend">
                                    {statusLegend.map(item => (
                                        <div
                                            key={item.label}
                                            className="status-legend-item"
                                        >
                                            <span
                                                className={`legend-dot ${item.tone}`}
                                            />
                                            <span className="legend-value">
                                                {item.value}
                                            </span>
                                            <span className="legend-label">
                                                {item.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="dashboard-panel">
                            <div className="dashboard-panel-header">
                                <h2>Recent Transactions</h2>

                                <Link
                                    href={ROUTES.transactions}
                                    className="view-all-link"
                                >
                                    View all
                                </Link>
                            </div>

                            <TransactionTable
                                transactions={summary.recentTransactions}
                                dateField="createdAt"
                            />
                        </div>
                    </div>

                    <div className="dashboard-panel dashboard-activity-panel">
                        <div className="dashboard-panel-header">
                            <h2>Recent Processing Activity</h2>

                            <Link
                                href={ROUTES.transactions}
                                className="view-all-link"
                            >
                                View all
                            </Link>
                        </div>

                        <TransactionTable
                            transactions={summary.recentProcessingActivity}
                            dateField="updatedAt"
                        />
                    </div>
                </>
            )}
        </section>
    );
}