"use client";

import {
    use,
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";
import Link from "next/link";
import {
    TransactionDetails,
    getTransaction,
    processTransaction
} from "@/services/transactions";
import {
    AccountDetails,
    getAccount,
    formatMoney
} from "@/services/accounts";
import { ROUTES } from "../../../../config";

interface Props {
    params: Promise<{ id: string }>;
}

interface AccountInformation {
    companyName: string;
    accountType: string;
}

function formatDate(value?: string | null) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function StatusBadge({ status }: { status: string }) {
    return (
        <span
            className={`transaction-profile-status ${status.toLowerCase()}`}
        >
            {status}
        </span>
    );
}

function InformationRow({
    label,
    children
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="transaction-profile-info-row">
            <span className="transaction-profile-info-label">
                {label}
            </span>

            <div className="transaction-profile-info-value">
                {children}
            </div>
        </div>
    );
}

function RelatedAccount({
    label,
    account,
    information
}: {
    label: string;
    account: TransactionDetails["sourceAccount"];
    information?: AccountInformation;
}) {
    return (
        <div className="transaction-profile-related-account">
            <span className="transaction-profile-related-label">
                {label}
            </span>

            <div className="transaction-profile-account-icon">
                <span className="material-symbols-rounded">
                    account_balance
                </span>
            </div>

            <div className="transaction-profile-account-content">
                <Link
                    href={ROUTES.accountDetails(account.accountId)}
                    className="transaction-profile-account-number"
                >
                    {account.accountNumber}
                </Link>

                {information?.companyName && (
                    <span className="transaction-profile-account-company">
                        {information.companyName}
                    </span>
                )}

                {information?.accountType && (
                    <span className="transaction-profile-account-type">
                        {information.accountType} Account
                    </span>
                )}
            </div>
        </div>
    );
}

export default function TransactionDetailsPage({ params }: Props) {
    const { id } = use(params);

    const [transaction, setTransaction] =
        useState<TransactionDetails | null>(null);

    const [accountInformation, setAccountInformation] = useState<
        Record<string, AccountInformation>
    >({});

    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [processingError, setProcessingError] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const processingRef = useRef(false);

    const loadTransaction = useCallback(async () => {
        const result = await getTransaction(id);

        setTransaction(result);

        return result;
    }, [id]);

    useEffect(() => {
        let active = true;

        async function loadDetails() {
            setLoading(true);
            setError("");
            setAccountInformation({});

            try {
                const result = await getTransaction(id);

                if (!active) return;

                setTransaction(result);

                const accountIds = [
                    result.sourceAccount.accountId,
                    result.destinationAccount.accountId
                ];

                const uniqueAccountIds = [...new Set(accountIds)];

                const accountResults = await Promise.allSettled(
                    uniqueAccountIds.map(accountId =>
                        getAccount(accountId)
                    )
                );

                if (!active) return;

                const information: Record<
                    string,
                    AccountInformation
                > = {};

                accountResults.forEach((entry, index) => {
                    if (entry.status === "fulfilled") {
                        const account: AccountDetails = entry.value;

                        information[uniqueAccountIds[index]] = {
                            companyName: account.companyName,
                            accountType: account.accountType
                        };
                    }
                });

                setAccountInformation(information);
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

        loadDetails();

        return () => {
            active = false;
        };
    }, [id]);

    async function handleRefresh() {
        if (refreshing || processing) return;

        setRefreshing(true);
        setProcessingError("");
        setMenuOpen(false);

        try {
            await loadTransaction();
        } catch (err) {
            setProcessingError(
                err instanceof Error
                    ? err.message
                    : "Unable to refresh transaction"
            );
        } finally {
            setRefreshing(false);
        }
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
                await loadTransaction();
            } catch {
                setTransaction(previous =>
                    previous
                        ? { ...previous, ...result }
                        : result
                );
            }
        } catch (err) {
            setProcessingError(
                err instanceof Error
                    ? err.message
                    : "Unable to process transaction"
            );

            try {
                await loadTransaction();
            } catch {
                setProcessingError(previous =>
                    `${previous} Unable to refresh the transaction status.`
                );
            }
        } finally {
            processingRef.current = false;
            setProcessing(false);
        }
    }

    async function handleCopyReference() {
        if (!transaction) return;

        try {
            await navigator.clipboard.writeText(
                transaction.referenceNumber
            );

            setCopied(true);
        } catch {
            setProcessingError(
                "Unable to copy the transaction reference."
            );
        } finally {
            setMenuOpen(false);
        }
    }

    function handlePrint() {
        setMenuOpen(false);
        window.print();
    }

    if (loading) {
        return (
            <section className="transaction-profile-page">
                <p className="transaction-profile-message" role="status">
                    Loading transaction details...
                </p>
            </section>
        );
    }

    if (error || !transaction) {
        return (
            <section className="transaction-profile-page">
                <div className="transaction-profile-error" role="alert">
                    {error || "Transaction not found."}
                </div>

                <Link
                    href={ROUTES.transactions}
                    className="transaction-profile-outline-button"
                >
                    Back to Transactions
                </Link>
            </section>
        );
    }

    const isPending = transaction.status === "Pending";
    const isProcessing = transaction.status === "Processing";
    const isCompleted = transaction.status === "Completed";
    const isRejected = transaction.status === "Rejected";

    const canProcess =
        isPending &&
        transaction.isLegacy === false &&
        !processing &&
        !refreshing;

    return (
        <section className="transaction-profile-page">
            <div className="transaction-profile-toolbar">
                <nav
                    className="transaction-profile-breadcrumb"
                    aria-label="Breadcrumb"
                >
                    <Link href={ROUTES.transactions}>
                        <span className="material-symbols-rounded">
                            home
                        </span>
                        Transactions
                    </Link>

                    <span className="material-symbols-rounded">
                        chevron_right
                    </span>

                    <span>{transaction.referenceNumber}</span>
                </nav>

                <div className="transaction-profile-toolbar-actions">
                    {isPending && !transaction.isLegacy ? (
                        <Link
                            href={ROUTES.transactionCreate}
                            className="transaction-profile-primary-button"
                        >
                            <span className="material-symbols-rounded">
                                add
                            </span>
                            Create Transaction
                        </Link>
                    ) : (
                        <button
                            type="button"
                            className="transaction-profile-outline-button"
                            onClick={handlePrint}
                        >
                            <span className="material-symbols-rounded">
                                print
                            </span>
                            Print
                        </button>
                    )}

                    <div className="transaction-profile-menu-container">
                        <button
                            type="button"
                            className="transaction-profile-menu-button"
                            aria-label="More transaction actions"
                            aria-expanded={menuOpen}
                            onClick={() =>
                                setMenuOpen(previous => !previous)
                            }
                        >
                            <span className="material-symbols-rounded">
                                more_horiz
                            </span>
                        </button>

                        {menuOpen && (
                            <div className="transaction-profile-menu">
                                <button
                                    type="button"
                                    onClick={handleCopyReference}
                                >
                                    <span className="material-symbols-rounded">
                                        content_copy
                                    </span>
                                    Copy Reference
                                </button>

                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    disabled={refreshing || processing}
                                >
                                    <span className="material-symbols-rounded">
                                        refresh
                                    </span>
                                    Refresh Status
                                </button>

                                <Link href={ROUTES.transactions}>
                                    <span className="material-symbols-rounded">
                                        list
                                    </span>
                                    All Transactions
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="transaction-profile-heading">
                <div className="transaction-profile-heading-icon">
                    <span className="material-symbols-rounded">
                        account_balance
                    </span>
                </div>

                <h1>
                    Transaction {transaction.referenceNumber}
                </h1>

                <StatusBadge status={transaction.status} />
            </div>

            {copied && (
                <p
                    className="transaction-profile-copy-message"
                    role="status"
                >
                    Transaction reference copied.
                </p>
            )}

            {processingError && (
                <div
                    className="transaction-profile-error"
                    role="alert"
                >
                    <span className="material-symbols-rounded">
                        error
                    </span>
                    {processingError}
                </div>
            )}

            <div className="transaction-profile-layout">
                <section className="transaction-profile-card">
                    <h2>Transaction Information</h2>

                    <div className="transaction-profile-information">
                        <InformationRow label="Transaction ID">
                            {transaction.transactionId}
                        </InformationRow>

                        <InformationRow label="Reference Number">
                            {transaction.referenceNumber}
                        </InformationRow>

                        <InformationRow label="Type">
                            {transaction.transactionType || "Transfer"}
                        </InformationRow>

                        <InformationRow label="Amount">
                            {formatMoney(
                                transaction.amountMinor,
                                transaction.currency
                            )}{" "}
                            {transaction.currency}
                        </InformationRow>

                        <InformationRow label="Description">
                            {transaction.description || "—"}
                        </InformationRow>

                        <InformationRow label="Status">
                            <StatusBadge status={transaction.status} />
                        </InformationRow>

                        <InformationRow label="Created At">
                            {formatDate(transaction.createdAt)}
                        </InformationRow>

                        <InformationRow label="Processed At">
                            {formatDate(transaction.processedAt)}
                        </InformationRow>

                        <InformationRow label="Rejection Code">
                            {transaction.rejectionCode || "—"}
                        </InformationRow>

                        <InformationRow label="Rejection Reason">
                            {transaction.rejectionReason || "—"}
                        </InformationRow>
                    </div>
                </section>

                <div className="transaction-profile-sidebar">
                    <section className="transaction-profile-card transaction-profile-accounts-card">
                        <h2>Account Details</h2>

                        <div className="transaction-profile-accounts">
                            <RelatedAccount
                                label="From Account"
                                account={transaction.sourceAccount}
                                information={
                                    accountInformation[
                                        transaction.sourceAccount.accountId
                                    ]
                                }
                            />

                            <RelatedAccount
                                label="To Account"
                                account={transaction.destinationAccount}
                                information={
                                    accountInformation[
                                        transaction.destinationAccount.accountId
                                    ]
                                }
                            />
                        </div>
                    </section>

                    <section className="transaction-profile-card transaction-profile-processing-card">
                        <h2>
                            {isPending
                                ? "Processing Actions"
                                : "Processing Result"}
                        </h2>

                        {isPending && !transaction.isLegacy && (
                            <div className="transaction-profile-outcome pending">
                                <div className="transaction-profile-outcome-content">
                                    <span className="material-symbols-rounded">
                                        schedule
                                    </span>

                                    <p>
                                        This transaction is pending.
                                        Click the button below to
                                        validate and process the transfer.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="transaction-profile-process-button"
                                    disabled={!canProcess}
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

                        {isPending && transaction.isLegacy && (
                            <div className="transaction-profile-outcome pending">
                                <div className="transaction-profile-outcome-content">
                                    <span className="material-symbols-rounded">
                                        info
                                    </span>

                                    <p>
                                        This is a legacy pending transaction.
                                        Processing is not available.
                                    </p>
                                </div>
                            </div>
                        )}

                        {isCompleted && (
                            <div className="transaction-profile-outcome completed">
                                <div className="transaction-profile-outcome-content">
                                    <span className="material-symbols-rounded">
                                        check_circle
                                    </span>

                                    <p>
                                        This transaction was processed
                                        successfully. Both account
                                        balances have been updated.
                                    </p>
                                </div>
                            </div>
                        )}

                        {isRejected && (
                            <div className="transaction-profile-outcome rejected">
                                <div className="transaction-profile-outcome-content">
                                    <span className="material-symbols-rounded">
                                        cancel
                                    </span>

                                    <p>
                                        This transaction was rejected.
                                        No account balances have been
                                        changed.
                                    </p>
                                </div>
                            </div>
                        )}

                        {isProcessing && (
                            <div className="transaction-profile-outcome processing">
                                <div className="transaction-profile-outcome-content">
                                    <span className="material-symbols-rounded">
                                        schedule
                                    </span>

                                    <p>
                                        This transaction is currently
                                        being processed. Please check
                                        again shortly.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="transaction-profile-refresh-button"
                                    disabled={refreshing || processing}
                                    onClick={handleRefresh}
                                >
                                    <span className="material-symbols-rounded">
                                        refresh
                                    </span>

                                    {refreshing
                                        ? "Refreshing..."
                                        : "Refresh Status"}
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </section>
    );
}