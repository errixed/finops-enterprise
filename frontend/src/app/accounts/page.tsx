"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ROUTES, ENUMS } from "../../../config";
import {
    Account,
    AccountFilters,
    formatMoney,
    getAccounts
} from "@/services/accounts";
import {
    Client,
    getClients
} from "@/services/clients";

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

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [clients, setClients] = useState<Client[]>([]);

    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<AccountFilters>({
        clientId: "",
        accountType: "",
        currency: "",
        status: ""
    });

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        async function loadData() {
            setLoading(true);
            setError("");

            try {
                const [accountData, clientData] = await Promise.all([
                    getAccounts(),
                    getClients({ page: 1, pageSize: 100 })
                ]);

                if (active) {
                    setAccounts(accountData);
                    setClients(clientData.data);
                }
            } catch (err) {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load financial accounts"
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadData();

        return () => {
            active = false;
        };
    }, []);

    const filteredAccounts = useMemo(() => {
        const query = search.trim().toLowerCase();

        return accounts.filter(account => {
            const matchesSearch =
                !query ||
                account.accountNumber.toLowerCase().includes(query) ||
                (account.companyName ?? "")
                    .toLowerCase()
                    .includes(query);

            const matchesClient =
                !filters.clientId ||
                account.clientId === filters.clientId;

            const matchesType =
                !filters.accountType ||
                account.accountType === filters.accountType;

            const matchesCurrency =
                !filters.currency ||
                account.currency === filters.currency;

            const matchesStatus =
                !filters.status ||
                account.status === filters.status;

            return (
                matchesSearch &&
                matchesClient &&
                matchesType &&
                matchesCurrency &&
                matchesStatus
            );
        });
    }, [accounts, search, filters]);

    const total = filteredAccounts.length;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const startIndex = (page - 1) * PAGE_SIZE;

    const displayedAccounts = filteredAccounts.slice(
        startIndex,
        startIndex + PAGE_SIZE
    );

    const start = total === 0 ? 0 : startIndex + 1;
    const end = Math.min(startIndex + PAGE_SIZE, total);

    const visiblePages = getVisiblePages(page, totalPages);

    const hasFilters = Boolean(
        search ||
        filters.clientId ||
        filters.accountType ||
        filters.currency ||
        filters.status
    );

    function changeFilter(
        field: keyof AccountFilters,
        value: string
    ) {
        setFilters(previous => ({
            ...previous,
            [field]: value
        }));

        setPage(1);
    }

    function clearFilters() {
        setSearch("");
        setFilters({
            clientId: "",
            accountType: "",
            currency: "",
            status: ""
        });
        setPage(1);
    }

    return (
        <section className="accounts-directory">
            <div className="accounts-page-header">
                <h1>Financial Accounts</h1>

                <Link
                    href={ROUTES.accountRegistration}
                    className="accounts-register-button"
                >
                    <span className="material-symbols-rounded">
                        add
                    </span>
                    Register Account
                </Link>
            </div>

            <div className="accounts-filter-bar">
                <div className="accounts-search-field">
                    <span className="material-symbols-rounded">
                        search
                    </span>

                    <input
                        type="search"
                        aria-label="Search accounts"
                        placeholder="Search by account number, client name..."
                        value={search}
                        onChange={event => {
                            setSearch(event.target.value);
                            setPage(1);
                        }}
                    />
                </div>

                <div className="accounts-filter-field">
                    <label htmlFor="accounts-client">
                        Client
                    </label>

                    <select
                        id="accounts-client"
                        value={filters.clientId}
                        onChange={event =>
                            changeFilter("clientId", event.target.value)
                        }
                    >
                        <option value="">All Clients</option>

                        {clients.map(client => (
                            <option
                                key={client.clientId}
                                value={client.clientId}
                            >
                                {client.companyName}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="accounts-filter-field">
                    <label htmlFor="accounts-type">
                        Account Type
                    </label>

                    <select
                        id="accounts-type"
                        value={filters.accountType}
                        onChange={event =>
                            changeFilter("accountType", event.target.value)
                        }
                    >
                        <option value="">All Types</option>

                        {ENUMS.ACCOUNT_TYPES.map(type => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="accounts-filter-field">
                    <label htmlFor="accounts-currency">
                        Currency
                    </label>

                    <select
                        id="accounts-currency"
                        value={filters.currency}
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

                <div className="accounts-filter-field">
                    <label htmlFor="accounts-status">
                        Status
                    </label>

                    <select
                        id="accounts-status"
                        value={filters.status}
                        onChange={event =>
                            changeFilter("status", event.target.value)
                        }
                    >
                        <option value="">All Statuses</option>

                        {ENUMS.ACCOUNT_STATUSES.map(status => (
                            <option key={status} value={status}>
                                {status}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {hasFilters && (
                <button
                    type="button"
                    className="accounts-clear-filters"
                    onClick={clearFilters}
                >
                    <span className="material-symbols-rounded">
                        restart_alt
                    </span>
                    Clear Filters
                </button>
            )}

            <div className="accounts-table-scroll">
                <table className="accounts-data-table">
                    <thead>
                        <tr>
                            <th>Account Number</th>
                            <th>Client Name</th>
                            <th>Type</th>
                            <th>Currency</th>
                            <th>Balance</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="accounts-message">
                                    Loading financial accounts...
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="accounts-message accounts-error"
                                    role="alert"
                                >
                                    {error}
                                </td>
                            </tr>
                        ) : displayedAccounts.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="accounts-message">
                                    No accounts found.
                                </td>
                            </tr>
                        ) : (
                            displayedAccounts.map(account => (
                                <tr key={account.accountId}>
                                    <td>
                                        <Link
                                            href={ROUTES.accountDetails(
                                                account.accountId
                                            )}
                                            className="accounts-number-link"
                                        >
                                            {account.accountNumber}
                                        </Link>
                                    </td>

                                    <td>
                                        <Link
                                            href={ROUTES.clientDetails(
                                                account.clientId
                                            )}
                                            className="accounts-client-link"
                                        >
                                            {account.companyName ??
                                                "Unknown client"}
                                        </Link>
                                    </td>

                                    <td>{account.accountType}</td>

                                    <td>{account.currency}</td>

                                    <td className="accounts-balance">
                                        {formatMoney(
                                            account.balanceMinor,
                                            account.currency
                                        )}
                                    </td>

                                    <td>
                                        <span
                                            className={`accounts-status-badge ${account.status.toLowerCase()}`}
                                        >
                                            {account.status}
                                        </span>
                                    </td>

                                    <td>
                                        <div className="accounts-row-actions">
                                            <Link
                                                href={ROUTES.accountDetails(
                                                    account.accountId
                                                )}
                                                className="accounts-icon-button"
                                                title="View Account"
                                                aria-label={`View account ${account.accountNumber}`}
                                            >
                                                <span className="material-symbols-rounded">
                                                    visibility
                                                </span>
                                            </Link>

                                            <button
                                                type="button"
                                                className="accounts-icon-button"
                                                title="Account editing is not available"
                                                aria-label={`Editing account ${account.accountNumber} is not available`}
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

            <div className="accounts-table-footer">
                <p>
                    Showing {start}-{end} of {total} accounts
                </p>

                <nav
                    className="accounts-pagination"
                    aria-label="Account pagination"
                >
                    <button
                        type="button"
                        className="accounts-page-button"
                        disabled={page <= 1 || loading}
                        onClick={() =>
                            setPage(current => current - 1)
                        }
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
                                className="accounts-page-ellipsis"
                            >
                                ...
                            </span>
                        ) : (
                            <button
                                key={number}
                                type="button"
                                className={`accounts-page-button ${
                                    page === number ? "selected" : ""
                                }`}
                                aria-current={
                                    page === number ? "page" : undefined
                                }
                                disabled={loading}
                                onClick={() => setPage(number)}
                            >
                                {number}
                            </button>
                        )
                    )}

                    <button
                        type="button"
                        className="accounts-page-button"
                        disabled={page >= totalPages || loading}
                        onClick={() =>
                            setPage(current => current + 1)
                        }
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