"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
    getRiskAssessments,
    RiskAssessmentFilters,
    RiskAssessmentList
} from "@/services/risk-assessments";

import { ROUTES } from "../../../../config";

const PAGE_SIZE = 10;

const initialFilters: RiskAssessmentFilters = {
    search: "",
    riskLevel: "",
    dateFrom: "",
    dateTo: "",
    sortBy: "assessedAt",
    sortOrder: "desc",
    page: 1,
    pageSize: PAGE_SIZE
};

export default function RiskAssessmentsPage() {
    const [filters, setFilters] =
        useState<RiskAssessmentFilters>(initialFilters);

    const [searchInput, setSearchInput] = useState("");
    const [minInput, setMinInput] = useState("");
    const [maxInput, setMaxInput] = useState("");

    const [result, setResult] =
        useState<RiskAssessmentList | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const timeout = setTimeout(() => {
            setFilters(previous => ({
                ...previous,
                search: searchInput.trim(),
                minScore: minInput === ""
                    ? undefined
                    : Number(minInput),
                maxScore: maxInput === ""
                    ? undefined
                    : Number(maxInput),
                page: 1
            }));
        }, 350);

        return () => clearTimeout(timeout);
    }, [searchInput, minInput, maxInput]);

    const invalidScores =
        (minInput !== "" &&
            (!Number.isInteger(Number(minInput)) ||
                Number(minInput) < 0 ||
                Number(minInput) > 100)) ||
        (maxInput !== "" &&
            (!Number.isInteger(Number(maxInput)) ||
                Number(maxInput) < 0 ||
                Number(maxInput) > 100)) ||
        (minInput !== "" &&
            maxInput !== "" &&
            Number(minInput) > Number(maxInput));

    const invalidDates = Boolean(
        filters.dateFrom &&
        filters.dateTo &&
        filters.dateFrom > filters.dateTo
    );

    useEffect(() => {
        if (invalidScores || invalidDates) {
            setResult(null);
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        async function load() {
            setLoading(true);
            setError("");

            try {
                const data = await getRiskAssessments(
                    filters,
                    controller.signal
                );

                if (!controller.signal.aborted) {
                    setResult(data);
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    setResult(null);
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load assessments"
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => controller.abort();
    }, [filters, invalidScores, invalidDates]);

    function updateFilter(
        key: keyof RiskAssessmentFilters,
        value: string
    ) {
        setFilters(previous => ({
            ...previous,
            [key]: value,
            page: 1
        }));
    }

    function clearFilters() {
        setSearchInput("");
        setMinInput("");
        setMaxInput("");
        setFilters({ ...initialFilters });
    }

    const page = filters.page ?? 1;
    const pagination = result?.pagination;
    const totalPages = pagination?.totalPages ?? 0;

    const start = pagination?.total
        ? (page - 1) * PAGE_SIZE + 1
        : 0;

    const end = Math.min(
        page * PAGE_SIZE,
        pagination?.total ?? 0
    );

    return (
        <section className="transaction-directory">
            <div className="transaction-directory-header">
                <h1>Risk Assessments</h1>

                <Link
                    href={ROUTES.risk}
                    className="transaction-directory-create"
                >
                    Risk Dashboard
                </Link>
            </div>

            <div className="risk-assessment-filters">
                <div className="transaction-directory-search">
                    <span className="material-symbols-rounded">
                        search
                    </span>

                    <input
                        type="search"
                        aria-label="Search transaction reference"
                        placeholder="Transaction reference or ID"
                        value={searchInput}
                        onChange={event =>
                            setSearchInput(event.target.value)
                        }
                    />
                </div>

                <div className="transaction-directory-field">
                    <label htmlFor="risk-level">Risk Level</label>
                    <select
                        id="risk-level"
                        value={filters.riskLevel ?? ""}
                        onChange={event =>
                            updateFilter(
                                "riskLevel",
                                event.target.value
                            )
                        }
                    >
                        <option value="">All Levels</option>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                    </select>
                </div>

                <div className="transaction-directory-field">
                    <label htmlFor="risk-min">Minimum Score</label>
                    <input
                        id="risk-min"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        placeholder="0"
                        value={minInput}
                        onChange={event =>
                            setMinInput(event.target.value)
                        }
                    />
                </div>

                <div className="transaction-directory-field">
                    <label htmlFor="risk-max">Maximum Score</label>
                    <input
                        id="risk-max"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        placeholder="100"
                        value={maxInput}
                        onChange={event =>
                            setMaxInput(event.target.value)
                        }
                    />
                </div>

                <div className="transaction-directory-field">
                    <label htmlFor="risk-from">From Date</label>
                    <input
                        id="risk-from"
                        type="date"
                        value={filters.dateFrom ?? ""}
                        max={filters.dateTo || undefined}
                        onChange={event =>
                            updateFilter(
                                "dateFrom",
                                event.target.value
                            )
                        }
                    />
                </div>

                <div className="transaction-directory-field">
                    <label htmlFor="risk-to">To Date</label>
                    <input
                        id="risk-to"
                        type="date"
                        value={filters.dateTo ?? ""}
                        min={filters.dateFrom || undefined}
                        onChange={event =>
                            updateFilter(
                                "dateTo",
                                event.target.value
                            )
                        }
                    />
                </div>

                <div className="transaction-directory-field">
                    <label htmlFor="risk-sort">Sort By</label>
                    <select
                        id="risk-sort"
                        value={filters.sortBy}
                        onChange={event =>
                            updateFilter(
                                "sortBy",
                                event.target.value
                            )
                        }
                    >
                        <option value="assessedAt">
                            Assessment Date
                        </option>
                        <option value="riskScore">
                            Risk Score
                        </option>
                    </select>
                </div>

                <div className="transaction-directory-field">
                    <label htmlFor="risk-order">Order</label>
                    <select
                        id="risk-order"
                        value={filters.sortOrder}
                        onChange={event =>
                            updateFilter(
                                "sortOrder",
                                event.target.value
                            )
                        }
                    >
                        <option value="desc">Descending</option>
                        <option value="asc">Ascending</option>
                    </select>
                </div>
            </div>

            <button
                type="button"
                className="transaction-directory-clear"
                onClick={clearFilters}
            >
                Clear Filters
            </button>

            {(invalidScores || invalidDates) && (
                <p
                    className="transaction-directory-error"
                    role="alert"
                >
                    {invalidScores
                        ? "Enter whole-number scores from 0 to 100, with minimum not exceeding maximum."
                        : "From Date cannot be after To Date."}
                </p>
            )}

            <div className="transaction-directory-table-scroll">
                <table className="transaction-directory-table">
                    <thead>
                        <tr>
                            <th>Assessment</th>
                            <th>Transaction</th>
                            <th>Date</th>
                            <th>Risk Score</th>
                            <th>Risk Level</th>
                            <th>Approval</th>
                            <th>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr style={{ display: "none" }}>
                            <td colSpan={7} />
                        </tr>

                        {loading ? (
                            <tr>
                                <td colSpan={7}>
                                    Loading assessments...
                                </td>
                            </tr>
                        ) : error || invalidScores || invalidDates ? (
                            <tr>
                                <td colSpan={7} role="alert">
                                    {error ||
                                        "Please correct the filters."}
                                </td>
                            </tr>
                        ) : !result?.data.length ? (
                            <tr>
                                <td colSpan={7}>
                                    No risk assessments found.
                                </td>
                            </tr>
                        ) : (
                            result.data.map(assessment => (
                                <tr key={assessment.assessmentId}>
                                    <td>
                                        <Link
                                            className="transaction-directory-reference"
                                            href={ROUTES.riskAssessmentDetails(
                                                assessment.assessmentId
                                            )}
                                        >
                                            {assessment.assessmentId.slice(0, 12)}
                                        </Link>
                                    </td>

                                    <td>
                                        <Link
                                            href={ROUTES.transactionDetails(
                                                assessment.transactionId
                                            )}
                                        >
                                            {assessment.transactionId.slice(0, 12)}
                                        </Link>
                                    </td>

                                    <td>
                                        {new Date(
                                            assessment.assessedAt
                                        ).toLocaleDateString("en-CA")}
                                    </td>

                                    <td>{assessment.riskScore} / 100</td>

                                    <td>
                                        <span
                                            className={`risk-assessment-level ${assessment.riskLevel.toLowerCase()}`}
                                        >
                                            {assessment.riskLevel}
                                        </span>
                                    </td>

                                    <td>
                                        {assessment.approvalRequired
                                            ? "Required"
                                            : "Not required"}
                                    </td>

                                    <td>
                                        <Link
                                            href={ROUTES.riskAssessmentDetails(
                                                assessment.assessmentId
                                            )}
                                            className="transaction-directory-reference"
                                        >
                                            View Details
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="risk-assessment-footer">
                <span>
                    Showing {start}–{end} of{" "}
                    {pagination?.total ?? 0}
                </span>

                <div className="risk-assessment-pagination">
                    <button
                        type="button"
                        disabled={page <= 1 || loading}
                        onClick={() =>
                            setFilters(previous => ({
                                ...previous,
                                page: page - 1
                            }))
                        }
                    >
                        Previous
                    </button>

                    <span>
                        Page {page} of {Math.max(1, totalPages)}
                    </span>

                    <button
                        type="button"
                        disabled={
                            loading ||
                            totalPages === 0 ||
                            page >= totalPages
                        }
                        onClick={() =>
                            setFilters(previous => ({
                                ...previous,
                                page: page + 1
                            }))
                        }
                    >
                        Next
                    </button>
                </div>
            </div>
        </section>
    );
}