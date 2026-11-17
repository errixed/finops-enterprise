import {
    API_BASE_URL,
    API_ROUTES
} from "../../config";

export type WorkflowStatus =
    | "Pending"
    | "InReview"
    | "Approved"
    | "Rejected"
    | "Escalated"
    | "Cancelled";

export type DecisionValue = "Approved" | "Rejected";

export interface ApprovalStage {
    stageNumber: number;
    requiredRole: string;
    status: "Pending" | "Waiting" | "Approved" | "Rejected" | "Cancelled";
    actorId?: string;
    decidedAt?: string;
}

export interface WorkflowEscalation {
    stageNumber: number;
    status: "Pending" | "Approved" | "Rejected";
    requestedBy: string;
    requestedAt: string;
    destinationRole: string;
    reason: string;
    reviewedBy?: string;
    reviewedAt?: string;
}

export interface ApprovalWorkflow {
    workflowId: string;
    transactionId: string;
    assessmentId: string;
    approvalPolicyId: string;
    approvalPolicyVersion: number;
    status: WorkflowStatus;
    currentStage: number | null;
    requiredStages: ApprovalStage[];
    escalation?: WorkflowEscalation | null;
    createdAt: string;
    updatedAt: string;
}

export interface WorkflowDecision {
    decisionId: string;
    workflowId: string;
    transactionId: string;
    stageNumber: number;
    actorId: string;
    actorRole: string;
    decision: "Approved" | "Rejected" | "Escalated";
    comments: string;
    reviewType?: "StageReview" | "EscalationRequest" | "EscalationReview";
    destinationRole?: string;
    decidedAt: string;
    idempotencyKey: string;
}

export interface WorkflowActor {
    actorId: string;
    name: string;
    role: string;
}

export interface DecisionResult {
    workflow: ApprovalWorkflow;
    decision: WorkflowDecision;
    replayed?: boolean;
}

async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
            cache: "no-store",
            ...options
        }
    );

    const content = await response.json();

    if (!response.ok) {
        throw new Error(
            content.error?.message ??
            `Request failed with HTTP ${response.status}`
        );
    }

    return content as T;
}

export function getApprovalWorkflow(
    workflowId: string,
    signal?: AbortSignal
) {
    return request<ApprovalWorkflow>(
        `${API_ROUTES.approvalWorkflows}/${encodeURIComponent(workflowId)}`,
        { signal }
    );
}

export function getApprovalDecisions(
    workflowId: string,
    signal?: AbortSignal
) {
    return request<WorkflowDecision[]>(
        `${API_ROUTES.approvalWorkflows}/${encodeURIComponent(workflowId)}/decisions`,
        { signal }
    );
}

export function getWorkflowActors(
    signal?: AbortSignal
) {
    return request<WorkflowActor[]>(
        API_ROUTES.workflowActors,
        { signal }
    );
}

export function submitWorkflowDecision(
    workflowId: string,
    input: {
        actorId: string;
        decision: DecisionValue;
        comments: string;
    },
    idempotencyKey: string
) {
    return request<DecisionResult>(
        `${API_ROUTES.approvalWorkflows}/${encodeURIComponent(workflowId)}/decisions`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": idempotencyKey
            },
            body: JSON.stringify(input)
        }
    );
}

export function escalateApprovalWorkflow(
    workflowId: string,
    actorId: string,
    reason: string,
    idempotencyKey: string
) {
    return request<DecisionResult>(
        `${API_ROUTES.approvalWorkflows}/${encodeURIComponent(workflowId)}/escalate`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": idempotencyKey
            },
            body: JSON.stringify({
                actorId,
                reason
            })
        }
    );
}