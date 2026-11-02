"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PAGINATION, ROUTES } from "../../../config";
import {
    ClientListResult,
    ClientOptions,
    getClients,
    getClientOptions
} from "@/services/clients";

export default function ClientsPage() {
    const [result, setResult] = useState<ClientListResult | null>(null);
    const [options, setOptions] = useState<ClientOptions | null>(null);

    const [search, setSearch] = useState("");
    const [industry, setIndustry] = useState("");
    const [country, setCountry] = useState("");
    const [status, setStatus] = useState("");

    const [page, setPage] = useState(1);
    const pageSize = PAGINATION.DEFAULT_PAGE_SIZE;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        getClientOptions()
            .then(data => {
                if (active) {
                    setOptions(data);
                }
            })
            .catch(err => {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load client options"
                    );
                }
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;

        async function loadClients() {
            setLoading(true);
            setError("");

            try {
                const data = await getClients({
                    search,
                    industry,
                    country,
                    status,
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

        loadClients();

        return () => {
            active = false;
        };
    }, [search, industry, country, status, page, pageSize]);

    function clearFilters() {
        setSearch("");
        setIndustry("");
        setCountry("");
        setStatus("");
        setPage(1);
    }

    const total = result?.pagination.total ?? 0;
    const totalPages = result?.pagination.totalPages ?? 0;

    const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    const hasFilters = Boolean(
        search || industry || country || status
    );

    const visiblePages = Array.from(
        { length: Math.min(5, totalPages) },
        (_, index) => {
            const firstPage = Math.max(
                1,
                Math.min(page - 2, totalPages - 4)
            );

            return firstPage + index;
        }
    );

    return (
        <section className="clients-directory">
            <div className="clients-page-header">
                <h1>Corporate Clients</h1>

                <Link
                    href={ROUTES.clientRegistration}
                    className="clients-register-button"
                >
                    <span className="material-symbols-rounded">
                        add
                    </span>
                    Register Client
                </Link>
            </div>

            <div className="clients-directory-card">
                <div className="clients-filter-bar">
                    <div className="clients-search-filter">
                        <label htmlFor="client-search">
                            <span className="material-symbols-rounded">
                                search
                            </span>
                            Search
                        </label>

                        <input
                            id="client-search"
                            type="search"
                            placeholder="Name or registration number"
                            value={search}
                            onChange={event => {
                                setSearch(event.target.value);
                                setPage(1);
                            }}
                        />
                    </div>

                    <div className="clients-filter-field">
                        <label htmlFor="client-industry">
                            Industry
                        </label>

                        <select
                            id="client-industry"
                            value={industry}
                            onChange={event => {
                                setIndustry(event.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">All Industries</option>

                            {options?.industries.map(item => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="clients-filter-field">
                        <label htmlFor="client-country">
                            Country
                        </label>

                        <select
                            id="client-country"
                            value={country}
                            onChange={event => {
                                setCountry(event.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">All Countries</option>

                            {options?.countries.map(item => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="clients-filter-field">
                        <label htmlFor="client-status">
                            Status
                        </label>

                        <select
                            id="client-status"
                            value={status}
                            onChange={event => {
                                setStatus(event.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">All Statuses</option>

                            {options?.statuses.map(item => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </div>

                    {hasFilters && (
                        <button
                            type="button"
                            className="clients-reset-button"
                            onClick={clearFilters}
                        >
                            <span className="material-symbols-rounded">
                                restart_alt
                            </span>
                            Clear Filters
                        </button>
                    )}
                </div>

                <div className="clients-table-scroll">
                    <table className="clients-data-table">
                        <thead>
                            <tr>
                                <th>Company Name</th>
                                <th>Registration Number</th>
                                <th>Industry</th>
                                <th>Country</th>
                                <th>Status</th>
                                <th>Accounts</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="clients-message">
                                        Loading clients...
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
                            ) : !result?.data.length ? (
                                <tr>
                                    <td colSpan={7} className="clients-message">
                                        No clients found.
                                    </td>
                                </tr>
                            ) : (
                                result.data.map(client => (
                                    <tr key={client.clientId}>
                                        <td className="clients-company-name">
                                            {client.companyName}
                                        </td>

                                        <td className="clients-registration">
                                            {client.registrationNumber}
                                        </td>

                                        <td>{client.industry}</td>

                                        <td>{client.country}</td>

                                        <td>
                                            <span
                                                className={`clients-status-badge ${client.status.toLowerCase()}`}
                                            >
                                                {client.status}
                                            </span>
                                        </td>

                                        <td className="clients-account-count">
                                            {client.accountCount}
                                        </td>

                                        <td>
                                            <div className="clients-actions">
                                                <Link
                                                    href={ROUTES.clientDetails(
                                                        client.clientId
                                                    )}
                                                    className="clients-icon-button"
                                                    aria-label={`View ${client.companyName}`}
                                                    title="View Client"
                                                >
                                                    <span className="material-symbols-rounded">
                                                        visibility
                                                    </span>
                                                </Link>

                                                <Link
                                                    href={ROUTES.clientEdit(
                                                        client.clientId
                                                    )}
                                                    className="clients-icon-button"
                                                    aria-label={`Edit ${client.companyName}`}
                                                    title="Edit Client"
                                                >
                                                    <span className="material-symbols-rounded">
                                                        edit
                                                    </span>
                                                </Link>
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
                        Showing {start}-{end} of {total} clients
                    </p>

                    <nav
                        className="clients-pagination"
                        aria-label="Client pagination"
                    >
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
                            {visiblePages.map(number => (
                                <button
                                    type="button"
                                    key={number}
                                    className={`clients-page-button ${
                                        page === number ? "selected" : ""
                                    }`}
                                    aria-current={
                                        page === number ? "page" : undefined
                                    }
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
                    </nav>
                </div>
            </div>
        </section>
    );
}