import { API_BASE_URL, API_ROUTES } from "../../config";

export interface AssessmentDashboardRow {
  assessmentId: string;
  transactionId: string;
  referenceNumber: string;
  clientId: string | null;
  clientName: string;
  amountMinor: string;
  currency: string;
  transactionType: string;
  transactionStatus: string;
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  approvalRequired: boolean;
  approvalStatus: string | null;
  policyId: string;
  policyVersion: number;
  assessedAt: string | null;
  createdAt: string | null;
  triggeredRules: {
    ruleId: string;
    points: number;
    reason: string;
    evaluatedInput: unknown;
  }[];
}

export interface AssessmentDashboardResult {
  data: AssessmentDashboardRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  statistics: {
    assessments: number;
    highCritical: number;
    inReview: number;
    completed: number;
    averageScore: number | null;
  };
  rules: {
    ruleId: string;
    name: string;
    points: number;
  }[];
}

export async function getAssessmentDashboard(
  options: {
    search?: string;
    page?: number;
    pageSize?: number;
  } = {},
  signal?: AbortSignal
): Promise<AssessmentDashboardResult> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const response = await fetch(
    `${API_BASE_URL}${API_ROUTES.riskAssessments}/dashboard?${params}`,
    {
      cache: "no-store",
      signal
    }
  );

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body.error?.message ??
      `Risk dashboard request failed (HTTP ${response.status})`
    );
  }

  return body as AssessmentDashboardResult;
}