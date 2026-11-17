import {
    API_BASE_URL,
    API_ROUTES
} from "../../config";

export interface ApprovalDecisionSummary {
    decisionId: string;
    workflowId: string;
    transactionId: string;
    stageNumber: number;
    actorId: string;
    actorRole: string;
    decision: "Approved" | "Rejected" | "Escalated";
    reviewType?: "EscalationRequest" | "EscalationReview";
    comments: string;
    decidedAt: string;
}

export interface ApprovalDashboardData {
    totalWorkflows: number;
    pendingWorkflows: number;
    inReviewWorkflows: number;
    approvedWorkflows: number;
    rejectedWorkflows: number;
    escalatedWorkflows: number;
    cancelledWorkflows: number;
    awaitingReview: number;
    highRiskPendingApprovals: number;
    averageApprovalCompletionMinutes: number | null;
    completedApprovalCount: number;
    totalDecisions: number;
    recentDecisions: ApprovalDecisionSummary[];
    workflowStatuses: Record<string, number>;
}

export async function getApprovalDashboard(
    signal?: AbortSignal
): Promise<ApprovalDashboardData> {
    const response = await fetch(
        `${API_BASE_URL}${API_ROUTES.approvalsDashboard}`,
        {
            cache: "no-store",
            signal
        }
    );

    const body = await response.json();

    if (!response.ok) {
        throw new Error(
            body.error?.message ??
            `Unable to load approval dashboard (HTTP ${response.status})`
        );
    }

    return body as ApprovalDashboardData;
}