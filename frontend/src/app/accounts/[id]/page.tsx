"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    AccountDetails,
    Transaction,
    formatMoney,
    getAccount
} from "@/services/accounts";
import { ROUTES } from "../../../../config";

interface Props {
    params: Promise<{ id: string }>;
}

type AccountTab = "overview" | "transactions" | "details";

function formatDate(value: string) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function formatDateTime(value: string) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function DetailRow({
    label,
    children
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="account-profile-info-row">
            <span>{label}</span>
            <div className="account-profile-info-value">
                {children}
            </div>
        </div>
    );
}

function AccountStatus({ status }: { status: string }) {
    return (
        <span className={`account-profile-status ${status.toLowerCase()}`}>
            {status}
        </span>
    );
}

function TransactionTable({
    transactions,
    accountId,
    currency
}: {
    transactions: Transaction[];
    accountId: string;
    currency: string;
}) {
    return (
        <div className="account-profile-table-scroll">
            <table className="account-profile-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Balance</th>
                    </tr>
                </thead>

                <tbody>
                    {transactions.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="account-profile-empty">
                                No transactions found for this account.
                            </td>
                        </tr>
                    ) : (
                        transactions.map(transaction => {
                            const incoming =
                                transaction.destinationAccountId === accountId;

                            const outgoing =
                                transaction.sourceAccountId === accountId;

                            const completed =
                                transaction.status === "Completed";

                            const signedAmount =
                                incoming
                                    ? transaction.amountMinor
                                    : outgoing
                                        ? -transaction.amountMinor
                                        : 0;

                            const amountClass =
                                completed
                                    ? incoming
                                        ? "positive"
                                        : "negative"
                                    : "neutral";

                            const formattedAmount = formatMoney(
                                Math.abs(signedAmount),
                                currency
                            );

                            const amountText =
                                `${completed && incoming ? "+" : completed && outgoing ? "-" : ""}${formattedAmount}`;

                            return (
                                <tr key={transaction.transactionId}>
                                    <td>
                                        {formatDate(transaction.createdAt)}
                                    </td>

                                    <td>
                                        <Link
                                            href={ROUTES.transactionDetails(
                                                transaction.transactionId
                                            )}
                                            className="account-profile-reference"
                                        >
                                            {transaction.referenceNumber}
                                        </Link>
                                    </td>

                                    <td>
                                        {transaction.transactionType ??
                                            "Transfer"}
                                    </td>

                                    <td>
                                        <div className="account-profile-amount-cell">
                                            <span
                                                className={`account-profile-amount ${amountClass}`}
                                            >
                                                {amountText}
                                            </span>

                                            {!completed && (
                                                <span className="account-profile-transaction-status">
                                                    {transaction.status}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    <td className="account-profile-history-balance">
                                        —
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default function AccountDetailsPage({ params }: Props) {
    const { id } = use(params);

    const [account, setAccount] = useState<AccountDetails | null>(null);
    const [activeTab, setActiveTab] = useState<AccountTab>("overview");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        async function loadAccount() {
            setLoading(true);
            setError("");

            try {
                const data = await getAccount(id);

                if (active) {
                    setAccount(data);
                }
            } catch (err) {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load account details"
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadAccount();

        return () => {
            active = false;
        };
    }, [id]);

    const transactions = useMemo(() => {
        return [...(account?.transactions ?? [])].sort(
            (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
        );
    }, [account]);

    if (loading) {
        return (
            <section className="account-profile-page">
                <p className="account-profile-message">
                    Loading account details...
                </p>
            </section>
        );
    }

    if (error || !account) {
        return (
            <section className="account-profile-page">
                <div className="account-profile-error" role="alert">
                    {error || "Account not found."}
                </div>

                <Link href={ROUTES.accounts}>
                    Back to Accounts
                </Link>
            </section>
        );
    }

    const tabs: { value: AccountTab; label: string }[] = [
        { value: "overview", label: "Overview" },
        { value: "transactions", label: "Transaction History" },
        { value: "details", label: "Account Details" }
    ];

    return (
        <section className="account-profile-page">
            <div className="account-profile-toolbar">
                <nav
                    className="account-profile-breadcrumb"
                    aria-label="Breadcrumb"
                >
                    <Link href={ROUTES.accounts}>
                        <span className="material-symbols-rounded">
                            home
                        </span>
                        Accounts
                    </Link>

                    <span className="material-symbols-rounded">
                        chevron_right
                    </span>

                    <span>{account.accountNumber}</span>
                </nav>

                <Link
                    href={ROUTES.clientDetails(account.clientId)}
                    className="account-profile-view-client"
                >
                    <span className="material-symbols-rounded">
                        visibility
                    </span>
                    View Client
                </Link>
            </div>

            <div className="account-profile-heading">
                <div className="account-profile-avatar">
                    <span className="material-symbols-rounded">
                        account_balance
                    </span>
                </div>

                <div className="account-profile-heading-body">
                    <div className="account-profile-title-row">
                        <h1>Account {account.accountNumber}</h1>
                        <AccountStatus status={account.status} />
                    </div>

                    <p>Account ID: {account.accountId}</p>
                </div>
            </div>

            <div
                className="account-profile-tabs"
                role="tablist"
                aria-label="Account information"
            >
                {tabs.map(tab => (
                    <button
                        key={tab.value}
                        id={`account-tab-${tab.value}`}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.value}
                        aria-controls={`account-panel-${tab.value}`}
                        className={`account-profile-tab ${activeTab === tab.value ? "selected" : ""
                            }`}
                        onClick={() => setActiveTab(tab.value)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === "overview" && (
                <div
                    id="account-panel-overview"
                    role="tabpanel"
                    aria-labelledby="account-tab-overview"
                    className="account-profile-overview"
                >
                    <section className="account-profile-card">
                        <h2>Account Information</h2>

                        <div className="account-profile-info-list">
                            <DetailRow label="Account Number">
                                {account.accountNumber}
                            </DetailRow>

                            <DetailRow label="Account Type">
                                {account.accountType}
                            </DetailRow>

                            <DetailRow label="Currency">
                                {account.currency}
                            </DetailRow>

                            <DetailRow label="Current Balance">
                                <strong className="account-profile-balance">
                                    {formatMoney(
                                        account.balanceMinor,
                                        account.currency
                                    )}
                                </strong>
                            </DetailRow>

                            <DetailRow label="Status">
                                <AccountStatus status={account.status} />
                            </DetailRow>

                            <DetailRow label="Client">
                                <Link
                                    href={ROUTES.clientDetails(
                                        account.clientId
                                    )}
                                >
                                    {account.companyName}
                                </Link>
                            </DetailRow>

                            <DetailRow label="Created At">
                                {formatDateTime(account.createdAt)}
                            </DetailRow>
                        </div>
                    </section>

                    <section className="account-profile-card account-profile-recent">
                        <h2>Recent Transactions</h2>

                        <TransactionTable
                            transactions={transactions.slice(0, 5)}
                            accountId={account.accountId}
                            currency={account.currency}
                        />

                        <div className="account-profile-card-footer">
                            <button
                                type="button"
                                className="account-profile-outline-button"
                                onClick={() => setActiveTab("transactions")}
                            >
                                View All Transactions
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === "transactions" && (
                <section
                    id="account-panel-transactions"
                    role="tabpanel"
                    aria-labelledby="account-tab-transactions"
                    className="account-profile-card account-profile-full-card"
                >
                    <div className="account-profile-section-heading">
                        <div>
                            <h2>Transaction History</h2>
                            <p>
                                {transactions.length} transactions associated
                                with account {account.accountNumber}
                            </p>
                        </div>

                        <Link
                            href={ROUTES.transactions}
                            className="account-profile-outline-button"
                        >
                            Transactions Directory
                        </Link>
                    </div>

                    <TransactionTable
                        transactions={transactions}
                        accountId={account.accountId}
                        currency={account.currency}
                    />

                    <p className="account-profile-history-note">
                        Historical balances are unavailable because
                        individual transaction balance snapshots are
                        not stored.
                    </p>
                </section>
            )}

            {activeTab === "details" && (
                <section
                    id="account-panel-details"
                    role="tabpanel"
                    aria-labelledby="account-tab-details"
                    className="account-profile-card account-profile-details-card"
                >
                    <h2>Account Details</h2>

                    <div className="account-profile-info-list">
                        <DetailRow label="Account ID">
                            {account.accountId}
                        </DetailRow>

                        <DetailRow label="Account Number">
                            {account.accountNumber}
                        </DetailRow>

                        <DetailRow label="Account Type">
                            {account.accountType}
                        </DetailRow>

                        <DetailRow label="Currency">
                            {account.currency}
                        </DetailRow>

                        <DetailRow label="Current Balance">
                            <strong className="account-profile-balance">
                                {formatMoney(
                                    account.balanceMinor,
                                    account.currency
                                )}
                            </strong>
                        </DetailRow>

                        <DetailRow label="Status">
                            <AccountStatus status={account.status} />
                        </DetailRow>

                        <DetailRow label="Client Name">
                            <Link
                                href={ROUTES.clientDetails(account.clientId)}
                            >
                                {account.companyName}
                            </Link>
                        </DetailRow>

                        <DetailRow label="Client ID">
                            {account.clientId}
                        </DetailRow>

                        <DetailRow label="Client Status">
                            {account.clientStatus}
                        </DetailRow>

                        <DetailRow label="Created At">
                            {formatDateTime(account.createdAt)}
                        </DetailRow>

                        <DetailRow label="Related Transactions">
                            {transactions.length}
                        </DetailRow>
                    </div>
                </section>
            )}
        </section>
    );
}