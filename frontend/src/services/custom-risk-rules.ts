
import { API_BASE_URL, API_ROUTES } from "../../config";
import type { CustomRuleDefinition } from "./risk-policies";

export type CustomRuleInput = Omit<
  CustomRuleDefinition,
  "ruleId" | "createdAt" | "updatedAt"
>;

const endpoint = `${API_BASE_URL}${API_ROUTES.riskPolicies}/custom-rules`;

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "X-Actor-Id": "ACTOR-POLICY-001",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  if (response.status === 204) return undefined as T;

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body.error?.message ?? `Custom rule request failed (${response.status})`
    );
  }

  return body as T;
}

export function listCustomRules() {
  return request<CustomRuleDefinition[]>(endpoint);
}

export function createCustomRule(input: CustomRuleInput) {
  return request<CustomRuleDefinition>(endpoint, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateCustomRule(
  ruleId: string,
  input: CustomRuleInput
) {
  return request<CustomRuleDefinition>(
    `${endpoint}/${encodeURIComponent(ruleId)}`,
    {
      method: "PUT",
      body: JSON.stringify(input)
    }
  );
}

export function deleteCustomRule(ruleId: string) {
  return request<void>(
    `${endpoint}/${encodeURIComponent(ruleId)}`,
    { method: "DELETE" }
  );
}
