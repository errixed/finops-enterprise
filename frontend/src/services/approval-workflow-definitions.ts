import { API_BASE_URL } from "../../config";

const BASE = `${API_BASE_URL}/api/v1/approval-workflow-definitions`;

export type DefinitionStatus = "Active" | "Inactive";

export interface WorkflowDefinition {
  definitionId: string;
  name: string;
  description: string;
  riskLevels: string[];
  stages: string[];
  slaHours: number;
  protected: boolean;
  origin: "Assignment3" | "Custom";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  status: "Draft" | "Active" | "Inactive";
  isDraft?: boolean;
}

export interface WorkflowDefinitionInput {
  name: string;
  description: string;
  riskLevels: string[];
  stages: string[];
  slaHours: number;
}

export interface WorkflowDefinitionSummary {
  total: number;
  active: number;
  inactive: number;
  multiStage: number;
  averageStages: number;
  averageProcessingHours: number | null;
  approvalRate: number | null;
  drafts: number;
}

export interface WorkflowDefinitionEvent {
  eventId: string;
  definitionId: string;
  action: string;
  actorId: string;
  details: Record<string, unknown>;
  createdAt: string;
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

  if (response.status === 204) {
    return undefined as T;
  }

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

export function listWorkflowDefinitions(search = "") {
  return request<WorkflowDefinition[]>(
    `?search=${encodeURIComponent(search)}`
  );
}

export function getWorkflowDefinitionSummary() {
  return request<WorkflowDefinitionSummary>("/summary");
}

export function getWorkflowDefinitionAudit(id: string) {
  return request<WorkflowDefinitionEvent[]>(
    `/${encodeURIComponent(id)}/audit`
  );
}

export function createWorkflowDefinition(input: WorkflowDefinitionInput) {
  return request<WorkflowDefinition>("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export function updateWorkflowDefinition(
  id: string,
  input: WorkflowDefinitionInput
) {
  return request<WorkflowDefinition>(
    `/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }
  );
}
export async function duplicateWorkflowDefinition(
  id: string
): Promise<WorkflowDefinition> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/approval-workflow-clones/${encodeURIComponent(id)}`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "X-Actor-Id": "DEMO-POLICY-ADMIN"
      }
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error?.message ??
      result.message ??
      `Unable to duplicate workflow (${response.status})`
    );
  }

  return result as WorkflowDefinition;
}
export function setWorkflowDefinitionStatus(
  id: string,
  status: DefinitionStatus
) {
  return request<WorkflowDefinition>(
    `/${encodeURIComponent(id)}/status`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    }
  );
}

export function deleteWorkflowDefinition(id: string) {
  return request<void>(
    `/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}