"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    TransactionFilters,
    TransactionListResult,
    getTransactions
} from "@/services/transactions";
import {
    Account,
    getAccounts
} from "@/services/accounts";
import { ROUTES, PAGINATION, ENUMS } from "../../../config";

export default function TransactionsPage() {
    const [result, setResult] = useState<TransactionListResult | null>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [filters, setFilters] = useState<TransactionFilters>({
        search: "",
        sourceAccountId: "",
        status: "",
        dateFrom: "",
        dateTo: "",
        page: PAGINATION.DEFAULT_PAGE,
        pageSize: PAGINATION.DEFAULT_PAGE_SIZE
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [accountsError, setAccountsError] = useState("");

    useEffect(() => {
        let active = true;

        getAccounts()
            .then(data => {
                if (active) setAccounts(data);
            })
            .catch(err => {
                if (active) {
                    setAccountsError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load accounts"
                    );
                }
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;

        async function loadTransactions() {
            setLoading(true);
            setError("");

            try {
                const data = await getTransactions(filters);

                if (active) setResult(data);
            } catch (err) {
                if (active) {
                    setResult(null);
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load transactions"
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        loadTransactions();

        return () => {
            active = false;
        };
    }, [filters]);

    function changeFilter(
        field: keyof TransactionFilters,
        value: string
    ) {
        setFilters(previous => ({
            ...previous,
            [field]: value,
            page: PAGINATION.DEFAULT_PAGE
        }));
    }

    function changePage(page: number) {
        setFilters(previous => ({
            ...previous,
            page
        }));
    }

    function changePageSize(pageSize: number) {
        setFilters(previous => ({
            ...previous,
            pageSize,
            page: PAGINATION.DEFAULT_PAGE
        }));
    }

    function clearFilters() {
        setFilters(previous => ({
            ...previous,
            search: "",
            sourceAccountId: "",
            status: "",
            dateFrom: "",
            dateTo: "",
            page: PAGINATION.DEFAULT_PAGE
        }));
    }

    function formatAmount(amountMinor: number) {
        return (amountMinor / 100).toLocaleString("en-CA", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatDate(value: string) {
        return new Date(value).toLocaleDateString("en-CA", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    const total = result?.pagination.total ?? 0;
    const totalPages = result?.pagination.totalPages ?? 0;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE;
    const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    const pages = Array.from(
        { length: totalPages },
        (_, index) => index + 1
    );

    const hasFilters = Boolean(
        filters.search ||
        filters.sourceAccountId ||
        filters.status ||
        filters.dateFrom ||
        filters.dateTo
    );

    return (
        <section className="transactions-directory">
            <div className="transactions-page-header">
                <div>
                    <h1>Transaction History</h1>
                    <p>Search and review historical financial activity</p>
                </div>

                <span className="transactions-readonly-label">
                    <span className="material-symbols-rounded">
                        visibility
                    </span>
                    Read Only
                </span>
            </div>

            <div className="transactions-filter-bar">
                <div className="clients-search">
                    <span className="material-symbols-rounded">
                        search
                    </span>
                    <input
                        type="search"
                        placeholder="Search by reference number..."
                        aria-label="Search transactions"
                        value={filters.search ?? ""}
                        onChange={event =>
                            changeFilter("search", event.target.value)
                        }
                    />
                </div>

                <select
                    className="clients-filter-select"
                    aria-label="Source account"
                    value={filters.sourceAccountId ?? ""}
                    onChange={event =>
                        changeFilter("sourceAccountId", event.target.value)
                    }
                >
                    <option value="">All Source Accounts</option>
                    {accounts.map(account => (
                        <option
                            key={account.accountId}
                            value={account.accountId}
                        >
                            {account.accountNumber}
                        </option>
                    ))}
                </select>

                <select
                    className="clients-filter-select"
                    aria-label="Transaction status"
                    value={filters.status ?? ""}
                    onChange={event =>
                        changeFilter("status", event.target.value)
                    }
                >
                    <option value="">All Statuses</option>
                    {ENUMS.TRANSACTION_STATUSES.map(status => (
                        <option key={status} value={status}>
                            {status}
                        </option>
                    ))}
                </select>

                <label className="transactions-date-field">
                    <span>From</span>
                    <input
                        type="date"
                        value={filters.dateFrom ?? ""}
                        onChange={event =>
                            changeFilter("dateFrom", event.target.value)
                        }
                    />
                </label>

                <label className="transactions-date-field">
                    <span>To</span>
                    <input
                        type="date"
                        value={filters.dateTo ?? ""}
                        onChange={event =>
                            changeFilter("dateTo", event.target.value)
                        }
                    />
                </label>

                <button
                    type="button"
                    className="clients-clear-button"
                    disabled={!hasFilters}
                    onClick={clearFilters}
                >
                    <span className="material-symbols-rounded">
                        restart_alt
                    </span>
                    Clear
                </button>
            </div>

            {accountsError && (
                <p role="alert" className="transactions-filter-error">
                    {accountsError}
                </p>
            )}

            <div className="transactions-table-scroll">
                <table className="transactions-data-table">
                    <thead>
                        <tr>
                            <th>Reference #</th>
                            <th>Date</th>
                            <th>Source Account</th>
                            <th>Destination Account</th>
                            <th>Amount</th>
                            <th>Currency</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="clients-message">
                                    Loading transactions...
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="clients-message clients-error"
                                >
                                    {error}
                                </td>
                            </tr>
                        ) : result?.data.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="clients-message">
                                    No transactions match your search or filters.
                                </td>
                            </tr>
                        ) : (
                            result?.data.map(transaction => (
                                <tr key={transaction.transactionId}>
                                    <td>
                                        <Link
                                            href={ROUTES.transactionDetails(transaction.transactionId)}
                                            className="accounts-number-link"
                                        >
                                            {transaction.referenceNumber}
                                        </Link>
                                    </td>
                                    <td>{formatDate(transaction.createdAt)}</td>
                                    <td>{transaction.sourceAccountNumber}</td>
                                    <td>{transaction.destinationAccountNumber}</td>
                                    <td className="transactions-amount">
                                        {formatAmount(transaction.amountMinor)}
                                    </td>
                                    <td>{transaction.currency}</td>
                                    <td>
                                        <span
                                            className={`transaction-history-status ${transaction.status.toLowerCase()}`}
                                        >
                                            {transaction.status}
                                        </span>
                                    </td>
                                    <td>
                                        <Link
                                            href={ROUTES.transactionDetails(transaction.transactionId)}
                                            className="clients-view-button"
                                        >
                                            <span className="material-symbols-rounded">
                                                visibility
                                            </span>
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="transactions-table-footer">
                <p>
                    Showing {start} to {end} of {total} transactions
                </p>

                <div className="clients-pagination">
                    <button
                        type="button"
                        className="clients-page-button"
                        disabled={page <= 1 || loading}
                        onClick={() => changePage(page - 1)}
                        aria-label="Previous page"
                    >
                        <span className="material-symbols-rounded">
                            chevron_left
                        </span>
                    </button>

                    <div className="clients-page-numbers">
                        {pages.map(number => (
                            <button
                                key={number}
                                type="button"
                                className={`clients-page-button ${page === number ? "selected" : ""
                                    }`}
                                disabled={loading}
                                onClick={() => changePage(number)}
                            >
                                {number}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        className="clients-page-button"
                        disabled={page >= totalPages || loading}
                        onClick={() => changePage(page + 1)}
                        aria-label="Next page"
                    >
                        <span className="material-symbols-rounded">
                            chevron_right
                        </span>
                    </button>

                    <select
                        className="clients-page-size"
                        aria-label="Transactions per page"
                        value={pageSize}
                        onChange={event =>
                            changePageSize(Number(event.target.value))
                        }
                    >
                        {PAGINATION.PAGE_SIZE_OPTIONS.map(size => (
                            <option key={size} value={size}>
                                {size} / page
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </section>
    );
}
