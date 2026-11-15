"use client";

import {
    use,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import Link from "next/link";

import {
    ApprovalWorkflow,
    WorkflowActor,
    WorkflowDecision,
    DecisionValue,
    getApprovalWorkflow,
    getApprovalDecisions,
    getWorkflowActors,
    submitWorkflowDecision,
    escalateApprovalWorkflow
} from "@/services/approval-workflows";

import {
    getRiskAssessment,
    RiskAssessmentDetails
} from "@/services/risk-assessments";

import {
    getTransaction,
    TransactionDetails
} from "@/services/transactions";

import { ROUTES } from "../../../../config";

interface Props {
    params: Promise<{ id: string }>;
}

type Action = "Approved" | "Rejected" | "Escalated";

function formatDate(value?: string | null) {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleString("en-CA", {
            dateStyle: "medium",
            timeStyle: "short"
        });
}

function formatAmount(amountMinor: number, currency: string) {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency
    }).format(amountMinor / 100);
}

function displayRole(role: string) {
    return role.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function DetailRow({
    label,
    children
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="approval-detail-row">
            <span>{label}</span>
            <strong>{children}</strong>
        </div>
    );
}

export default function ApprovalWorkflowDetailsPage({
    params
}: Props) {
    const { id } = use(params);

    const [workflow, setWorkflow] =
        useState<ApprovalWorkflow | null>(null);

    const [decisions, setDecisions] =
        useState<WorkflowDecision[]>([]);

    const [actors, setActors] =
        useState<WorkflowActor[]>([]);

    const [transaction, setTransaction] =
        useState<TransactionDetails | null>(null);

    const [assessment, setAssessment] =
        useState<RiskAssessmentDetails | null>(null);

    const [actorId, setActorId] = useState("");
    const [comments, setComments] = useState("");
    const [selectedAction, setSelectedAction] =
        useState<Action>("Approved");

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [relatedError, setRelatedError] = useState("");
    const [success, setSuccess] = useState("");

    const pendingSubmission = useRef<{
        fingerprint: string;
        key: string;
    } | null>(null);

    const loadDetails = useCallback(
        async (signal?: AbortSignal) => {
            const [nextWorkflow, nextDecisions, nextActors] =
                await Promise.all([
                    getApprovalWorkflow(id, signal),
                    getApprovalDecisions(id, signal),
                    getWorkflowActors(signal)
                ]);

            if (signal?.aborted) return;

            setWorkflow(nextWorkflow);
            setDecisions(nextDecisions);
            setActors(nextActors);

            const related = await Promise.allSettled([
                getTransaction(nextWorkflow.transactionId),
                getRiskAssessment(nextWorkflow.assessmentId)
            ]);

            if (signal?.aborted) return;

            if (related[0].status === "fulfilled") {
                setTransaction(related[0].value);
            } else {
                setTransaction(null);
            }

            if (related[1].status === "fulfilled") {
                setAssessment(related[1].value);
            } else {
                setAssessment(null);
            }

            setRelatedError(
                related.some(item => item.status === "rejected")
                    ? "Some related transaction or risk information could not be loaded."
                    : ""
            );
        },
        [id]
    );

    useEffect(() => {
        const controller = new AbortController();

        async function load() {
            setLoading(true);
            setError("");
            setSuccess("");
            setWorkflow(null);
            setTransaction(null);
            setAssessment(null);
            setActorId("");
            setComments("");
            pendingSubmission.current = null;

            try {
                await loadDetails(controller.signal);
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load workflow"
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
    }, [loadDetails]);

    const actor = actors.find(
        item => item.actorId === actorId
    );

    const activeStage = workflow?.requiredStages.find(
        item => item.stageNumber === workflow.currentStage
    );

    const terminal = workflow
        ? ["Approved", "Rejected", "Cancelled"].includes(
            workflow.status
        )
        : true;

    const isEscalated = workflow?.status === "Escalated";

    const expectedRole = isEscalated
        ? workflow?.escalation?.destinationRole
        : activeStage?.requiredRole;

    const alreadyApprovedAnotherStage = decisions.some(
        decision =>
            decision.actorId === actorId &&
            decision.decision === "Approved" &&
            (!decision.reviewType ||
                decision.reviewType === "StageReview") &&
            decision.stageNumber !== workflow?.currentStage
    );

    const requestedOwnEscalation =
        isEscalated &&
        workflow?.escalation?.requestedBy === actorId;

    const actionAllowed = Boolean(
        workflow &&
        !terminal &&
        actor &&
        actor.role === expectedRole &&
        activeStage?.status === "Pending" &&
        !alreadyApprovedAnotherStage &&
        !requestedOwnEscalation &&
        (
            isEscalated
                ? workflow.escalation?.status === "Pending"
                : ["Pending", "InReview"].includes(
                    workflow.status
                )
        )
    );

    const escalatableRoles: Record<string, string[]> = {
        OperationsReviewer: [
            "SeniorReviewer",
            "ComplianceReviewer"
        ],
        SeniorReviewer: [
            "ComplianceReviewer"
        ],
        ComplianceReviewer: []
    };

    const otherRequiredRoles =
        workflow?.requiredStages
            .filter(stage =>
                stage.stageNumber !== workflow.currentStage
            )
            .map(stage => stage.requiredRole) ?? [];

    const canEscalate = Boolean(
        actionAllowed &&
        !isEscalated &&
        expectedRole &&
        (escalatableRoles[expectedRole] ?? []).some(
            role => !otherRequiredRoles.includes(role)
        )
    );

    const availableActions = useMemo<Action[]>(
        () => isEscalated
            ? ["Approved", "Rejected"]
            : ["Approved", "Rejected", "Escalated"],
        [isEscalated]
    );

    const effectiveAction = availableActions.includes(
        selectedAction
    ) && (
        selectedAction !== "Escalated" || canEscalate
    )
        ? selectedAction
        : "Approved";

    const validComments =
        comments.trim().length > 0 &&
        comments.trim().length <= 2000;

    const canSubmit = actionAllowed &&
        validComments &&
        !submitting &&
        (
            effectiveAction !== "Escalated" || canEscalate
        );

    async function submitAction() {
        if (!workflow || !canSubmit || !actor) return;

        const action = effectiveAction;
        const trimmedComments = comments.trim();

        const fingerprint = JSON.stringify({
            workflowId: workflow.workflowId,
            actorId: actor.actorId,
            action,
            comments: trimmedComments
        });

        const key =
            pendingSubmission.current?.fingerprint === fingerprint
                ? pendingSubmission.current.key
                : crypto.randomUUID();

        pendingSubmission.current = {
            fingerprint,
            key
        };

        setSubmitting(true);
        setError("");
        setSuccess("");

        try {
            if (action === "Escalated") {
                await escalateApprovalWorkflow(
                    workflow.workflowId,
                    actor.actorId,
                    trimmedComments,
                    key
                );
            } else {
                await submitWorkflowDecision(
                    workflow.workflowId,
                    {
                        actorId: actor.actorId,
                        decision: action as DecisionValue,
                        comments: trimmedComments
                    },
                    key
                );
            }

            pendingSubmission.current = null;
            setComments("");
            setSelectedAction("Approved");

            await loadDetails();

            setSuccess(
                action === "Escalated"
                    ? "Escalation requested successfully."
                    : "Decision recorded successfully."
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to submit decision"
            );
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <section className="transaction-profile-page">
                <p role="status">
                    Loading approval workflow...
                </p>
            </section>
        );
    }

    if (!workflow) {
        return (
            <section className="transaction-profile-page">
                <p role="alert">
                    {error || "Approval workflow not found."}
                </p>
                <Link href={ROUTES.approvalsQueue}>
                    Back to Approval Queue
                </Link>
            </section>
        );
    }

    return (
        <section className="transaction-profile-page approval-detail-page">
            <nav className="transaction-profile-breadcrumb">
                <Link href={ROUTES.approvalsQueue}>
                    <span className="material-symbols-rounded">
                        chevron_left
                    </span>
                    Approval Queue
                </Link>
            </nav>

            <div className="approval-detail-header">
                <div>
                    <h1>Approval Workflow Details</h1>
                    <p>Workflow ID: {workflow.workflowId}</p>
                </div>

                <span
                    className={`approval-queue-status ${workflow.status.toLowerCase()}`}
                >
                    {workflow.status}
                </span>
            </div>

            {error && (
                <div className="risk-policy-error" role="alert">
                    {error}
                </div>
            )}

            {success && (
                <div className="approval-detail-success" role="status">
                    {success}
                </div>
            )}

            <div className="approval-detail-grid">
                <section className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h2>Transaction Information</h2>
                    </div>

                    <DetailRow label="Transaction">
                        {transaction?.referenceNumber ??
                            workflow.transactionId}
                    </DetailRow>

                    {transaction && (
                        <>
                            <DetailRow label="Amount">
                                {formatAmount(
                                    transaction.amountMinor,
                                    transaction.currency
                                )}
                            </DetailRow>

                            <DetailRow label="Financial Status">
                                {transaction.status}
                            </DetailRow>

                            <DetailRow label="Approval Status">
                                {transaction.approvalStatus ?? "—"}
                            </DetailRow>

                            <DetailRow label="Source Account">
                                {transaction.sourceAccount?.accountNumber ?? "—"}
                            </DetailRow>

                            <DetailRow label="Destination Account">
                                {transaction.destinationAccount?.accountNumber ?? "—"}
                            </DetailRow>
                        </>
                    )}

                    <Link
                        href={ROUTES.transactionDetails(
                            workflow.transactionId
                        )}
                        className="approval-detail-link"
                    >
                        View Transaction
                    </Link>
                </section>

                <section className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h2>Risk Assessment Summary</h2>
                    </div>

                    {assessment ? (
                        <>
                            <DetailRow label="Risk Level">
                                <span
                                    className={`risk-assessment-level ${assessment.riskLevel.toLowerCase()}`}
                                >
                                    {assessment.riskLevel}
                                </span>
                            </DetailRow>

                            <DetailRow label="Risk Score">
                                {assessment.riskScore} / 100
                            </DetailRow>

                            <DetailRow label="Policy Version">
                                v{assessment.policyVersion}
                            </DetailRow>

                            <DetailRow label="Triggered Rules">
                                {assessment.triggeredRules.length}
                            </DetailRow>

                            <DetailRow label="Assessed At">
                                {formatDate(assessment.assessedAt)}
                            </DetailRow>
                        </>
                    ) : (
                        <p>Risk assessment data is unavailable.</p>
                    )}

                    <Link
                        href={ROUTES.riskAssessmentDetails(
                            workflow.assessmentId
                        )}
                        className="approval-detail-link"
                    >
                        View Risk Assessment
                    </Link>
                </section>
            </div>

            {relatedError && (
                <p className="approval-detail-note" role="alert">
                    {relatedError}
                </p>
            )}

            <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <h2>Approval Stages</h2>
                </div>

                <div className="approval-detail-stages">
                    {workflow.requiredStages.map(stage => {
                        const current =
                            stage.stageNumber === workflow.currentStage;

                        return (
                            <div
                                key={stage.stageNumber}
                                className={`approval-detail-stage ${
                                    current ? "current" : ""
                                }`}
                            >
                                <div>
                                    <strong>
                                        Stage {stage.stageNumber}
                                    </strong>

                                    <p>
                                        {displayRole(stage.requiredRole)}
                                    </p>
                                </div>

                                <div className="approval-detail-stage-right">
                                    {current && !terminal && (
                                        <span className="approval-detail-current">
                                            Current Stage
                                        </span>
                                    )}

                                    <span
                                        className={`approval-detail-stage-status ${stage.status.toLowerCase()}`}
                                    >
                                        {stage.status}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="approval-detail-stage-meta">
                    <DetailRow label="Current Workflow Status">
                        {workflow.status}
                    </DetailRow>

                    <DetailRow label="Current Actionable Stage">
                        {terminal
                            ? "No further action"
                            : activeStage
                                ? `Stage ${activeStage.stageNumber}`
                                : "Unavailable"}
                    </DetailRow>

                    <DetailRow label="Required Reviewer Role">
                        {terminal || !expectedRole
                            ? "None"
                            : displayRole(expectedRole)}
                    </DetailRow>

                    <DetailRow label="Approval Policy">
                        {workflow.approvalPolicyId} ·
                        v{workflow.approvalPolicyVersion}
                    </DetailRow>
                </div>
            </section>

            {workflow.escalation && (
                <section className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h2>Escalation Information</h2>
                    </div>

                    <DetailRow label="Status">
                        {workflow.escalation.status}
                    </DetailRow>

                    <DetailRow label="Requested By">
                        {workflow.escalation.requestedBy}
                    </DetailRow>

                    <DetailRow label="Escalated To">
                        {displayRole(
                            workflow.escalation.destinationRole
                        )}
                    </DetailRow>

                    <DetailRow label="Reason">
                        {workflow.escalation.reason}
                    </DetailRow>

                    <DetailRow label="Requested At">
                        {formatDate(workflow.escalation.requestedAt)}
                    </DetailRow>

                    {workflow.escalation.reviewedAt && (
                        <DetailRow label="Reviewed At">
                            {formatDate(
                                workflow.escalation.reviewedAt
                            )}
                        </DetailRow>
                    )}
                </section>
            )}

            <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <h2>Reviewer Actions</h2>
                </div>

                {terminal && (
                    <div className="risk-policy-readonly">
                        This workflow is {workflow.status}.
                        No additional decisions are permitted.
                    </div>
                )}

                <div className="approval-detail-form">
                    <label htmlFor="approval-actor">
                        Demonstration Reviewer
                    </label>

                    <select
                        id="approval-actor"
                        value={actorId}
                        onChange={event => {
                            setActorId(event.target.value);
                            setSuccess("");
                        }}
                        disabled={submitting || terminal}
                    >
                        <option value="">
                            Select a reviewer
                        </option>

                        {actors.map(item => (
                            <option
                                key={item.actorId}
                                value={item.actorId}
                            >
                                {item.name} — {displayRole(item.role)}
                            </option>
                        ))}
                    </select>

                    {actorId && !actionAllowed && !terminal && (
                        <p className="approval-detail-note">
                            This reviewer cannot act on the
                            current workflow stage.
                        </p>
                    )}

                    <label htmlFor="approval-action">
                        Action
                    </label>

                    <select
                        id="approval-action"
                        value={effectiveAction}
                        onChange={event =>
                            setSelectedAction(
                                event.target.value as Action
                            )
                        }
                        disabled={!actionAllowed || submitting}
                    >
                        <option value="Approved">
                            {isEscalated
                                ? "Approve Escalation"
                                : "Approve"}
                        </option>

                        <option value="Rejected">
                            {isEscalated
                                ? "Reject Escalation"
                                : "Reject"}
                        </option>

                        {!isEscalated && canEscalate && (
                            <option value="Escalated">
                                Request Escalation
                            </option>
                        )}
                    </select>

                    <label htmlFor="approval-comments">
                        {effectiveAction === "Rejected"
                            ? "Rejection Reason"
                            : effectiveAction === "Escalated"
                                ? "Escalation Reason"
                                : "Review Comments"}
                    </label>

                    <textarea
                        id="approval-comments"
                        rows={4}
                        maxLength={2000}
                        value={comments}
                        onChange={event =>
                            setComments(event.target.value)
                        }
                        placeholder={
                            effectiveAction === "Rejected"
                                ? "Explain why this approval is rejected."
                                : effectiveAction === "Escalated"
                                    ? "Explain why higher-level review is required."
                                    : "Enter the reason for your decision."
                        }
                        disabled={!actionAllowed || submitting}
                    />

                    <div className="approval-detail-submit-row">
                        <span>
                            {comments.length} / 2000 characters
                        </span>

                        <button
                            type="button"
                            className="risk-policy-primary-button"
                            disabled={!canSubmit}
                            onClick={submitAction}
                        >
                            {submitting
                                ? "Submitting..."
                                : effectiveAction === "Escalated"
                                    ? "Request Escalation"
                                    : effectiveAction === "Rejected"
                                        ? "Submit Rejection"
                                        : isEscalated
                                            ? "Approve Escalation"
                                            : "Submit Approval"}
                        </button>
                    </div>
                </div>
            </section>

            <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <h2>Decision History</h2>
                </div>

                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Stage</th>
                                <th>Reviewer</th>
                                <th>Decision</th>
                                <th>Comments / Reason</th>
                            </tr>
                        </thead>

                        <tbody>
                            {decisions.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        No decisions have been recorded.
                                    </td>
                                </tr>
                            ) : (
                                [...decisions]
                                    .sort(
                                        (a, b) =>
                                            new Date(a.decidedAt).getTime() -
                                            new Date(b.decidedAt).getTime()
                                    )
                                    .map(decision => (
                                        <tr key={decision.decisionId}>
                                            <td>
                                                {formatDate(
                                                    decision.decidedAt
                                                )}
                                            </td>

                                            <td>
                                                {decision.stageNumber}
                                            </td>

                                            <td>
                                                <strong>
                                                    {actors.find(
                                                        item =>
                                                            item.actorId ===
                                                            decision.actorId
                                                    )?.name ?? decision.actorId}
                                                </strong>

                                                <small>
                                                    {displayRole(
                                                        decision.actorRole
                                                    )}
                                                </small>
                                            </td>

                                            <td>
                                                {decision.reviewType ===
                                                    "EscalationRequest"
                                                    ? "Escalation Requested"
                                                    : decision.reviewType ===
                                                        "EscalationReview"
                                                        ? `Escalation ${decision.decision}`
                                                        : decision.decision}
                                            </td>

                                            <td>
                                                {decision.comments}
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </section>
    );
}