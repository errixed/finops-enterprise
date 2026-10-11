"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
    TransactionDetails,
    getTransaction
} from "@/services/transactions";
import { ROUTES } from "../../../../config";


interface Props {
    params: Promise<{ id: string }>;
}

export default function TransactionDetailsPage({ params }: Props) {
    const { id } = use(params);

    const [transaction, setTransaction] =
        useState<TransactionDetails | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        setLoading(true);
        setError("");

        getTransaction(id)
            .then(data => {
                if (active) setTransaction(data);
            })
            .catch(err => {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load transaction details"
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

    function formatAmount(amountMinor: number) {
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
            <section className="transaction-details-page">
                <p>Loading transaction details...</p>
            </section>
        );
    }

    if (error || !transaction) {
        return (
            <section className="transaction-details-page">
                <p role="alert" className="client-details-error">
                    {error || "Transaction not found"}
                </p>

                <Link href={ROUTES.transactions} className="transaction-back-link">
                    Back to Transactions
                </Link>
            </section>
        );
    }

    return (
        <section className="transaction-details-page">
            <div className="transaction-details-header">
                <div>
                    <h1>Transaction Details</h1>
                    <p>{transaction.referenceNumber}</p>
                </div>

                <Link
                    href={ROUTES.transactions}
                    className="client-details-edit-button"
                >
                    <span className="material-symbols-rounded">
                        arrow_back
                    </span>
                    Back to Transactions
                </Link>
            </div>

            <div className="transaction-details-layout">
                <div className="client-details-card">
                    <h2>Transaction Information</h2>

                    <div className="client-information-list">
                        <div className="client-information-row">
                            <span>Transaction ID</span>
                            <strong>{transaction.transactionId}</strong>
                        </div>

                        <div className="client-information-row">
                            <span>Reference Number</span>
                            <strong>{transaction.referenceNumber}</strong>
                        </div>

                        <div className="client-information-row">
                            <span>Transaction Type</span>
                            <strong>{transaction.transactionType}</strong>
                        </div>

                        <div className="client-information-row">
                            <span>Amount</span>
                            <strong>{formatAmount(transaction.amountMinor)}</strong>
                        </div>

                        <div className="client-information-row">
                            <span>Currency</span>
                            <strong>{transaction.currency}</strong>
                        </div>

                        <div className="client-information-row">
                            <span>Status</span>
                            <div>
                                <span
                                    className={`transaction-history-status ${transaction.status.toLowerCase()}`}
                                >
                                    {transaction.status}
                                </span>
                            </div>
                        </div>

                        <div className="client-information-row">
                            <span>Description</span>
                            <strong>{transaction.description || "Not provided"}</strong>
                        </div>

                        <div className="client-information-row">
                            <span>Created At</span>
                            <strong>{formatDate(transaction.createdAt)}</strong>
                        </div>
                    </div>
                </div>

                <div className="transaction-details-sidebar">
                    <div className="client-details-card">
                        <h2>Related Accounts</h2>

                        <div className="transaction-related-accounts">
                            <div>
                                <span>Source Account</span>
                                <Link
                                    href={ROUTES.accountDetails(transaction.sourceAccount.accountId)}
                                >
                                    {transaction.sourceAccount.accountNumber}
                                    <span className="material-symbols-rounded">
                                        open_in_new
                                    </span>
                                </Link>
                            </div>

                            <div>
                                <span>Destination Account</span>
                                <Link
                                    href={`/accounts/${transaction.destinationAccount.accountId}`}
                                >
                                    {transaction.destinationAccount.accountNumber}
                                    <span className="material-symbols-rounded">
                                        open_in_new
                                    </span>
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="client-details-card">
                        <h2>Transaction Summary</h2>

                        <div className="account-summary-list">
                            <div>
                                <span>Type</span>
                                <strong>{transaction.transactionType}</strong>
                            </div>

                            <div>
                                <span>Currency</span>
                                <strong>{transaction.currency}</strong>
                            </div>

                            <div>
                                <span>Amount</span>
                                <strong>{formatAmount(transaction.amountMinor)}</strong>
                            </div>

                            <div>
                                <span>Status</span>
                                <span
                                    className={`transaction-history-status ${transaction.status.toLowerCase()}`}
                                >
                                    {transaction.status}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
