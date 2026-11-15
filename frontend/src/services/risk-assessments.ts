import {
    API_BASE_URL,
    API_ROUTES
} from "../../config";

export type RiskLevel =
    | "Low"
    | "Medium"
    | "High"
    | "Critical";

export interface RiskAssessment {
    assessmentId: string;
    transactionId: string;
    riskScore: number;
    riskLevel: RiskLevel;
    approvalRequired: boolean;
    assessedAt: string;
}

export interface RiskAssessmentFilters {
    search?: string;
    riskLevel?: string;
    minScore?: number;
    maxScore?: number;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: "assessedAt" | "riskScore";
    sortOrder?: "asc" | "desc";
    page?: number;
    pageSize?: number;
}

export interface RiskAssessmentList {
    data: RiskAssessment[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export async function getRiskAssessments(
    filters: RiskAssessmentFilters = {},
    signal?: AbortSignal
): Promise<RiskAssessmentList> {
    const parameters = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== "") {
            parameters.set(key, String(value));
        }
    }

    const query = parameters.toString();

    const response = await fetch(
        `${API_BASE_URL}${API_ROUTES.riskAssessments}${
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
            "Unable to load risk assessments"
        );
    }

    return body as RiskAssessmentList;
}

export interface TriggeredRiskRule {
    ruleId: string;
    points: number;
    reason: string;
    evaluatedInput:
        | string
        | number
        | boolean
        | Record<string, string | number | boolean>;
}

export interface RiskAssessmentDetails extends RiskAssessment {
    policyId: string;
    policyVersion: number;
    triggeredRules: TriggeredRiskRule[];
}

export async function getRiskAssessment(
    assessmentId: string,
    signal?: AbortSignal
): Promise<RiskAssessmentDetails> {
    const response = await fetch(
        `${API_BASE_URL}${API_ROUTES.riskAssessments}/${encodeURIComponent(assessmentId)}`,
        {
            method: "GET",
            cache: "no-store",
            signal
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.error?.message ??
            "Unable to load risk assessment"
        );
    }

    return result as RiskAssessmentDetails;
}
