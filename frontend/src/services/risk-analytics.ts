import { API_BASE_URL, API_ROUTES } from "../../config";

export type AnalyticsRiskLevel =
  | "Low"
  | "Medium"
  | "High"
  | "Critical";

export interface RiskCounts {
  Low: number;
  Medium: number;
  High: number;
  Critical: number;
}

export interface RiskAnalyticsData {
  period: {
    days: number;
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
  };

  policies: {
    key: string;
    label: string;
    policyId: string;
    version: number;
    status: string;
    currency: string;
  }[];

  selectedPolicy: string;

  metrics: {
    assessments: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    criticalRisk: number;
    averageScore: number | null;
    changes: {
      assessments: number | null;
      highRisk: number | null;
      mediumRisk: number | null;
      lowRisk: number | null;
      averageScore: number | null;
    };
  };

  distribution: RiskCounts;

  trend: (RiskCounts & {
    day: string;
    averageScore: number | null;
  })[];

  industries: (RiskCounts & {
    name: string;
    total: number;
  })[];

  jurisdictions: (RiskCounts & {
    name: string;
    assessments: number;
    highRisk: number;
    riskRate: number;
  })[];

  triggers: {
    ruleId: string;
    name: string;
    triggered: number;
    percent: number;
  }[];
}

export async function getRiskAnalytics(
  period: "7" | "30" | "90",
  policy: string,
  signal?: AbortSignal
): Promise<RiskAnalyticsData> {
  const params = new URLSearchParams({
    period,
    policy
  });

  const response = await fetch(
    `${API_BASE_URL}${API_ROUTES.riskAssessments}/analytics?${params}`,
    {
      cache: "no-store",
      signal
    }
  );

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body.error?.message ??
      `Risk analytics request failed (${response.status})`
    );
  }

  return body as RiskAnalyticsData;
}