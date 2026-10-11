"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROUTES, PAGINATION } from "../../../config";
import {
    Client,
    ClientListResult,
    ClientOptions,
    getClients,
    getClientOptions
} from "@/services/clients";
import { createPortal } from "react-dom";

export default function ClientsPage() {
    const [result, setResult] = useState<ClientListResult | null>(null);
    const [options, setOptions] = useState<ClientOptions | null>(null);

    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [industry, setIndustry] = useState("");

    const [page, setPage] = useState<number>(PAGINATION.DEFAULT_PAGE);
    const [pageSize, setPageSize] = useState<number>(PAGINATION.DEFAULT_PAGE_SIZE);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

    useEffect(() => {
        getClientOptions()
            .then(setOptions)
            .catch(err =>
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load filter options"
                )
            );
    }, []);

    useEffect(() => {
        let active = true;

        async function load() {
            setLoading(true);
            setError("");

            try {
                const data = await getClients({
                    search,
                    status,
                    industry,
                    page,
                    pageSize
                });

                if (active) {
                    setResult(data);
                }
            } catch (err) {
                if (active) {
                    setResult(null);
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load clients"
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            active = false;
        };
    }, [search, status, industry, page, pageSize]);

    function clearFilters() {
        setSearch("");
        setStatus("");
        setIndustry("");
        setPage(1);
    }

    function changePageSize(value: number) {
        setPageSize(value);
        setPage(1);
    }

    const total = result?.pagination.total ?? 0;
    const totalPages = result?.pagination.totalPages ?? 0;
    const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    const pages = Array.from(
        { length: totalPages },
        (_, index) => index + 1
    );

    const hasFilters = Boolean(search || status || industry);

    return (
        <section className="clients-directory">
            <div className="clients-page-header">
                <div>
                    <h1>Corporate Clients</h1>
                    <p>Manage corporate client information</p>
                </div>

                <Link href={ROUTES.clientRegistration} className="clients-register-button">
                    <span className="material-symbols-rounded">add</span>
                    Register Client
                </Link>
            </div>

            <div className="clients-directory-card">
                <div className="clients-filter-bar">
                    <div className="clients-search">
                        <span className="material-symbols-rounded">
                            search
                        </span>

                        <input
                            type="search"
                            placeholder="Search by name or registration number..."
                            value={search}
                            onChange={event => {
                                setSearch(event.target.value);
                                setPage(1);
                            }}
                        />
                    </div>

                    <select
                        className="clients-filter-select"
                        value={status}
                        onChange={event => {
                            setStatus(event.target.value);
                            setPage(1);
                        }}
                        aria-label="Filter by status"
                    >
                        <option value="">All Statuses</option>

                        {options?.statuses.map(item => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>

                    <select
                        className="clients-filter-select"
                        value={industry}
                        onChange={event => {
                            setIndustry(event.target.value);
                            setPage(1);
                        }}
                        aria-label="Filter by industry"
                    >
                        <option value="">All Industries</option>

                        {options?.industries.map(item => (
                            <option key={item} value={item}>
                                {item}
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

                <div className="clients-table-scroll">
                    <table className="clients-data-table">
                        <thead>
                            <tr>
                                <th>Company Name</th>
                                <th>Registration #</th>
                                <th>Industry</th>
                                <th>Country</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="clients-message">
                                        Loading clients...
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="clients-message clients-error"
                                    >
                                        {error}
                                    </td>
                                </tr>
                            ) : result?.data.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="clients-message">
                                        No clients match your search or filters.
                                    </td>
                                </tr>
                            ) : (
                                result?.data.map((client: Client) => (
                                    <tr key={client.clientId}>
                                        <td className="clients-company-name">
                                            {client.companyName}
                                        </td>

                                        <td>{client.registrationNumber}</td>
                                        <td>{client.industry}</td>
                                        <td>{client.country}</td>

                                        <td>
                                            <span
                                                className={`clients-status-badge ${client.status.toLowerCase()}`}
                                            >
                                                {client.status}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="clients-actions">
                                                <Link
                                                    href={ROUTES.clientDetails(client.clientId)}
                                                    className="clients-view-button"
                                                >
                                                    <span className="material-symbols-rounded">
                                                        open_in_new
                                                    </span>
                                                    View
                                                </Link>

                                                <div className="clients-action-menu">
                                                    <button
                                                        type="button"
                                                        className="clients-more-button"
                                                        aria-label={`More actions for ${client.companyName}`}
                                                        aria-expanded={openMenu === client.clientId}
                                                        onClick={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();

                                                            setMenuPosition({
                                                                top: rect.bottom + 6,
                                                                right: window.innerWidth - rect.right
                                                            });

                                                            setOpenMenu(current =>
                                                                current === client.clientId ? null : client.clientId
                                                            );
                                                        }}
                                                    >
                                                        <span className="material-symbols-rounded">
                                                            more_horiz
                                                        </span>
                                                    </button>

                                                    {openMenu === client.clientId && createPortal(
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
                                                                href={ROUTES.clientEdit(client.clientId)}
                                                                onClick={() => setOpenMenu(null)}
                                                            >
                                                                <span className="material-symbols-rounded">
                                                                    edit
                                                                </span>
                                                                Edit Client
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

                <div className="clients-table-footer">
                    <p>
                        Showing {start} to {end} of {total} clients
                    </p>

                    <div className="clients-pagination">
                        <button
                            type="button"
                            className="clients-page-button"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage(current => current - 1)}
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
                            onClick={() => setPage(current => current + 1)}
                            aria-label="Next page"
                        >
                            <span className="material-symbols-rounded">
                                chevron_right
                            </span>
                        </button>

                        <select
                            className="clients-page-size"
                            value={pageSize}
                            onChange={event =>
                                changePageSize(Number(event.target.value))
                            }
                            aria-label="Clients per page"
                        >
                            {PAGINATION.PAGE_SIZE_OPTIONS.map(size => (
                                <option key={size} value={size}>
                                    {size} / page
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </section>
    );
}