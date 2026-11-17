
import { API_BASE_URL } from "../../config";

const BASE = `${API_BASE_URL}/api/v1/approval-policy-management`;

export type ApprovalPolicyStatus =
  | "Active"
  | "Draft"
  | "Pending"
  | "Archived"
  | "Superseded"
  | "Inactive";

export interface ManagedApprovalPolicy {
  policyId: string;
  name: string;
  description: string;
  version: number | string;
  versionLabel: string;
  status: ApprovalPolicyStatus;
  riskLevels: string[];
  requiredRoles: string[];
  owner: string;
  effectiveDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  changedBy: string;
  changeSummary: string;
  versionCount?: number;
  wizardCompleted?: boolean;
  hasWizardConfig?: boolean;
}

export interface PolicyMapping {
  riskLevel: string;
  workflowId: string | null;
  workflowName: string | null;
  stages: string[];
}

export interface PolicyListResult {
  policies: ManagedApprovalPolicy[];
  summary: {
    total: number;
    active: number;
    draft: number;
    pending: number;
    archived: number;
  };
  totalMatching: number;
}

export interface PolicyDetailsResult {
  policy: ManagedApprovalPolicy;
  versions: ManagedApprovalPolicy[];
  mappings: PolicyMapping[];
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      "X-Actor-Id": "DEMO-POLICY-ADMIN",
      ...options.headers
    }
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error?.message ??
      result.message ??
      `Request failed (${response.status})`
    );
  }

  return result as T;
}

export function getApprovalPolicies(
  search = "",
  status = "All"
) {
  const params = new URLSearchParams({ search, status });
  return request<PolicyListResult>(`?${params}`);
}

export function getApprovalPolicyDetails(id: string) {
  return request<PolicyDetailsResult>(
    `/${encodeURIComponent(id)}`
  );
}

export function createApprovalPolicyDraft(input: {
  name: string;
  description: string;
  owner: string;
}) {
  return request<ManagedApprovalPolicy>("/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}
