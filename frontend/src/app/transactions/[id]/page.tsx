"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
    TransactionDetails,
    getTransaction,
    processTransaction
} from "@/services/transactions";
import { formatMoney } from "@/services/accounts";
import { ROUTES } from "../../../../config";

interface Props {
    params: Promise<{ id: string }>;
}

export default function TransactionDetailsPage({ params }: Props) {
    const { id } = use(params);

    const [transaction, setTransaction] =
        useState<TransactionDetails | null>(null);

    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");
    const [processingError, setProcessingError] = useState("");

    const processingRef = useRef(false);

    useEffect(() => {
        let active = true;

        async function loadTransaction() {
            setLoading(true);
            setError("");

            try {
                const result = await getTransaction(id);

                if (active) {
                    setTransaction(result);
                }
            } catch (err) {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load transaction details"
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadTransaction();

        return () => {
            active = false;
        };
    }, [id]);

    function formatDate(value?: string | null) {
        if (!value) return "Not available";

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

    async function handleProcessTransaction() {
        if (
            processingRef.current ||
            !transaction ||
            transaction.status !== "Pending" ||
            transaction.isLegacy !== false
        ) {
            return;
        }

        processingRef.current = true;
        setProcessing(true);
        setProcessingError("");

        try {
            const result = await processTransaction(
                transaction.transactionId
            );

            try {
                const updated = await getTransaction(
                    transaction.transactionId
                );

                setTransaction(updated);
            } catch {
                setTransaction(previous => previous
                    ? { ...previous, ...result }
                    : previous
                );
            }
        } catch (err) {
            setProcessingError(
                err instanceof Error
                    ? err.message
                    : "Unable to process transaction"
            );

            try {
                const updated = await getTransaction(id);
                setTransaction(updated);
            } catch {
            }
        } finally {
            processingRef.current = false;
            setProcessing(false);
        }
    }

    if (loading) {
        return (
            <section className="transaction-details-page">
                <p role="status">
                    Loading transaction details...
                </p>
            </section>
        );
    }

    if (error || !transaction) {
        return (
            <section className="transaction-details-page">
                <p
                    role="alert"
                    className="client-details-error"
                >
                    {error || "Transaction not found"}
                </p>

                <Link
                    href={ROUTES.transactions}
                    className="transaction-back-link"
                >
                    Back to Transactions
                </Link>
            </section>
        );
    }

    const canProcess =
        transaction.status === "Pending" &&
        transaction.isLegacy === false;

    const isCompleted = transaction.status === "Completed";
    const isRejected = transaction.status === "Rejected";
    const isProcessing = transaction.status === "Processing";

    const isProtectedLegacy =
        transaction.isLegacy === true;

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

            {processingError && (
                <p
                    role="alert"
                    className="client-details-error"
                >
                    {processingError}
                </p>
            )}

            <div className="transaction-details-layout">

                <div className="client-details-card">
                    <h2>Transaction Information</h2>

                    <div className="client-information-list">

                        <div className="client-information-row">
                            <span>Transaction ID</span>
                            <strong>
                                {transaction.transactionId}
                            </strong>
                        </div>

                        <div className="client-information-row">
                            <span>Reference Number</span>
                            <strong>
                                {transaction.referenceNumber}
                            </strong>
                        </div>

                        <div className="client-information-row">
                            <span>Transaction Type</span>
                            <strong>
                                {transaction.transactionType}
                            </strong>
                        </div>

                        <div className="client-information-row">
                            <span>Amount</span>
                            <strong>
                                {formatMoney(
                                    transaction.amountMinor,
                                    transaction.currency
                                )}
                            </strong>
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
                            <strong>
                                {transaction.description ||
                                    "Not provided"}
                            </strong>
                        </div>

                        <div className="client-information-row">
                            <span>Created At</span>
                            <strong>
                                {formatDate(transaction.createdAt)}
                            </strong>
                        </div>

                        <div className="client-information-row">
                            <span>Updated At</span>
                            <strong>
                                {formatDate(transaction.updatedAt)}
                            </strong>
                        </div>

                        <div className="client-information-row">
                            <span>Processed At</span>
                            <strong>
                                {formatDate(transaction.processedAt)}
                            </strong>
                        </div>

                        <div className="client-information-row">
                            <span>Legacy Transaction</span>
                            <strong>
                                {transaction.isLegacy
                                    ? "Yes"
                                    : "No"}
                            </strong>
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
                                    href={ROUTES.accountDetails(
                                        transaction.sourceAccount.accountId
                                    )}
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
                                    href={ROUTES.accountDetails(
                                        transaction.destinationAccount.accountId
                                    )}
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
                                <strong>
                                    {transaction.transactionType}
                                </strong>
                            </div>

                            <div>
                                <span>Currency</span>
                                <strong>
                                    {transaction.currency}
                                </strong>
                            </div>

                            <div>
                                <span>Amount</span>
                                <strong>
                                    {formatMoney(
                                        transaction.amountMinor,
                                        transaction.currency
                                    )}
                                </strong>
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

                    <div className="client-details-card">
                        <h2>Processing Outcome</h2>

                        {canProcess && (
                            <div className="transaction-processing-section">
                                <p>
                                    This transaction is Pending and
                                    has not been processed.
                                </p>

                                <button
                                    type="button"
                                    className="corporate-submit-button"
                                    disabled={processing}
                                    onClick={handleProcessTransaction}
                                >
                                    <span className="material-symbols-rounded">
                                        sync
                                    </span>

                                    {processing
                                        ? "Processing..."
                                        : "Process Transaction"}
                                </button>
                            </div>
                        )}

                        {isCompleted && (
                            <div className="transaction-processing-outcome completed">
                                <span className="material-symbols-rounded">
                                    check_circle
                                </span>

                                <strong>
                                    Transaction Completed
                                </strong>

                                <p>
                                    The transfer was processed
                                    successfully. The source account
                                    was debited and the destination
                                    account was credited.
                                </p>

                                <small>
                                    Processed:{" "}
                                    {formatDate(transaction.processedAt)}
                                </small>
                            </div>
                        )}

                        {isRejected && (
                            <div className="transaction-processing-outcome rejected">
                                <span className="material-symbols-rounded">
                                    cancel
                                </span>

                                <strong>
                                    Transaction Rejected
                                </strong>

                                <p>
                                    The transaction was not completed.
                                    No account balances were changed.
                                </p>

                                <div className="transaction-rejection-details">
                                    <span>Rejection Code</span>
                                    <strong>
                                        {transaction.rejectionCode ||
                                            "Not available"}
                                    </strong>

                                    <span>Rejection Reason</span>
                                    <strong>
                                        {transaction.rejectionReason ||
                                            "Not available"}
                                    </strong>
                                </div>

                                <small>
                                    Processed:{" "}
                                    {formatDate(transaction.processedAt)}
                                </small>
                            </div>
                        )}

                        {isProcessing && (
                            <div className="transaction-processing-section">
                                <p>
                                    This transaction is currently
                                    marked as Processing.
                                </p>
                            </div>
                        )}

                        {isProtectedLegacy &&
                            !isCompleted &&
                            !isRejected &&
                            !isProcessing && (
                                <div className="transaction-processing-section">
                                    <p>
                                        This is a legacy transaction
                                        imported from Assignment 1.
                                        It cannot be processed.
                                    </p>
                                </div>
                            )}
                    </div>
                </div>
            </div>
        </section>
    );
}