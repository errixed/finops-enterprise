import {
    API_BASE_URL,
    API_ROUTES
} from "../../config";

export type RiskLevel =
    | "Low"
    | "Medium"
    | "High"
    | "Critical";

export interface RiskDistributionItem {
    level: RiskLevel;
    count: number;
    percentage: number;
}

export interface RecentRiskAssessment {
    assessmentId: string;
    transactionId: string;
    riskScore: number;
    riskLevel: RiskLevel;
    assessedAt: string;
}

export interface RiskDashboardData {
    totalAssessments: number;
    averageRiskScore: number;
    approvalRequiredCount: number;
    awaitingApproval: number;
    riskLevels: Record<RiskLevel, number>;
    riskDistribution: RiskDistributionItem[];
    recentHighRiskAssessments: RecentRiskAssessment[];
}

export async function getRiskDashboard(
    signal?: AbortSignal
): Promise<RiskDashboardData> {
    const response = await fetch(
        `${API_BASE_URL}${API_ROUTES.riskDashboard}`,
        {
            method: "GET",
            cache: "no-store",
            signal
        }
    );

    if (!response.ok) {
        throw new Error(
            `Unable to load risk dashboard: HTTP ${response.status}`
        );
    }

    return response.json();
}