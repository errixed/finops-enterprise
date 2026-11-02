"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    TransactionFilters,
    TransactionListResult,
    getTransactions
} from "@/services/transactions";
import { ENUMS, ROUTES } from "../../../config";

const PAGE_SIZE = 5;

function getVisiblePages(
    currentPage: number,
    totalPages: number
): (number | "ellipsis")[] {
    if (totalPages <= 6) {
        return Array.from(
            { length: totalPages },
            (_, index) => index + 1
        );
    }

    if (currentPage <= 4) {
        return [1, 2, 3, 4, 5, "ellipsis", totalPages];
    }

    if (currentPage >= totalPages - 3) {
        return [
            1,
            "ellipsis",
            ...Array.from(
                { length: 5 },
                (_, index) => totalPages - 4 + index
            )
        ];
    }

    return [
        1,
        "ellipsis",
        currentPage - 1,
        currentPage,
        currentPage + 1,
        "ellipsis",
        totalPages
    ];
}

function formatDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
    });
}

function formatAmount(amountMinor: number) {
    return (amountMinor / 100).toLocaleString("en-CA", {
        style: "currency",
        currency: "CAD"
    });
}

export default function TransactionsPage() {
    const [result, setResult] =
        useState<TransactionListResult | null>(null);

    const [filters, setFilters] = useState<TransactionFilters>({
        search: "",
        status: "",
        currency: "",
        dateFrom: "",
        dateTo: "",
        page: 1,
        pageSize: PAGE_SIZE
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [searchInput, setSearchInput] = useState("");

    useEffect(() => {
        const timeout = setTimeout(() => {
            setFilters(previous => ({
                ...previous,
                search: searchInput,
                page: 1
            }));
        }, 300);

        return () => clearTimeout(timeout);
    }, [searchInput]);

    useEffect(() => {
        let active = true;

        async function loadTransactions() {
            setLoading(true);
            setError("");

            try {
                const data = await getTransactions(filters);

                if (active) {
                    setResult(data);
                }
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
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadTransactions();

        return () => {
            active = false;
        };
    }, [filters]);

    function changeFilter(
        field: "status" | "currency" | "dateFrom" | "dateTo",
        value: string
    ) {
        setFilters(previous => ({
            ...previous,
            [field]: value,
            page: 1
        }));
    }

    function changePage(page: number) {
        setFilters(previous => ({
            ...previous,
            page
        }));
    }

    function clearFilters() {
        setSearchInput("");

        setFilters({
            search: "",
            status: "",
            currency: "",
            dateFrom: "",
            dateTo: "",
            page: 1,
            pageSize: PAGE_SIZE
        });
    }

    const total = result?.pagination.total ?? 0;
    const totalPages = result?.pagination.totalPages ?? 0;
    const page = filters.page ?? 1;

    const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);

    const visiblePages = useMemo(
        () => getVisiblePages(page, totalPages),
        [page, totalPages]
    );

    const hasFilters = Boolean(
        searchInput ||
        filters.status ||
        filters.currency ||
        filters.dateFrom ||
        filters.dateTo
    );

    const invalidDateRange = Boolean(
        filters.dateFrom &&
        filters.dateTo &&
        filters.dateFrom > filters.dateTo
    );

    return (
        <section className="transaction-directory">
            <div className="transaction-directory-header">
                <h1>Financial Transactions</h1>

                <Link
                    href={ROUTES.transactionCreate}
                    className="transaction-directory-create"
                >
                    <span className="material-symbols-rounded">
                        add
                    </span>
                    Create Transfer
                </Link>
            </div>

            <div className="transaction-directory-filters">
                <div className="transaction-directory-search">
                    <span className="material-symbols-rounded">
                        search
                    </span>

                    <input
                        type="search"
                        aria-label="Search transactions"
                        placeholder="Search by reference number, account number..."
                        value={searchInput}
                        onChange={event =>
                            setSearchInput(event.target.value)
                        }
                    />
                </div>

                <div className="transaction-directory-field">
                    <label htmlFor="transaction-status">
                        Status
                    </label>

                    <select
                        id="transaction-status"
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
                </div>

                <div className="transaction-directory-field">
                    <label htmlFor="transaction-currency">
                        Currency
                    </label>

                    <select
                        id="transaction-currency"
                        value={filters.currency ?? ""}
                        onChange={event =>
                            changeFilter("currency", event.target.value)
                        }
                    >
                        <option value="">All Currencies</option>

                        {ENUMS.CURRENCIES.map(currency => (
                            <option key={currency} value={currency}>
                                {currency}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="transaction-directory-field transaction-directory-date">
                    <label htmlFor="transaction-from-date">
                        From Date
                    </label>

                    <input
                        id="transaction-from-date"
                        type="date"
                        value={filters.dateFrom ?? ""}
                        max={filters.dateTo || undefined}
                        onChange={event =>
                            changeFilter("dateFrom", event.target.value)
                        }
                    />
                </div>

                <div className="transaction-directory-field transaction-directory-date">
                    <label htmlFor="transaction-to-date">
                        To Date
                    </label>

                    <input
                        id="transaction-to-date"
                        type="date"
                        value={filters.dateTo ?? ""}
                        min={filters.dateFrom || undefined}
                        onChange={event =>
                            changeFilter("dateTo", event.target.value)
                        }
                    />
                </div>
            </div>

            {hasFilters && (
                <button
                    type="button"
                    className="transaction-directory-clear"
                    onClick={clearFilters}
                >
                    <span className="material-symbols-rounded">
                        restart_alt
                    </span>
                    Clear Filters
                </button>
            )}

            {invalidDateRange && (
                <p className="transaction-directory-error" role="alert">
                    From Date cannot be later than To Date.
                </p>
            )}

            <div className="transaction-directory-table-scroll">
                <table className="transaction-directory-table">
                    <thead>
                        <tr>
                            <th>Reference Number</th>
                            <th>Date</th>
                            <th>From Account</th>
                            <th>To Account</th>
                            <th>Amount</th>
                            <th>Currency</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="transaction-directory-message"
                                >
                                    Loading transactions...
                                </td>
                            </tr>
                        ) : error || invalidDateRange ? (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="transaction-directory-message transaction-directory-error"
                                    role="alert"
                                >
                                    {invalidDateRange
                                        ? "Invalid date range"
                                        : error}
                                </td>
                            </tr>
                        ) : !result?.data.length ? (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="transaction-directory-message"
                                >
                                    No transactions found.
                                </td>
                            </tr>
                        ) : (
                            result.data.map(transaction => (
                                <tr key={transaction.transactionId}>
                                    <td>
                                        <Link
                                            href={ROUTES.transactionDetails(
                                                transaction.transactionId
                                            )}
                                            className="transaction-directory-reference"
                                        >
                                            {transaction.referenceNumber}
                                        </Link>
                                    </td>

                                    <td>
                                        {formatDate(transaction.createdAt)}
                                    </td>

                                    <td>
                                        {transaction.sourceAccountNumber}
                                    </td>

                                    <td>
                                        {transaction.destinationAccountNumber}
                                    </td>

                                    <td className="transaction-directory-amount">
                                        {formatAmount(transaction.amountMinor)}
                                    </td>

                                    <td>{transaction.currency}</td>

                                    <td>
                                        <span
                                            className={`transaction-directory-status ${transaction.status.toLowerCase()}`}
                                        >
                                            {transaction.status}
                                        </span>
                                    </td>

                                    <td>
                                        <div className="transaction-directory-actions">
                                            <Link
                                                href={ROUTES.transactionDetails(
                                                    transaction.transactionId
                                                )}
                                                className="transaction-directory-icon"
                                                title="View Transaction"
                                                aria-label={`View transaction ${transaction.referenceNumber}`}
                                            >
                                                <span className="material-symbols-rounded">
                                                    visibility
                                                </span>
                                            </Link>

                                            <button
                                                type="button"
                                                className="transaction-directory-icon"
                                                title="Transaction editing is not available"
                                                aria-label={`Editing transaction ${transaction.referenceNumber} is not available`}
                                                disabled
                                            >
                                                <span className="material-symbols-rounded">
                                                    edit
                                                </span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="transaction-directory-footer">
                <p>
                    Showing {start}-{end} of {total} transactions
                </p>

                <nav
                    className="transaction-directory-pagination"
                    aria-label="Transaction pagination"
                >
                    <button
                        type="button"
                        className="transaction-directory-page-button"
                        disabled={page <= 1 || loading}
                        onClick={() => changePage(page - 1)}
                        aria-label="Previous page"
                    >
                        <span className="material-symbols-rounded">
                            chevron_left
                        </span>
                    </button>

                    {visiblePages.map((number, index) =>
                        number === "ellipsis" ? (
                            <span
                                key={`ellipsis-${index}`}
                                className="transaction-directory-ellipsis"
                            >
                                ...
                            </span>
                        ) : (
                            <button
                                key={number}
                                type="button"
                                className={`transaction-directory-page-button ${
                                    page === number ? "selected" : ""
                                }`}
                                aria-current={
                                    page === number ? "page" : undefined
                                }
                                disabled={loading}
                                onClick={() => changePage(number)}
                            >
                                {number}
                            </button>
                        )
                    )}

                    <button
                        type="button"
                        className="transaction-directory-page-button"
                        disabled={page >= totalPages || loading}
                        onClick={() => changePage(page + 1)}
                        aria-label="Next page"
                    >
                        <span className="material-symbols-rounded">
                            chevron_right
                        </span>
                    </button>
                </nav>
            </div>
        </section>
    );
}