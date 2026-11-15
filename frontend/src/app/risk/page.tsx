"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
    getRiskDashboard,
    RiskDashboardData,
    RiskLevel
} from "@/services/risk-dashboard";

import { ROUTES } from "../../../config";

const riskColors: Record<RiskLevel, string> = {
    Low: "#16a34a",
    Medium: "#f59e0b",
    High: "#f97316",
    Critical: "#dc2626"
};

const riskLevels: RiskLevel[] = [
    "Low",
    "Medium",
    "High",
    "Critical"
];

function RiskMetric({
    label,
    value,
    icon,
    tone = "blue"
}: {
    label: string;
    value: number;
    icon: string;
    tone?: string;
}) {
    return (
        <div className="dashboard-metric-card">
            <div className={`metric-icon ${tone}`}>
                <span className="material-symbols-rounded">
                    {icon}
                </span>
            </div>

            <div className="metric-copy">
                <h2>{value.toLocaleString("en-CA")}</h2>
                <p>{label}</p>
            </div>
        </div>
    );
}

function RiskDistribution({
    data
}: {
    data: RiskDashboardData;
}) {
    return (
        <div className="dashboard-panel">
            <div className="dashboard-panel-header">
                <h2>Risk Distribution</h2>
            </div>

            <div className="risk-distribution">
                {riskLevels.map(level => {
                    const item = data.riskDistribution.find(
                        result => result.level === level
                    );

                    const percentage = item?.percentage ?? 0;

                    return (
                        <div
                            key={level}
                            className="risk-distribution-row"
                        >
                            <div className="risk-distribution-heading">
                                <span>{level} Risk</span>
                                <strong>
                                    {item?.count ?? 0}
                                    {" · "}
                                    {percentage.toFixed(1)}%
                                </strong>
                            </div>

                            <div
                                className="risk-distribution-track"
                                role="progressbar"
                                aria-label={`${level} risk distribution`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={percentage}
                            >
                                <div
                                    className="risk-distribution-fill"
                                    style={{
                                        width: `${percentage}%`,
                                        backgroundColor: riskColors[level]
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="risk-dashboard-average">
                Average Risk Score:
                <strong>
                    {data.averageRiskScore.toFixed(2)} / 100
                </strong>
            </div>
        </div>
    );
}

function RecentAssessments({
    assessments
}: {
    assessments: RiskDashboardData["recentHighRiskAssessments"];
}) {
    return (
        <div className="dashboard-panel">
            <div className="dashboard-panel-header">
                <h2>Recent High-Risk Assessments</h2>

                <Link
                    href={ROUTES.riskAssessments}
                    className="view-all-link"
                >
                    View All
                </Link>
            </div>

            <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                    <thead>
                        <tr>
                            <th>Assessment</th>
                            <th>Transaction</th>
                            <th>Score</th>
                            <th>Risk Level</th>
                            <th>Assessed At</th>
                        </tr>
                    </thead>

                    <tbody>
                        {assessments.length === 0 ? (
                            <tr>
                                <td colSpan={5}>
                                    No high-risk assessments found.
                                </td>
                            </tr>
                        ) : (
                            assessments.map(assessment => (
                                <tr key={assessment.assessmentId}>
                                    <td>
                                        <Link
                                            href={ROUTES.riskAssessmentDetails(
                                                assessment.assessmentId
                                            )}
                                            className="table-link"
                                        >
                                            {assessment.assessmentId.slice(0, 8)}
                                        </Link>
                                    </td>

                                    <td>
                                        <Link
                                            href={ROUTES.transactionDetails(
                                                assessment.transactionId
                                            )}
                                            className="table-link"
                                        >
                                            {assessment.transactionId.slice(0, 8)}
                                        </Link>
                                    </td>

                                    <td>
                                        {assessment.riskScore} / 100
                                    </td>

                                    <td>
                                        <span
                                            className="risk-level-badge"
                                            style={{
                                                color: riskColors[
                                                    assessment.riskLevel
                                                ],
                                                borderColor: riskColors[
                                                    assessment.riskLevel
                                                ]
                                            }}
                                        >
                                            {assessment.riskLevel}
                                        </span>
                                    </td>

                                    <td>
                                        {new Date(
                                            assessment.assessedAt
                                        ).toLocaleString("en-CA")}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function RiskDashboardPage() {
    const [dashboard, setDashboard] =
        useState<RiskDashboardData | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        async function loadDashboard() {
            try {
                const result = await getRiskDashboard(
                    controller.signal
                );

                if (!controller.signal.aborted) {
                    setDashboard(result);
                    setError("");
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load risk dashboard"
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        loadDashboard();

        return () => controller.abort();
    }, []);

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <h1>Risk Dashboard</h1>
                <p>
                    Monitor transaction risk assessments,
                    classifications and approval requirements.
                </p>
            </div>

            {loading && (
                <p className="dashboard-message">
                    Loading risk dashboard...
                </p>
            )}

            {error && (
                <div className="dashboard-error" role="alert">
                    <p>{error}</p>
                </div>
            )}

            {!loading && dashboard && (
                <>
                    <div className="dashboard-metric-grid">
                        <RiskMetric
                            label="Assessed Transactions"
                            value={dashboard.totalAssessments}
                            icon="assessment"
                        />

                        <RiskMetric
                            label="Awaiting Approval"
                            value={dashboard.awaitingApproval}
                            icon="pending_actions"
                            tone="indigo"
                        />

                        <RiskMetric
                            label="Low Risk"
                            value={dashboard.riskLevels.Low}
                            icon="verified_user"
                            tone="green"
                        />

                        <RiskMetric
                            label="Medium Risk"
                            value={dashboard.riskLevels.Medium}
                            icon="warning"
                            tone="blue"
                        />

                        <RiskMetric
                            label="High Risk"
                            value={dashboard.riskLevels.High}
                            icon="priority_high"
                            tone="red"
                        />

                        <RiskMetric
                            label="Critical Risk"
                            value={dashboard.riskLevels.Critical}
                            icon="gpp_bad"
                            tone="red"
                        />
                    </div>

                    <div className="risk-dashboard-actions">
                        <Link
                            href={ROUTES.riskAssessments}
                            className="view-all-link"
                        >
                            View Assessments
                        </Link>

                        <Link
                            href={ROUTES.riskPolicies}
                            className="view-all-link"
                        >
                            Manage Risk Policies
                        </Link>

                        <Link
                            href={ROUTES.approvalsQueue}
                            className="view-all-link"
                        >
                            Approval Queue
                        </Link>
                    </div>

                    <div className="risk-dashboard-sections">
                        <RiskDistribution data={dashboard} />

                        <RecentAssessments
                            assessments={
                                dashboard.recentHighRiskAssessments
                            }
                        />
                    </div>
                </>
            )}
        </div>
    );
}