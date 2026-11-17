import { API_BASE_URL } from "../../config";

export interface ApprovalOverview {
  period: {
    days: number;
    start: string;
    end: string;
  };
  filter: string;
  metrics: {
    pending: number;
    approved: number;
    rejected: number;
    averageDecisionHours: number | null;
    changes: {
      pending: number | null;
      approved: number | null;
      rejected: number | null;
      averageDecisionHours: number | null;
    };
  };
  pendingRisk: {
    critical: number;
    high: number;
  };
  trend: {
    day: string;
    Approved: number;
    Pending: number;
    Rejected: number;
  }[];
  byWorkflow: {
    name: string;
    count: number;
    percent: number;
  }[];
  recentDecisions: {
    decisionId: string;
    workflowId: string;
    transactionId: string;
    decision: "Approved" | "Rejected";
    actorId: string;
    actorRole: string;
    decidedAt: string;
    riskLevel: string;
    clientId: string | null;
    clientName: string | null;
    amountMinor: number | string | null;
    currency: string | null;
  }[];
}

export async function getApprovalOverview(
  days: "7" | "30" | "90",
  workflow: string,
  signal?: AbortSignal
): Promise<ApprovalOverview> {
  const params = new URLSearchParams({ days, workflow });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/approvals/overview?${params}`,
    {
      cache: "no-store",
      signal
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error?.message ??
      `Unable to load approval overview (${response.status})`
    );
  }

  return result as ApprovalOverview;
}