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

type Tab = "overview" | "accounts" | "contact";

function formatDate(value: string) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return date.toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function InformationRow({
    label,
    children
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="client-profile-info-row">
            <span>{label}</span>
            <div className="client-profile-info-value">
                {children}
            </div>
        </div>
    );
}

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
            <section className="client-profile-page">
                <p className="client-profile-message">
                    Loading client details...
                </p>
            </section>
        );
    }

    if (error || !client) {
        return (
            <section className="client-profile-page">
                <p className="client-profile-error" role="alert">
                    {error || "Client not found."}
                </p>

                <Link href={ROUTES.clients}>
                    Back to Clients
                </Link>
            </section>
        );
    }

    const accounts = client.accounts;
    const accountCount = accounts.length;

    const tabs: { id: Tab; label: string }[] = [
        { id: "overview", label: "Overview" },
        { id: "accounts", label: `Accounts (${accountCount})` },
        { id: "contact", label: "Contact Information" }
    ];

    function AccountsTable({ showActions = false }: {
        showActions?: boolean;
    }) {
        return (
            <div className="client-profile-accounts-table-wrap">
                <table className="client-profile-accounts-table">
                    <thead>
                        <tr>
                            <th>Account Number</th>
                            {showActions && <th>Type</th>}
                            <th>Currency</th>
                            <th>Balance</th>
                            <th>Status</th>
                            {showActions && <th>Actions</th>}
                        </tr>
                    </thead>

                    <tbody>
                        {accounts.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={showActions ? 6 : 4}
                                    className="client-profile-table-empty"
                                >
                                    No accounts found for this client.
                                </td>
                            </tr>
                        ) : (
                            accounts.map(account => (
                                <tr key={account.accountId}>
                                    <td>
                                        <Link
                                            href={ROUTES.accountDetails(
                                                account.accountId
                                            )}
                                            className="client-profile-account-number"
                                        >
                                            {account.accountNumber}
                                        </Link>
                                    </td>

                                    {showActions && (
                                        <td>{account.accountType}</td>
                                    )}

                                    <td>{account.currency}</td>

                                    <td>
                                        {formatMoney(
                                            account.balanceMinor,
                                            account.currency
                                        )}
                                    </td>

                                    <td>
                                        <span
                                            className={`client-profile-status ${account.status.toLowerCase()}`}
                                        >
                                            {account.status}
                                        </span>
                                    </td>

                                    {showActions && (
                                        <td>
                                            <Link
                                                href={ROUTES.accountDetails(
                                                    account.accountId
                                                )}
                                                className="client-profile-account-action"
                                            >
                                                View
                                            </Link>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <section className="client-profile-page">
            <div className="client-profile-toolbar">
                <nav
                    className="client-profile-breadcrumb"
                    aria-label="Breadcrumb"
                >
                    <Link href={ROUTES.clients}>
                        <span className="material-symbols-rounded">
                            home
                        </span>
                        Clients
                    </Link>

                    <span className="material-symbols-rounded">
                        chevron_right
                    </span>

                    <span>{client.companyName}</span>
                </nav>

                <Link
                    href={ROUTES.clientEdit(client.clientId)}
                    className="client-profile-edit-button"
                >
                    <span className="material-symbols-rounded">
                        edit
                    </span>
                    Edit Client
                </Link>
            </div>

            <div className="client-profile-heading">
                <div className="client-profile-avatar">
                    <span className="material-symbols-rounded">
                        account_balance
                    </span>
                </div>

                <div className="client-profile-heading-content">
                    <div className="client-profile-heading-title">
                        <h1>{client.companyName}</h1>

                        <span
                            className={`client-profile-status client-profile-main-status ${client.status.toLowerCase()}`}
                        >
                            {client.status}
                        </span>
                    </div>

                    <p>Client ID: {client.clientId}</p>
                </div>
            </div>

            <div
                className="client-profile-tabs"
                role="tablist"
                aria-label="Client information"
            >
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        id={`client-tab-${tab.id}`}
                        aria-controls={`client-panel-${tab.id}`}
                        aria-selected={activeTab === tab.id}
                        className={`client-profile-tab ${
                            activeTab === tab.id ? "selected" : ""
                        }`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === "overview" && (
                <div
                    className="client-profile-overview"
                    role="tabpanel"
                    id="client-panel-overview"
                    aria-labelledby="client-tab-overview"
                >
                    <section className="client-profile-card client-profile-company-card">
                        <h2>Company Information</h2>

                        <div className="client-profile-information">
                            <InformationRow label="Company Name">
                                {client.companyName}
                            </InformationRow>

                            <InformationRow label="Registration Number">
                                {client.registrationNumber}
                            </InformationRow>

                            <InformationRow label="Industry">
                                {client.industry}
                            </InformationRow>

                            <InformationRow label="Country">
                                {client.country}
                            </InformationRow>

                            <InformationRow label="Status">
                                <span
                                    className={`client-profile-status ${client.status.toLowerCase()}`}
                                >
                                    {client.status}
                                </span>
                            </InformationRow>

                            <InformationRow label="Created At">
                                {formatDate(client.createdAt)}
                            </InformationRow>

                            <InformationRow label="Updated At">
                                {formatDate(client.updatedAt)}
                            </InformationRow>
                        </div>
                    </section>

                    <section className="client-profile-card client-profile-overview-accounts">
                        <div className="client-profile-card-title">
                            <h2>Accounts ({accountCount})</h2>
                        </div>

                        <AccountsTable />

                        <div className="client-profile-card-footer">
                            <button
                                type="button"
                                className="client-profile-outline-button"
                                onClick={() => setActiveTab("accounts")}
                            >
                                View All Accounts
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === "accounts" && (
                <div
                    className="client-profile-card client-profile-full-panel"
                    role="tabpanel"
                    id="client-panel-accounts"
                    aria-labelledby="client-tab-accounts"
                >
                    <div className="client-profile-panel-heading">
                        <div>
                            <h2>Financial Accounts</h2>
                            <p>
                                {accountCount} accounts associated with this client
                            </p>
                        </div>

                        {client.status === "Active" && (
                            <Link
                                href={ROUTES.accountRegistration}
                                className="client-profile-edit-button"
                            >
                                <span className="material-symbols-rounded">
                                    add
                                </span>
                                Register Account
                            </Link>
                        )}
                    </div>

                    <AccountsTable showActions />
                </div>
            )}

            {activeTab === "contact" && (
                <div
                    className="client-profile-card client-profile-contact-panel"
                    role="tabpanel"
                    id="client-panel-contact"
                    aria-labelledby="client-tab-contact"
                >
                    <h2>Contact Information</h2>

                    <div className="client-profile-information">
                        <InformationRow label="Company Name">
                            {client.companyName}
                        </InformationRow>

                        <InformationRow label="Contact Email">
                            <a href={`mailto:${client.contactEmail}`}>
                                {client.contactEmail}
                            </a>
                        </InformationRow>

                        <InformationRow label="Contact Phone">
                            {client.contactPhone ? (
                                <a href={`tel:${client.contactPhone}`}>
                                    {client.contactPhone}
                                </a>
                            ) : (
                                "Not provided"
                            )}
                        </InformationRow>

                        <InformationRow label="Country">
                            {client.country}
                        </InformationRow>
                    </div>
                </div>
            )}
        </section>
    );
}