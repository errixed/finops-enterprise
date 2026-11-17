import { API_BASE_URL } from "../../config";

export type OverviewRiskLevel =
  | "Low"
  | "Medium"
  | "High"
  | "Critical";

export interface RiskOverviewData {
  generatedAt: string;
  summary: {
    overallRiskExposure: number | null;
    totalAssessments: number;
    highCritical: number;
    highCriticalPercentage: number;
    inReview: number;
    blocked: number;
    cleared: number;
    totalTransactions: number;
  };
  distribution: Record<OverviewRiskLevel, number>;
  trend: {
    date: string;
    score: number | null;
    count: number;
  }[];
  topFactors: {
    ruleId: string;
    label: string;
    count: number;
  }[];
  heatMap: {
    label: string;
    index: number;
    counts: Record<OverviewRiskLevel, number>;
  }[];
  highRiskTransactions: {
    transactionId: string;
    referenceNumber: string;
    clientName: string;
    amountMinor: string;
    currency: string;
    riskLevel: OverviewRiskLevel;
    riskScore: number;
    status: string;
    approvalStatus: string | null;
    assessedAt: string;
    createdAt: string;
  }[];
  alerts: {
    id: string;
    assessmentId: string;
    transactionId: string;
    label: string;
    ruleId: string;
    riskLevel: OverviewRiskLevel;
    occurredAt: string;
  }[];
}

export async function getRiskOverview(
  signal?: AbortSignal
): Promise<RiskOverviewData> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/risk-assessments/overview`,
    {
      cache: "no-store",
      signal
    }
  );

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body.error?.message ??
      `Unable to load risk overview (HTTP ${response.status})`
    );
  }

  return body as RiskOverviewData;
}