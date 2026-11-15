"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import {
    ApprovalQueueFilters,
    ApprovalQueueResult,
    getApprovalQueue
} from "@/services/approval-queue";

import { ROUTES } from "../../../../config";

const initialFilters: ApprovalQueueFilters = {
    riskLevel: "",
    status: "",
    requiredRole: "",
    currency: "",
    minAmount: "",
    maxAmount: "",
    dateFrom: "",
    dateTo: "",
    sortBy: "createdAt",
    sortOrder: "asc",
    page: 1,
    pageSize: 10
};

function formatAmount(amountMinor: number, currency: string) {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency
    }).format(amountMinor / 100);
}

function formatDate(value: string) {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleString("en-CA", {
            dateStyle: "medium",
            timeStyle: "short"
        });
}

export default function ApprovalQueuePage() {
    const [draft, setDraft] = useState<ApprovalQueueFilters>({
        ...initialFilters
    });

    const [filters, setFilters] = useState<ApprovalQueueFilters>({
        ...initialFilters
    });

    const [result, setResult] =
        useState<ApprovalQueueResult | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        async function load() {
            setLoading(true);
            setError("");

            try {
                const response = await getApprovalQueue(
                    filters,
                    controller.signal
                );

                if (!controller.signal.aborted) {
                    setResult(response);
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    setResult(null);
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load approval queue"
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
    }, [filters]);

    function updateDraft(
        key: keyof ApprovalQueueFilters,
        value: string
    ) {
        setDraft(previous => ({
            ...previous,
            [key]: value
        }));
    }

    function applyFilters(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (
            draft.minAmount &&
            draft.maxAmount &&
            Number(draft.minAmount) > Number(draft.maxAmount)
        ) {
            setError(
                "Minimum amount cannot exceed maximum amount."
            );
            return;
        }

        if (
            draft.dateFrom &&
            draft.dateTo &&
            draft.dateFrom > draft.dateTo
        ) {
            setError(
                "Creation start date cannot exceed end date."
            );
            return;
        }

        setFilters({
            ...draft,
            page: 1
        });
    }

    function resetFilters() {
        setDraft({ ...initialFilters });
        setFilters({ ...initialFilters });
    }

    function changePage(page: number) {
        setFilters(previous => ({
            ...previous,
            page
        }));
    }

    const page = filters.page ?? 1;
    const total = result?.pagination.total ?? 0;
    const totalPages = result?.pagination.totalPages ?? 0;
    const pageSize = filters.pageSize ?? 10;

    const start = total === 0
        ? 0
        : (page - 1) * pageSize + 1;

    const end = Math.min(page * pageSize, total);

    return (
        <section className="transaction-directory">
            <div className="transaction-directory-header">
                <div>
                    <h1>Approval Queue</h1>
                    <p>
                        Review transactions awaiting a decision
                        or escalation review.
                    </p>
                </div>

                <Link
                    href={ROUTES.approvals}
                    className="transaction-directory-create"
                >
                    Approval Dashboard
                </Link>
            </div>

            <form
                onSubmit={applyFilters}
                className="approval-queue-filters"
            >
                <label>
                    Risk Level
                    <select
                        value={draft.riskLevel}
                        onChange={event =>
                            updateDraft(
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
                </label>

                <label>
                    Workflow Status
                    <select
                        value={draft.status}
                        onChange={event =>
                            updateDraft(
                                "status",
                                event.target.value
                            )
                        }
                    >
                        <option value="">All Actionable</option>
                        <option value="Pending">Pending</option>
                        <option value="InReview">In Review</option>
                        <option value="Escalated">Escalated</option>
                    </select>
                </label>

                <label>
                    Required Role
                    <select
                        value={draft.requiredRole}
                        onChange={event =>
                            updateDraft(
                                "requiredRole",
                                event.target.value
                            )
                        }
                    >
                        <option value="">All Roles</option>
                        <option value="OperationsReviewer">
                            Operations Reviewer
                        </option>
                        <option value="SeniorReviewer">
                            Senior Reviewer
                        </option>
                        <option value="ComplianceReviewer">
                            Compliance Reviewer
                        </option>
                    </select>
                </label>

                <label>
                    Currency
                    <select
                        value={draft.currency}
                        onChange={event =>
                            updateDraft(
                                "currency",
                                event.target.value
                            )
                        }
                    >
                        <option value="">All Currencies</option>
                        <option value="CAD">CAD</option>
                        <option value="USD">USD</option>
                    </select>
                </label>

                <label>
                    Minimum Amount
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={draft.minAmount}
                        onChange={event =>
                            updateDraft(
                                "minAmount",
                                event.target.value
                            )
                        }
                    />
                </label>

                <label>
                    Maximum Amount
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Any"
                        value={draft.maxAmount}
                        onChange={event =>
                            updateDraft(
                                "maxAmount",
                                event.target.value
                            )
                        }
                    />
                </label>

                <label>
                    Created From
                    <input
                        type="date"
                        value={draft.dateFrom}
                        max={draft.dateTo || undefined}
                        onChange={event =>
                            updateDraft(
                                "dateFrom",
                                event.target.value
                            )
                        }
                    />
                </label>

                <label>
                    Created To
                    <input
                        type="date"
                        value={draft.dateTo}
                        min={draft.dateFrom || undefined}
                        onChange={event =>
                            updateDraft(
                                "dateTo",
                                event.target.value
                            )
                        }
                    />
                </label>

                <label>
                    Sort By
                    <select
                        value={draft.sortBy}
                        onChange={event =>
                            updateDraft(
                                "sortBy",
                                event.target.value
                            )
                        }
                    >
                        <option value="createdAt">
                            Creation Date
                        </option>
                        <option value="riskScore">
                            Risk Score
                        </option>
                        <option value="amount">
                            Transaction Amount
                        </option>
                    </select>
                </label>

                <label>
                    Sort Order
                    <select
                        value={draft.sortOrder}
                        onChange={event =>
                            updateDraft(
                                "sortOrder",
                                event.target.value
                            )
                        }
                    >
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                </label>

                <label>
                    Page Size
                    <select
                        value={draft.pageSize}
                        onChange={event =>
                            setDraft(previous => ({
                                ...previous,
                                pageSize: Number(event.target.value)
                            }))
                        }
                    >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                    </select>
                </label>

                <div className="approval-queue-filter-actions">
                    <button
                        type="submit"
                        className="risk-policy-primary-button"
                    >
                        Apply Filters
                    </button>

                    <button
                        type="button"
                        className="risk-policy-secondary-button"
                        onClick={resetFilters}
                    >
                        Clear
                    </button>
                </div>
            </form>

            {error && (
                <div
                    role="alert"
                    className="risk-policy-error"
                >
                    {error}
                </div>
            )}

            <div className="transaction-directory-table-scroll">
                <table className="transaction-directory-table">
                    <thead>
                        <tr>
                            <th>Transaction</th>
                            <th>Amount</th>
                            <th>Risk</th>
                            <th>Status</th>
                            <th>Current Stage</th>
                            <th>Required Reviewer</th>
                            <th>Created</th>
                            <th>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8}>
                                    Loading approval queue...
                                </td>
                            </tr>
                        ) : !result?.data.length ? (
                            <tr>
                                <td colSpan={8}>
                                    {error
                                        ? "Unable to display the queue."
                                        : "No actionable workflows match the selected filters."}
                                </td>
                            </tr>
                        ) : (
                            result.data.map(item => (
                                <tr key={item.workflowId}>
                                    <td>
                                        <Link
                                            href={ROUTES.transactionDetails(
                                                item.transactionId
                                            )}
                                            className="approval-queue-link"
                                        >
                                            {item.referenceNumber ||
                                                item.transactionId.slice(0, 12)}
                                        </Link>
                                    </td>

                                    <td>
                                        {formatAmount(
                                            item.amountMinor,
                                            item.currency
                                        )}
                                    </td>

                                    <td>
                                        <span
                                            className={`risk-assessment-level ${item.riskLevel.toLowerCase()}`}
                                        >
                                            {item.riskLevel}
                                            {" "}({item.riskScore})
                                        </span>
                                    </td>

                                    <td>
                                        <span
                                            className={`approval-queue-status ${item.status.toLowerCase()}`}
                                        >
                                            {item.status}
                                        </span>
                                    </td>

                                    <td>
                                        Stage {item.currentStage}
                                    </td>

                                    <td>
                                        {item.requiredRole.replace(
                                            /([a-z])([A-Z])/g,
                                            "$1 $2"
                                        )}
                                    </td>

                                    <td>
                                        {formatDate(item.createdAt)}
                                    </td>

                                    <td>
                                        <Link
                                            href={ROUTES.approvalDetails(
                                                item.workflowId
                                            )}
                                            className="approval-queue-action"
                                        >
                                            {item.actionType === "EscalationReview"
                                                ? "Review Escalation"
                                                : "Review"}
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
                    Showing {start}–{end} of {total}
                </span>

                <div className="risk-assessment-pagination">
                    <button
                        type="button"
                        disabled={loading || page <= 1}
                        onClick={() =>
                            changePage(page - 1)
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
                            changePage(page + 1)
                        }
                    >
                        Next
                    </button>
                </div>
            </div>
        </section>
    );
}