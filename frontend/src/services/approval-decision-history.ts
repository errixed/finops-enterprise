
import { API_BASE_URL } from "../../config";

export type DecisionStatus =
  | "Approved"
  | "Rejected"
  | "Pending"
  | "Escalated";

export interface DecisionHistoryRecord {
  id: string;
  workflowId: string;
  transactionId: string;
  stageNumber: number;
  decision: DecisionStatus;
  actorId: string;
  actorRole: string;
  actorName: string;
  comments: string;
  date: string;
  isPending: boolean;
  policyId: string;
  policyVersion: number | string | null;
  policyName: string;
  workflowName: string;
  workflowCreatedAt?: string;
  workflowStatus?: string;
  requiredStages?: Array<{
    stageNumber: number;
    requiredRole: string;
    status: string;
  }>;
}

export interface HistoryFilters {
  policy: string;
  workflow: string;
  decision: string;
  actor: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  sortBy: "date" | "decision" | "actor" | "workflow";
  sortOrder: "asc" | "desc";
}

export interface HistoryResult {
  data: DecisionHistoryRecord[];
  summary: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    escalated: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    policies: { value: string; label: string }[];
    workflows: { value: string; label: string }[];
    actors: { value: string; label: string }[];
  };
  period: {
    from: string;
    to: string;
  };
}

export async function fetchDecisionHistory(
  filters: HistoryFilters,
  signal?: AbortSignal
): Promise<HistoryResult> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== "all") {
      params.set(key, String(value));
    }
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/approval-decision-history?${params}`,
    { cache: "no-store", signal }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error?.message ??
      result.message ??
      "Unable to retrieve decision history."
    );
  }

  return result as HistoryResult;
}
