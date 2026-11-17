
import { API_BASE_URL } from "../../config";

export type AuditEntityType =
  | "All"
  | "Decision"
  | "Workflow"
  | "WorkflowDefinition";

export type AuditAction =
  | "All"
  | "Creates"
  | "Updates"
  | "Deletes"
  | "Access"
  | "Configuration"
  | "Approved"
  | "Rejected"
  | "Escalated";

export interface AuditFilters {
  entityType: AuditEntityType;
  entity: string;
  action: AuditAction;
  user: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  sortBy: "date" | "user" | "action" | "entityType";
  sortOrder: "asc" | "desc";
}

export interface AuditEvent {
  id: string;
  date: string;
  actorId: string;
  actorName: string;
  entityType: string;
  entityId: string;
  action: string;
  category: string;
  group: string;
  description: string;
  details: Record<string, unknown>;
  source: string;
  workflowId?: string;
  transactionId?: string;
  policyId?: string;
  policyVersion?: string | number;
  comments?: string;
  role?: string;
  stageNumber?: number;
}

export interface AuditResult {
  data: AuditEvent[];
  summary: {
    total: number;
    creates: number;
    updates: number;
    deletes: number;
    access: number;
    configuration: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    entities: Array<{ value: string; label: string }>;
    users: Array<{ value: string; label: string }>;
  };
  period: {
    from: string;
    to: string;
  };
}

export async function getApprovalAuditTrail(
  filters: AuditFilters,
  signal?: AbortSignal
): Promise<AuditResult> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== "all" && value !== "All") {
      params.set(key, String(value));
    }
  });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/approval-audit-trail?${params.toString()}`,
    { cache: "no-store", signal }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error?.message ??
      result.message ??
      `Audit trail request failed (${response.status})`
    );
  }

  return result as AuditResult;
}
