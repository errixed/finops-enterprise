import { API_BASE_URL, API_ROUTES } from "../../config";

export type AlertLevel = "Low" | "Medium" | "High" | "Critical";
export type AlertStatus = "Open" | "In Review" | "Approved" | "Blocked" | "Resolved";

export interface RiskAlert {
  alertId: string;
  assessmentId: string;
  transactionId: string;
  referenceNumber: string;
  clientId: string | null;
  clientName: string;
  ruleId: string;
  description: string;
  riskLevel: AlertLevel;
  riskScore: number;
  status: AlertStatus;
  assessedAt: string;
  amountMinor: string;
  currency: string | null;
}

export interface RiskAlertFilters {
  riskLevel?: string;
  ruleId?: string;
  status?: string;
  clientId?: string;
  period?: string;
  page?: number;
  pageSize?: number;
}

export interface RiskAlertResult {
  data: RiskAlert[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    active: number;
    inReview: number;
    blocked: number;
    resolved: number;
    total: number;
  };
  rules: {
    ruleId: string;
    ruleName: string;
    count: number;
  }[];
  ruleOptions: string[];
  trend: {
    date: string;
    Low: number;
    Medium: number;
    High: number;
    Critical: number;
  }[];
}

export async function getRiskAlerts(
  filters: RiskAlertFilters = {},
  signal?: AbortSignal
): Promise<RiskAlertResult> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const response = await fetch(
    `${API_BASE_URL}${API_ROUTES.riskAssessments}/alerts?${params.toString()}`,
    { cache: "no-store", signal }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error?.message ??
      `Unable to load risk alerts (HTTP ${response.status})`
    );
  }

  return result as RiskAlertResult;
}