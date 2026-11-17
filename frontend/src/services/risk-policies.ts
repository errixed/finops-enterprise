import {
    API_BASE_URL,
    API_ROUTES
} from "../../config";

export type PolicyStatus =
    | "Draft"
    | "Active"
    | "Superseded";

export type PolicyCurrency = "CAD" | "USD";

export type RiskLevel =
    | "Low"
    | "Medium"
    | "High"
    | "Critical";
export type CustomRuleField =
    | "amount"
    | "recentCount"
    | "recentVolume"
    | "balancePercent"
    | "sourceClientStatus"
    | "destinationClientStatus"
    | "sourceAccountStatus"
    | "destinationAccountStatus";

export type CustomRuleOperator =
    | "gte"
    | "gt"
    | "eq"
    | "ne";

export interface RiskRule {
    ruleId: string;
    points: number;
    threshold?: number;
    name?: string;
    field?: CustomRuleField;
    operator?: CustomRuleOperator;
    value?: number | string;
}

export interface CustomRuleDefinition {
    ruleId: string;
    name: string;
    points: number;
    field: CustomRuleField;
    operator: CustomRuleOperator;
    value: number | string;
    createdAt?: string;
    updatedAt?: string;
}
export interface RiskThreshold {
    level: RiskLevel;
    min: number;
    max: number;
}

export interface RiskPolicy {
    _id: string;
    policyId: string;
    currency: PolicyCurrency;
    version: number;
    status: PolicyStatus;
    isDefault: boolean;
    rules: RiskRule[];
    thresholds: RiskThreshold[];
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    policyName?: string;
    description?: string;
    plannedEffectiveFrom?: string;
}

export interface PolicyConfiguration {
    rules: RiskRule[];
    thresholds: RiskThreshold[];
}

const POLICY_ACTOR_ID = "ACTOR-POLICY-001";

async function request<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(
        `${API_BASE_URL}${path}`,
        {
            cache: "no-store",
            ...options,
            headers: {
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...options.headers
            }
        }
    );

    const body = await response.json();

    if (!response.ok) {
        throw new Error(
            body.error?.message ??
            `Request failed (${response.status})`
        );
    }

    return body as T;
}

export function getRiskPolicies() {
    return request<RiskPolicy[]>(
        API_ROUTES.riskPolicies
    );
}

export function getRiskPolicy(id: string) {
    return request<RiskPolicy>(
        `${API_ROUTES.riskPolicies}/${encodeURIComponent(id)}`
    );
}


export interface NewRiskPolicyInput {
    policyId: string;
    currency: PolicyCurrency;
    policyName: string;
    description: string;
    plannedEffectiveFrom: string;
    rules: RiskRule[];
    thresholds: RiskThreshold[];
}

export function createRiskPolicy(
    input: NewRiskPolicyInput
) {
    return request<RiskPolicy>(
        API_ROUTES.riskPolicies,
        {
            method: "POST",
            headers: {
                "X-Actor-Id": POLICY_ACTOR_ID
            },
            body: JSON.stringify(input)
        }
    );
}


export function updateRiskPolicy(
    id: string,
    configuration: PolicyConfiguration
) {
    return request<RiskPolicy>(
        `${API_ROUTES.riskPolicies}/${encodeURIComponent(id)}`,
        {
            method: "PUT",
            headers: {
                "X-Actor-Id": POLICY_ACTOR_ID
            },
            body: JSON.stringify(configuration)
        }
    );
}

export function activateRiskPolicy(id: string) {
    return request<RiskPolicy>(
        `${API_ROUTES.riskPolicies}/${encodeURIComponent(id)}/activate`,
        {
            method: "POST",
            headers: {
                "X-Actor-Id": POLICY_ACTOR_ID
            }
        }
    );
}

export function copyRiskPolicy(policy: RiskPolicy) {
    return createRiskPolicy({
        policyId: policy.policyId,
        currency: policy.currency,
        policyName: policy.policyName ?? policy.policyId,
        description: policy.description ?? "",
        plannedEffectiveFrom: new Date().toISOString().slice(0, 10),
        rules: policy.rules.map(rule => ({ ...rule })),
        thresholds: policy.thresholds.map(threshold => ({ ...threshold }))
    });
}