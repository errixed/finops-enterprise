"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
    ClientProfile,
    getClient
} from "@/services/clients";
import { formatMoney } from "@/services/accounts";
import { ROUTES } from "../../../../config";

interface Props {
    params: Promise<{ id: string }>;
}

type Tab = "overview" | "accounts";

export default function ClientDetailsPage({ params }: Props) {
    const { id } = use(params);

    const [client, setClient] = useState<ClientProfile | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        async function loadClient() {
            setLoading(true);
            setError("");

            try {
                const data = await getClient(id);

                if (active) {
                    setClient(data);
                }
            } catch (err) {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load client details"
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadClient();

        return () => {
            active = false;
        };
    }, [id]);

    if (loading) {
        return (
            <section className="client-details-page">
                <p>Loading client details...</p>
            </section>
        );
    }

    if (error) {
        return (
            <section className="client-details-page">
                <p role="alert" className="client-details-error">{error}</p>
                <Link href={ROUTES.clients}>Back to Clients</Link>
            </section>
        );
    }

    if (!client) {
        return (
            <section className="client-details-page">
                <p>Client not found.</p>
            </section>
        );
    }

    const accountCounts = {
        total: client.accounts.length,
        active: client.accounts.filter(
            account => account.status === "Active"
        ).length,
        frozen: client.accounts.filter(
            account => account.status === "Frozen"
        ).length,
        closed: client.accounts.filter(
            account => account.status === "Closed"
        ).length
    };

    function formatDate(value: string) {
        return new Date(value).toLocaleString("en-CA", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    return (
        <section className="client-details-page">
            <div className="client-details-header">
                <div className="client-details-title">
                    <h1>{client.companyName}</h1>

                    <span className={`clients-status-badge ${client.status.toLowerCase()}`}>
                        {client.status}
                    </span>
                </div>

                <Link
                    href={ROUTES.clientEdit(client.clientId)}
                    className="client-details-edit-button"
                >
                    <span className="material-symbols-rounded">edit</span>
                    Edit
                </Link>
            </div>

            <div className="client-details-tabs" role="tablist" aria-label="Client information">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "overview"}
                    className={`client-details-tab ${
                        activeTab === "overview" ? "selected" : ""
                    }`}
                    onClick={() => setActiveTab("overview")}
                >
                    Overview
                </button>

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "accounts"}
                    className={`client-details-tab ${
                        activeTab === "accounts" ? "selected" : ""
                    }`}
                    onClick={() => setActiveTab("accounts")}
                >
                    Accounts ({accountCounts.total})
                </button>
            </div>

            {activeTab === "overview" ? (
                <div className="client-overview-layout">
                    <div className="client-details-card">
                        <h2>Client Information</h2>

                        <div className="client-information-list">
                            <div className="client-information-row">
                                <span>Client ID</span>
                                <strong>{client.clientId}</strong>
                            </div>

                            <div className="client-information-row">
                                <span>Company Name</span>
                                <strong>{client.companyName}</strong>
                            </div>

                            <div className="client-information-row">
                                <span>Registration Number</span>
                                <strong>{client.registrationNumber}</strong>
                            </div>

                            <div className="client-information-row">
                                <span>Industry</span>
                                <strong>{client.industry}</strong>
                            </div>

                            <div className="client-information-row">
                                <span>Country</span>
                                <strong>{client.country}</strong>
                            </div>

                            <div className="client-information-row">
                                <span>Contact Email</span>
                                <a href={`mailto:${client.contactEmail}`}>
                                    {client.contactEmail}
                                </a>
                            </div>

                            <div className="client-information-row">
                                <span>Contact Phone</span>
                                <strong>{client.contactPhone || "Not provided"}</strong>
                            </div>

                            <div className="client-information-row">
                                <span>Status</span>
                                <div>
                                    <span
                                        className={`clients-status-badge ${client.status.toLowerCase()}`}
                                    >
                                        {client.status}
                                    </span>
                                </div>
                            </div>

                            <div className="client-information-row">
                                <span>Created At</span>
                                <strong>{formatDate(client.createdAt)}</strong>
                            </div>

                            <div className="client-information-row">
                                <span>Last Updated</span>
                                <strong>{formatDate(client.updatedAt)}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="client-details-sidebar">
                        <div className="client-details-card">
                            <h2>Quick Actions</h2>

                            <div className="client-quick-actions">
                                <Link href={ROUTES.clientEdit(client.clientId)}>
                                    <span className="material-symbols-rounded">
                                        edit_square
                                    </span>
                                    Edit Client
                                </Link>

                                <button
                                    type="button"
                                    onClick={() => setActiveTab("accounts")}
                                >
                                    <span className="material-symbols-rounded">
                                        account_balance_wallet
                                    </span>
                                    View Accounts
                                </button>
                            </div>
                        </div>

                        <div className="client-details-card">
                            <h2>Accounts Summary</h2>

                            <div className="client-account-summary">
                                <div>
                                    <span>Total Accounts</span>
                                    <strong>{accountCounts.total}</strong>
                                </div>
                                <div>
                                    <span>Active Accounts</span>
                                    <strong>{accountCounts.active}</strong>
                                </div>
                                <div>
                                    <span>Frozen Accounts</span>
                                    <strong>{accountCounts.frozen}</strong>
                                </div>
                                <div>
                                    <span>Closed Accounts</span>
                                    <strong>{accountCounts.closed}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="client-details-card client-accounts-panel">
                    <div className="client-accounts-heading">
                        <div>
                            <h2>Financial Accounts</h2>
                            <p>
                                {accountCounts.total} accounts associated with this client
                            </p>
                        </div>

                        {client.status === "Active" && (
                            <Link
                                href={ROUTES.accountRegistration}
                                className="client-details-edit-button"
                            >
                                <span className="material-symbols-rounded">
                                    add
                                </span>
                                Register Account
                            </Link>
                        )}
                    </div>

                    {client.accounts.length === 0 ? (
                        <p className="client-no-accounts">
                            No financial accounts are associated with this client.
                        </p>
                    ) : (
                        <div className="client-accounts-table-scroll">
                            <table className="client-accounts-table">
                                <thead>
                                    <tr>
                                        <th>Account Number</th>
                                        <th>Account Type</th>
                                        <th>Currency</th>
                                        <th>Balance</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {client.accounts.map(account => (
                                        <tr key={account.accountId}>
                                            <td>{account.accountNumber}</td>
                                            <td>{account.accountType}</td>
                                            <td>{account.currency}</td>
                                            <td>
                                                {formatMoney(
                                                    account.balanceMinor,
                                                    account.currency
                                                )}
                                            </td>
                                            <td>
                                                <span
                                                    className={`client-account-status ${account.status.toLowerCase()}`}
                                                >
                                                    {account.status}
                                                </span>
                                            </td>
                                            <td>
                                                <Link
                                                    href={ROUTES.accountDetails(account.accountId)}
                                                    className="client-account-view-link"
                                                >
                                                    View
                                                    <span className="material-symbols-rounded">
                                                        arrow_forward
                                                    </span>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}