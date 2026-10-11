"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROUTES, PAGINATION, ENUMS } from "../../../config";
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
import { createPortal } from "react-dom";

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

    const [page, setPage] = useState<number>(PAGINATION.DEFAULT_PAGE);
    const [pageSize, setPageSize] = useState<number>(PAGINATION.DEFAULT_PAGE_SIZE);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

    useEffect(() => {
        let active = true;

        getClients({ page: 1, pageSize: 100 })
            .then(result => {
                if (active) setClients(result.data);
            })
            .catch(err => {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load clients"
                    );
                }
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;

        async function loadAccounts() {
            setLoading(true);
            setError("");

            try {
                const result = await getAccounts(filters);

                if (active) {
                    setAccounts(result);
                }
            } catch (err) {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load accounts"
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        loadAccounts();

        return () => {
            active = false;
        };
    }, [filters]);

    function changeFilter(field: keyof AccountFilters, value: string) {
        setFilters(previous => ({
            ...previous,
            [field]: value
        }));

        setPage(1);
        setOpenMenu(null);
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
        setOpenMenu(null);
    }

    const filteredAccounts = accounts.filter(account =>
        account.accountNumber
            .toLowerCase()
            .includes(search.trim().toLowerCase())
    );

    const total = filteredAccounts.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;

    const displayedAccounts = filteredAccounts.slice(
        startIndex,
        startIndex + pageSize
    );

    const start = total === 0 ? 0 : startIndex + 1;
    const end = Math.min(startIndex + pageSize, total);

    const hasFilters = Boolean(
        search ||
        filters.clientId ||
        filters.accountType ||
        filters.currency ||
        filters.status
    );

    const pages = Array.from(
        { length: totalPages },
        (_, index) => index + 1
    );

    return (
        <section className="accounts-directory">
            <div className="accounts-page-header">
                <div>
                    <h1>Financial Accounts</h1>
                    <p>Manage client financial accounts</p>
                </div>

                <Link
                    href={ROUTES.accountRegistration}
                    className="clients-register-button"
                >
                    <span className="material-symbols-rounded">
                        add
                    </span>
                    Register Account
                </Link>
            </div>

            <div className="accounts-filter-bar">
                <div className="clients-search">
                    <span className="material-symbols-rounded">
                        search
                    </span>

                    <input
                        type="search"
                        placeholder="Search by account number..."
                        value={search}
                        onChange={event => {
                            setSearch(event.target.value);
                            setPage(1);
                        }}
                    />
                </div>

                <select
                    className="clients-filter-select"
                    aria-label="Filter by client"
                    value={filters.clientId}
                    onChange={event =>
                        changeFilter("clientId", event.target.value)
                    }
                >
                    <option value="">All Clients</option>

                    {clients.map(client => (
                        <option key={client.clientId} value={client.clientId}>
                            {client.companyName}
                        </option>
                    ))}
                </select>

                <select
                    className="clients-filter-select"
                    aria-label="Filter by account type"
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

                <select
                    className="clients-filter-select"
                    aria-label="Filter by currency"
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

                <select
                    className="clients-filter-select"
                    aria-label="Filter by status"
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

                <button
                    type="button"
                    className="clients-clear-button"
                    onClick={clearFilters}
                    disabled={!hasFilters}
                >
                    <span className="material-symbols-rounded">
                        restart_alt
                    </span>
                    Clear
                </button>
            </div>

            <div className="accounts-table-scroll">
                <table className="accounts-data-table">
                    <thead>
                        <tr>
                            <th>Account Number</th>
                            <th>Client Name</th>
                            <th>Account Type</th>
                            <th>Currency</th>
                            <th>Balance</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="clients-message">
                                    Loading financial accounts...
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="clients-message clients-error"
                                >
                                    {error}
                                </td>
                            </tr>
                        ) : displayedAccounts.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="clients-message">
                                    No accounts match your search or filters.
                                </td>
                            </tr>
                        ) : (
                            displayedAccounts.map((account: Account) => (
                                <tr key={account.accountId}>
                                    <td>
                                        <Link
                                            href={ROUTES.accountDetails(account.accountId)}
                                            className="accounts-number-link"
                                        >
                                            {account.accountNumber}
                                        </Link>
                                    </td>

                                    <td>{account.companyName}</td>
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
                                        <div className="clients-actions">
                                            <Link
                                                href={ROUTES.accountDetails(account.accountId)}
                                                className="accounts-view-button"
                                            >
                                                View
                                            </Link>

                                            <div className="clients-action-menu">
                                                <button
                                                    type="button"
                                                    className="accounts-more-button"
                                                    aria-label={`More actions for ${account.accountNumber}`}
                                                    aria-expanded={
                                                        openMenu === account.accountId
                                                    }
                                                    onClick={(e) => {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const menuHeight = 110;

                                                        const top =
                                                            rect.bottom + menuHeight + 6 > window.innerHeight
                                                                ? rect.top - menuHeight - 6
                                                                : rect.bottom + 6;

                                                        setMenuPosition({
                                                            top: Math.max(8, top),
                                                            right: Math.max(8, window.innerWidth - rect.right)
                                                        });

                                                        setOpenMenu(current =>
                                                            current === account.accountId ? null : account.accountId
                                                        );
                                                    }}
                                                >
                                                    <span className="material-symbols-rounded">
                                                        more_horiz
                                                    </span>
                                                </button>

                                                {openMenu === account.accountId && createPortal(
                                                    <div
                                                        className="clients-menu-dropdown"
                                                        style={{
                                                            position: "fixed",
                                                            top: menuPosition.top,
                                                            right: menuPosition.right,
                                                            zIndex: 9999
                                                        }}
                                                    >
                                                        <Link
                                                            href={ROUTES.accountDetails(account.accountId)}
                                                            onClick={() => setOpenMenu(null)}
                                                        >
                                                            <span className="material-symbols-rounded">
                                                                visibility
                                                            </span>
                                                            View Details
                                                        </Link>

                                                        <Link
                                                            href={ROUTES.clientDetails(account.clientId)}
                                                            onClick={() => setOpenMenu(null)}
                                                        >
                                                            <span className="material-symbols-rounded">
                                                                business
                                                            </span>
                                                            View Client
                                                        </Link>
                                                    </div>,
                                                    document.body
                                                )}
                                            </div>
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
                    Showing {start} to {end} of {total} accounts
                </p>

                <div className="clients-pagination">
                    <button
                        type="button"
                        className="clients-page-button"
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

                    <div className="clients-page-numbers">
                        {pages.map(number => (
                            <button
                                key={number}
                                type="button"
                                className={`clients-page-button ${page === number ? "selected" : ""
                                    }`}
                                onClick={() => setPage(number)}
                                disabled={loading}
                            >
                                {number}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        className="clients-page-button"
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

                    <select
                        className="clients-page-size"
                        value={pageSize}
                        aria-label="Accounts per page"
                        onChange={event => {
                            setPageSize(Number(event.target.value));
                            setPage(1);
                        }}
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
