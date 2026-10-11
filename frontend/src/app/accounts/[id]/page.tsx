"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
    AccountDetails,
    getAccount
} from "@/services/accounts";
import { ROUTES } from "../../../../config";

interface Props {
    params: Promise<{ id: string }>;
}

export default function AccountDetailsPage({ params }: Props) {
    const { id } = use(params);

    const [account, setAccount] = useState<AccountDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        setLoading(true);
        setError("");

        getAccount(id)
            .then(data => {
                if (active) setAccount(data);
            })
            .catch(err => {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load account details"
                    );
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [id]);

    function formatBalance(amountMinor: number) {
        return (amountMinor / 100).toLocaleString("en-CA", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatDate(value: string) {
        return new Date(value).toLocaleString("en-CA", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    if (loading) {
        return (
            <section className="account-details-page">
                <p>Loading account details...</p>
            </section>
        );
    }

    if (error || !account) {
        return (
            <section className="account-details-page">
                <p role="alert" className="client-details-error">
                    {error || "Account not found"}
                </p>
                <Link href={ROUTES.accounts}>Back to Accounts</Link>
            </section>
        );
    }

    return (
        <section className="account-details-page">
            <div className="account-details-header">
                <h1>Account Details</h1>

                <Link
                    href={ROUTES.clientDetails(account.clientId)}
                    className="client-details-edit-button"
                >
                    <span className="material-symbols-rounded">
                        account_box
                    </span>
                    View Client
                </Link>
            </div>

            <div className="account-details-layout">
                <div className="client-details-card">
                    <h2>Account Information</h2>

                    <div className="client-information-list">
                        <div className="client-information-row">
                            <span>Account ID</span>
                            <strong>{account.accountId}</strong>
                        </div>

                        <div className="client-information-row">
                            <span>Account Number</span>
                            <strong>{account.accountNumber}</strong>
                        </div>

                        <div className="client-information-row">
                            <span>Client</span>
                            <Link href={ROUTES.clientDetails(account.clientId)}>
                                {account.companyName}
                            </Link>
                        </div>

                        <div className="client-information-row">
                            <span>Account Type</span>
                            <strong>{account.accountType}</strong>
                        </div>

                        <div className="client-information-row">
                            <span>Currency</span>
                            <strong>{account.currency}</strong>
                        </div>

                        <div className="client-information-row">
                            <span>Balance</span>
                            <strong>{formatBalance(account.balanceMinor)}</strong>
                        </div>

                        <div className="client-information-row">
                            <span>Status</span>
                            <div>
                                <span
                                    className={`accounts-status-badge ${account.status.toLowerCase()}`}
                                >
                                    {account.status}
                                </span>
                            </div>
                        </div>

                        <div className="client-information-row">
                            <span>Created At</span>
                            <strong>{formatDate(account.createdAt)}</strong>
                        </div>
                    </div>
                </div>

                <div className="account-details-sidebar">
                    <div className="client-details-card">
                        <h2>Quick Actions</h2>

                        <div className="client-quick-actions">
                            <Link href={ROUTES.clientDetails(account.clientId)}>
                                <span className="material-symbols-rounded">
                                    open_in_new
                                </span>
                                View Client
                            </Link>
                        </div>
                    </div>

                    <div className="client-details-card">
                        <h2>Account Summary</h2>

                        <div className="account-summary-list">
                            <div>
                                <span>Account Type</span>
                                <strong>{account.accountType}</strong>
                            </div>

                            <div>
                                <span>Currency</span>
                                <strong>{account.currency}</strong>
                            </div>

                            <div>
                                <span>Current Balance</span>
                                <strong>{formatBalance(account.balanceMinor)}</strong>
                            </div>

                            <div>
                                <span>Status</span>
                                <span
                                    className={`accounts-status-badge ${account.status.toLowerCase()}`}
                                >
                                    {account.status}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}