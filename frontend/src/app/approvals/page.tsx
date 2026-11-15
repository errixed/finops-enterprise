"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
    ApprovalDashboardData,
    ApprovalDecisionSummary,
    getApprovalDashboard
} from "@/services/approval-dashboard";

import { ROUTES } from "../../../config";

function Metric({
    title,
    value,
    tone = ""
}: {
    title: string;
    value: number | string;
    tone?: string;
}) {
    return (
        <div className="finops-stat-card">
            <span className="finops-stat-label">
                {title}
            </span>

            <strong className={`finops-stat-value ${tone}`}>
                {typeof value === "number"
                    ? value.toLocaleString("en-CA")
                    : value}
            </strong>
        </div>
    );
}

function formatDuration(minutes: number | null) {
    if (minutes === null) return "N/A";

    if (minutes < 60) {
        return `${minutes.toFixed(1)} min`;
    }

    if (minutes < 1440) {
        return `${(minutes / 60).toFixed(1)} hrs`;
    }

    return `${(minutes / 1440).toFixed(1)} days`;
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

function DecisionType({
    decision
}: {
    decision: ApprovalDecisionSummary;
}) {
    if (decision.reviewType === "EscalationRequest") {
        return (
            <span className="finops-status pending">
                Escalation Requested
            </span>
        );
    }

    if (decision.reviewType === "EscalationReview") {
        return (
            <span className={`finops-status ${
                decision.decision === "Approved"
                    ? "completed"
                    : "rejected"
            }`}>
                Escalation {decision.decision}
            </span>
        );
    }

    return (
        <span className={`finops-status ${
            decision.decision === "Approved"
                ? "completed"
                : decision.decision === "Rejected"
                    ? "rejected"
                    : "pending"
        }`}>
            {decision.decision}
        </span>
    );
}

export default function ApprovalsDashboardPage() {
    const [dashboard, setDashboard] =
        useState<ApprovalDashboardData | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        async function load() {
            setLoading(true);

            try {
                const result = await getApprovalDashboard(
                    controller.signal
                );

                if (controller.signal.aborted) return;

                setDashboard(result);
                setError("");
            } catch (err) {
                if (controller.signal.aborted) return;

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load approval dashboard"
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => controller.abort();
    }, []);

    return (
        <section className="finops-dashboard">
            <div className="approval-dashboard-header">
                <div>
                    <h1>Approval Dashboard</h1>
                    <p>
                        Monitor transaction review activity,
                        approval outcomes and workflow performance.
                    </p>
                </div>

                <Link
                    href={ROUTES.approvalsQueue}
                    className="transaction-directory-create"
                >
                    View Approval Queue
                </Link>
            </div>

            {loading && (
                <p role="status">Loading approval dashboard...</p>
            )}

            {error && (
                <div className="risk-policy-error" role="alert">
                    {error}
                </div>
            )}

            {!loading && dashboard && (
                <>
                    <div className="approval-dashboard-metrics">
                        <Metric
                            title="Pending Workflows"
                            value={dashboard.pendingWorkflows}
                        />

                        <Metric
                            title="In Review"
                            value={dashboard.inReviewWorkflows}
                            tone="info"
                        />

                        <Metric
                            title="Approved Workflows"
                            value={dashboard.approvedWorkflows}
                        />

                        <Metric
                            title="Rejected Workflows"
                            value={dashboard.rejectedWorkflows}
                            tone="danger"
                        />

                        <Metric
                            title="Escalated Workflows"
                            value={dashboard.escalatedWorkflows}
                        />

                        <Metric
                            title="High-Risk Pending Approvals"
                            value={dashboard.highRiskPendingApprovals}
                            tone="danger"
                        />

                        <Metric
                            title="Average Approval Completion"
                            value={formatDuration(
                                dashboard.averageApprovalCompletionMinutes
                            )}
                        />
                    </div>

                    <div className="approval-dashboard-summary">
                        <span>
                            Total workflows:
                            <strong>{dashboard.totalWorkflows}</strong>
                        </span>

                        <span>
                            Total decisions:
                            <strong>{dashboard.totalDecisions}</strong>
                        </span>

                        <span>
                            Completed approvals:
                            <strong>{dashboard.completedApprovalCount}</strong>
                        </span>
                    </div>

                    <section className="finops-panel">
                        <div className="finops-panel-heading">
                            <h2>Recent Approval Decisions</h2>

                            <Link
                                href={ROUTES.approvalsQueue}
                                className="view-all-link"
                            >
                                Approval Queue
                            </Link>
                        </div>

                        <div className="finops-activity-scroll">
                            <table className="finops-activity-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Workflow</th>
                                        <th>Transaction</th>
                                        <th>Reviewer</th>
                                        <th>Stage</th>
                                        <th>Decision</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {dashboard.recentDecisions.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="finops-empty"
                                            >
                                                No approval decisions recorded.
                                            </td>
                                        </tr>
                                    ) : (
                                        dashboard.recentDecisions.map(
                                            decision => (
                                                <tr key={decision.decisionId}>
                                                    <td>
                                                        {formatDate(
                                                            decision.decidedAt
                                                        )}
                                                    </td>

                                                    <td>
                                                        <Link
                                                            href={ROUTES.approvalDetails(
                                                                decision.workflowId
                                                            )}
                                                            className="approval-dashboard-link"
                                                        >
                                                            {decision.workflowId.slice(0, 12)}
                                                        </Link>
                                                    </td>

                                                    <td>
                                                        <Link
                                                            href={ROUTES.transactionDetails(
                                                                decision.transactionId
                                                            )}
                                                            className="approval-dashboard-link"
                                                        >
                                                            {decision.transactionId.slice(0, 12)}
                                                        </Link>
                                                    </td>

                                                    <td>
                                                        <strong>
                                                            {decision.actorRole}
                                                        </strong>
                                                        <span className="approval-dashboard-actor">
                                                            {decision.actorId}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        {decision.stageNumber}
                                                    </td>

                                                    <td>
                                                        <DecisionType
                                                            decision={decision}
                                                        />
                                                    </td>
                                                </tr>
                                            )
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}
        </section>
    );
}