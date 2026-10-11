"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getDashboardSummary, DashboardSummary } from "@/services/dashboard";
import { formatMoney } from "@/services/accounts";
import { ROUTES } from "../../config";

const emptySummary: DashboardSummary = {
    totalClients: 0,
    activeClients: 0,
    activeAccounts: 0,
    totalTransactions: 0,
    pendingTransactions: 0,
    completedTransactions: 0,
    rejectedTransactions: 0,
    transactionStatuses: {
        Pending: 0,
        Completed: 0,
        Rejected: 0
    },
    recentTransactions: []
};

export default function DashboardPage() {
    const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        async function loadDashboard() {
            try {
                setLoading(true);
                setError("");

                const data = await getDashboardSummary(controller.signal);
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

    const totalStatusCount =
        summary.transactionStatuses.Completed +
        summary.transactionStatuses.Pending +
        summary.transactionStatuses.Rejected;

    const completedPercentage =
        totalStatusCount > 0
            ? (summary.transactionStatuses.Completed / totalStatusCount) * 100
            : 0;

    const pendingPercentage =
        totalStatusCount > 0
            ? (summary.transactionStatuses.Pending / totalStatusCount) * 100
            : 0;

    const rejectedPercentage =
        totalStatusCount > 0
            ? (summary.transactionStatuses.Rejected / totalStatusCount) * 100
            : 0;

    const donutStyle = useMemo(
        () => ({
            background: `conic-gradient(
                #22c55e 0% ${completedPercentage}%,
                #fbbf24 ${completedPercentage}% ${completedPercentage + pendingPercentage}%,
                #ef4444 ${completedPercentage + pendingPercentage}% ${completedPercentage + pendingPercentage + rejectedPercentage}%,
                #e5e7eb ${completedPercentage + pendingPercentage + rejectedPercentage}% 100%
            )`
        }),
        [completedPercentage, pendingPercentage, rejectedPercentage]
    );

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
        }
    ];

    return (
        <section className="dashboard-page">
            <div className="dashboard-header">
                <h1>Operations Dashboard</h1>
                <p>Overview of clients, accounts and transaction activity</p>
            </div>

            {loading && <p className="dashboard-message">Loading dashboard...</p>}

            {error && !loading && (
                <div className="dashboard-error">
                    <p>{error}</p>
                </div>
            )}

            <div className="dashboard-metric-grid">
                {metricCards.map(card => (
                    <div key={card.label} className="dashboard-metric-card">
                        <div className={`metric-icon ${card.tone}`}>
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

            <div className="dashboard-panels">
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h2>Transactions by Status</h2>
                    </div>

                    <div className="status-section">
                        <div className="status-donut-wrap">
                            <div className="status-donut" style={donutStyle}>
                                <div className="status-donut-inner">
                                    <strong>{summary.totalTransactions}</strong>
                                    <span>Total</span>
                                </div>
                            </div>
                        </div>

                        <div className="status-legend">
                            <div className="status-legend-item">
                                <span className="legend-dot completed" />
                                <span className="legend-value">
                                    {summary.transactionStatuses.Completed}
                                </span>
                                <span className="legend-label">Completed</span>
                            </div>

                            <div className="status-legend-item">
                                <span className="legend-dot pending" />
                                <span className="legend-value">
                                    {summary.transactionStatuses.Pending}
                                </span>
                                <span className="legend-label">Pending</span>
                            </div>

                            <div className="status-legend-item">
                                <span className="legend-dot rejected" />
                                <span className="legend-value">
                                    {summary.transactionStatuses.Rejected}
                                </span>
                                <span className="legend-label">Rejected</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h2>Recent Transactions</h2>
                   <Link href={ROUTES.transactions} className="view-all-link">
                            View all
                        </Link>
                    </div>

                    <div className="dashboard-table-wrap">
                        <table className="dashboard-table">
                            <thead>
                                <tr>
                                    <th>Reference #</th>
                                    <th>Amount</th>
                                    <th>Currency</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                </tr>
                            </thead>

                            <tbody>
                                {summary.recentTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="empty-row">
                                            No recent transactions
                                        </td>
                                    </tr>
                                ) : (
                                    summary.recentTransactions.map(transaction => (
                                        <tr key={transaction.transactionId}>
                                            <td>
                                                <Link
                                                    href={ROUTES.transactionDetails(transaction.transactionId)}
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
                                                    className={`status-pill ${
                                                        transaction.status === "Completed"
                                                            ? "completed"
                                                            : transaction.status === "Pending"
                                                                ? "pending"
                                                                : "rejected"
                                                    }`}
                                                >
                                                    {transaction.status}
                                                </span>
                                            </td>
                                            <td>
                                                {new Date(
                                                    transaction.createdAt
                                                ).toLocaleDateString("en-CA", {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric"
                                                })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
}