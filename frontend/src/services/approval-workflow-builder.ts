import { API_BASE_URL } from "../../config";

export type ReviewerRole =
  | "OperationsReviewer"
  | "SeniorReviewer"
  | "ComplianceReviewer";

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";
export type DecisionType = "ApproveReject" | "ReviewRecommend";

export interface WorkflowStageInput {
  stageId?: string;
  name: string;
  reviewerRole: ReviewerRole;
  decisionType: DecisionType;
  slaBusinessDays: number;
}

export interface WorkflowBuilderInput {
  name: string;
  workflowCode: string;
  description: string;
  riskLevels: RiskLevel[];
  transactionType: "All" | "InternalTransfer" | "ExternalTransfer";
  stageDefinitions: WorkflowStageInput[];
  slaCalculation: "PerStage" | "EndToEnd";
  autoEscalate: boolean;
  escalationRole: ReviewerRole;
  allowParallel: boolean;
  requireReapproval: boolean;
  active: boolean;
}

export interface WorkflowBuilderResult extends WorkflowBuilderInput {
  definitionId: string;
  status: "Draft" | "Inactive" | "Active";
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

const BASE = `${API_BASE_URL}/api/v1/approval-workflow-builders`;

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      "X-Actor-Id": "DEMO-POLICY-ADMIN",
      ...options.headers
    }
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error?.message ??
      result.message ??
      `Request failed (${response.status})`
    );
  }

  return result as T;
}

function json(method: string, data: WorkflowBuilderInput): RequestInit {
  return {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  };
}

export function createApprovalWorkflow(data: WorkflowBuilderInput) {
  return request<WorkflowBuilderResult>(
    "/",
    json("POST", data)
  );
}

export function saveWorkflowDraft(data: WorkflowBuilderInput) {
  return request<WorkflowBuilderResult>(
    "/drafts",
    json("POST", data)
  );
}

export function getWorkflowDraft(id: string) {
  return request<WorkflowBuilderResult>(
    `/drafts/${encodeURIComponent(id)}`
  );
}

export function updateWorkflowDraft(
  id: string,
  data: WorkflowBuilderInput
) {
  return request<WorkflowBuilderResult>(
    `/drafts/${encodeURIComponent(id)}`,
    json("PUT", data)
  );
}

export function completeWorkflowDraft(
  id: string,
  data: WorkflowBuilderInput
) {
  return request<WorkflowBuilderResult>(
    `/drafts/${encodeURIComponent(id)}/complete`,
    json("POST", data)
  );
}

export function deleteWorkflowDraft(id: string) {
  return request<void>(
    `/drafts/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}
