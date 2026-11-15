"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

import {
    getRiskAssessment,
    RiskAssessmentDetails
} from "@/services/risk-assessments";

import {
    getTransaction,
    TransactionDetails
} from "@/services/transactions";

import { ROUTES } from "../../../../../config";

import {
    getRiskPolicies
} from "@/services/risk-policies";

interface Props {
    params: Promise<{ id: string }>;
}

function formatDate(value?: string | null) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleString("en-CA", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function formatMoney(amountMinor: number, currency: string) {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency
    }).format(amountMinor / 100);
}

function InformationRow({
    label,
    children
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="transaction-profile-info-row">
            <span className="transaction-profile-info-label">
                {label}
            </span>

            <div className="transaction-profile-info-value">
                {children}
            </div>
        </div>
    );
}

function formatEvaluatedInput(
    value: string | number | boolean |
        Record<string, string | number | boolean>
) {
    if (typeof value !== "object" || value === null) {
        return String(value);
    }

    return Object.entries(value)
        .map(([key, entry]) => `${key}: ${entry}`)
        .join(", ");
}

export default function RiskAssessmentDetailsPage({
    params
}: Props) {
    const { id } = use(params);

    const [relatedPolicyId, setRelatedPolicyId] =
        useState<string | null>(null);

    const [assessment, setAssessment] =
        useState<RiskAssessmentDetails | null>(null);

    const [transaction, setTransaction] =
        useState<TransactionDetails | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [transactionError, setTransactionError] = useState("");

    useEffect(() => {
        let active = true;

        async function load() {
            setRelatedPolicyId(null);
            setLoading(true);
            setError("");
            setTransactionError("");
            setAssessment(null);
            setTransaction(null);

            try {
                const result = await getRiskAssessment(id);

                if (!active) return;

                setAssessment(result);

                try {
                    const policies = await getRiskPolicies();

                    if (!active) return;

                    const matchingPolicy = policies.find(
                        policy =>
                            policy.policyId === result.policyId &&
                            policy.version === result.policyVersion
                    );

                    setRelatedPolicyId(matchingPolicy?._id ?? null);
                } catch {
                    if (active) {
                        setRelatedPolicyId(null);
                    }
                }

                try {
                    const related = await getTransaction(
                        result.transactionId
                    );

                    if (!active) return;

                    if (
                        related.riskAssessmentId &&
                        related.riskAssessmentId !== result.assessmentId
                    ) {
                        setTransactionError(
                            "The transaction references a different assessment."
                        );
                    } else {
                        setTransaction(related);
                    }
                } catch (err) {
                    if (!active) return;

                    setTransactionError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load related transaction"
                    );
                }
            } catch (err) {
                if (!active) return;

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load assessment"
                );
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
    }, [id]);

    if (loading) {
        return (
            <section className="transaction-profile-page">
                <p>Loading risk assessment...</p>
            </section>
        );
    }

    if (error || !assessment) {
        return (
            <section className="transaction-profile-page">
                <div
                    className="transaction-profile-error"
                    role="alert"
                >
                    {error || "Risk assessment not found."}
                </div>

                <Link
                    href={ROUTES.riskAssessments}
                    className="transaction-profile-outline-button"
                >
                    Back to Assessments
                </Link>
            </section>
        );
    }

    const riskLevelClass =
        assessment.riskLevel.toLowerCase();

    const totalRulePoints = assessment.triggeredRules.reduce(
        (sum, rule) => sum + rule.points,
        0
    );

    return (
        <section className="transaction-profile-page">
            <div className="transaction-profile-toolbar">
                <nav
                    className="transaction-profile-breadcrumb"
                    aria-label="Breadcrumb"
                >
                    <Link href={ROUTES.riskAssessments}>
                        <span className="material-symbols-rounded">
                            chevron_left
                        </span>
                        Risk Assessments
                    </Link>

                    <span className="material-symbols-rounded">
                        chevron_right
                    </span>

                    <span>
                        {assessment.assessmentId.slice(0, 12)}
                    </span>
                </nav>
            </div>

            <div className="risk-detail-heading">
                <div>
                    <h1>Risk Assessment Details</h1>
                    <p>
                        Assessment ID: {assessment.assessmentId}
                    </p>
                </div>

                <span
                    className={`risk-assessment-level ${riskLevelClass}`}
                >
                    {assessment.riskLevel} Risk
                </span>
            </div>

            <div className="risk-detail-metrics">
                <div className="dashboard-metric-card">
                    <div className="metric-icon blue">
                        <span className="material-symbols-rounded">
                            monitoring
                        </span>
                    </div>

                    <div className="metric-copy">
                        <h2>
                            {assessment.riskScore} / 100
                        </h2>
                        <p>Risk Score</p>
                    </div>
                </div>

                <div className="dashboard-metric-card">
                    <div className="metric-icon indigo">
                        <span className="material-symbols-rounded">
                            policy
                        </span>
                    </div>

                    <div className="metric-copy">
                        <h2>
                            v{assessment.policyVersion}
                        </h2>
                        <p>Policy Version</p>
                    </div>
                </div>

                <div className="dashboard-metric-card">
                    <div className="metric-icon green">
                        <span className="material-symbols-rounded">
                            rule
                        </span>
                    </div>

                    <div className="metric-copy">
                        <h2>
                            {assessment.triggeredRules.length}
                        </h2>
                        <p>Triggered Rules</p>
                    </div>
                </div>
            </div>

            <div className="risk-detail-grid">
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h2>Assessment Information</h2>
                    </div>

                    <InformationRow label="Assessment ID">
                        {assessment.assessmentId}
                    </InformationRow>

                    <InformationRow label="Risk Classification">
                        <span
                            className={`risk-assessment-level ${riskLevelClass}`}
                        >
                            {assessment.riskLevel}
                        </span>
                    </InformationRow>

                    <InformationRow label="Risk Score">
                        {assessment.riskScore} / 100
                    </InformationRow>

                    <InformationRow label="Policy ID">
                        {assessment.policyId}
                    </InformationRow>

                    <InformationRow label="Policy Version">
                        {assessment.policyVersion}
                    </InformationRow>

                    <InformationRow label="Approval Required">
                        {assessment.approvalRequired ? "Yes" : "No"}
                    </InformationRow>

                    <InformationRow label="Assessment Timestamp">
                        {formatDate(assessment.assessedAt)}
                    </InformationRow>


                    <InformationRow label="Related Policy">
                        {relatedPolicyId ? (
                            <Link
                                href={ROUTES.riskPolicyDetails(relatedPolicyId)}
                                className="risk-detail-link"
                            >
                                View Policy Version {assessment.policyVersion}
                            </Link>
                        ) : (
                            <Link
                                href={ROUTES.riskPolicies}
                                className="risk-detail-link"
                            >
                                Browse Risk Policies
                            </Link>
                        )}
                    </InformationRow>

                </div>

                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h2>Transaction Summary</h2>
                    </div>

                    {transactionError && (
                        <p role="alert" className="risk-detail-error">
                            {transactionError}
                        </p>
                    )}

                    <InformationRow label="Transaction Reference">
                        {transaction?.referenceNumber ??
                            assessment.transactionId}
                    </InformationRow>

                    {transaction && (
                        <>
                            <InformationRow label="Amount">
                                {formatMoney(
                                    transaction.amountMinor,
                                    transaction.currency
                                )}
                            </InformationRow>

                            <InformationRow label="Source Account">
                                {transaction.sourceAccount.accountNumber}
                            </InformationRow>

                            <InformationRow label="Destination Account">
                                {transaction.destinationAccount.accountNumber}
                            </InformationRow>

                            <InformationRow label="Transaction Status">
                                <span
                                    className={`transaction-profile-status ${transaction.status.toLowerCase()}`}
                                >
                                    {transaction.status}
                                </span>
                            </InformationRow>

                            <InformationRow label="Approval Status">
                                {transaction.approvalStatus ?? "—"}
                            </InformationRow>
                        </>
                    )}

                    <div className="risk-detail-actions">
                        <Link
                            href={ROUTES.transactionDetails(
                                assessment.transactionId
                            )}
                            className="transaction-profile-outline-button"
                        >
                            <span className="material-symbols-rounded">
                                receipt_long
                            </span>
                            View Transaction
                        </Link>

                        {transaction?.approvalWorkflowId && (
                            <Link
                                href={ROUTES.approvalDetails(
                                    transaction.approvalWorkflowId
                                )}
                                className="transaction-profile-primary-button"
                            >
                                <span className="material-symbols-rounded">
                                    fact_check
                                </span>
                                View Approval Workflow
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            <div className="dashboard-panel risk-detail-rules">
                <div className="dashboard-panel-header">
                    <h2>Triggered Risk Rules</h2>
                </div>

                <p className="risk-detail-rule-summary">
                    Total rule contributions: {totalRulePoints} points.
                    {" "}
                    Final risk score: {assessment.riskScore} / 100
                    {totalRulePoints > 100
                        ? " (capped at 100)."
                        : "."}
                </p>

                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th>Rule</th>
                                <th>Reason</th>
                                <th>Evaluated Input</th>
                                <th>Contribution</th>
                            </tr>
                        </thead>

                        <tbody>
                            {assessment.triggeredRules.length === 0 ? (
                                <tr>
                                    <td colSpan={4}>
                                        No risk rules were triggered.
                                    </td>
                                </tr>
                            ) : (
                                assessment.triggeredRules.map(
                                    rule => (
                                        <tr key={rule.ruleId}>
                                            <td>
                                                <strong>
                                                    {rule.ruleId}
                                                </strong>
                                            </td>

                                            <td>{rule.reason}</td>

                                            <td>
                                                {formatEvaluatedInput(
                                                    rule.evaluatedInput
                                                )}
                                            </td>

                                            <td>
                                                <span className="risk-detail-points">
                                                    +{rule.points}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}