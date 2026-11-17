import {
    API_BASE_URL,
    API_ROUTES
} from "../../config";

export interface ApprovalQueueItem {
    workflowId: string;
    transactionId: string;
    assessmentId: string;
    referenceNumber: string;
    amountMinor: number;
    currency: string;
    riskLevel: "Low" | "Medium" | "High" | "Critical";
    riskScore: number;
    status: "Pending" | "InReview" | "Escalated";
    currentStage: number;
    requiredRole: string;
    actionType: "StageReview" | "EscalationReview";
    createdAt: string;
}

export interface ApprovalQueueFilters {
    actorId?: string;
    riskLevel?: string;
    status?: string;
    requiredRole?: string;
    currency?: string;
    minAmount?: string;
    maxAmount?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: "createdAt" | "riskScore" | "amount";
    sortOrder?: "asc" | "desc";
    page?: number;
    pageSize?: number;
}

export interface ApprovalQueueResult {
    data: ApprovalQueueItem[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export async function getApprovalQueue(
    filters: ApprovalQueueFilters,
    signal?: AbortSignal
): Promise<ApprovalQueueResult> {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
            params.set(key, String(value));
        }
    });

    const query = params.toString();

    const response = await fetch(
        `${API_BASE_URL}${API_ROUTES.approvalsQueue}${
            query ? `?${query}` : ""
        }`,
        {
            cache: "no-store",
            signal
        }
    );

    const body = await response.json();

    if (!response.ok) {
        throw new Error(
            body.error?.message ??
            "Unable to load approval queue"
        );
    }

    return body as ApprovalQueueResult;
}