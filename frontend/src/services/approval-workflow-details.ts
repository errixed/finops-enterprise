import { API_BASE_URL } from "../../config";
import type {
  WorkflowDefinition,
  WorkflowDefinitionEvent
} from "@/services/approval-workflow-definitions";

const BASE = `${API_BASE_URL}/api/v1/approval-workflow-definition-details`;

export type ConditionField = "riskLevel" | "transactionType" | "amount";
export type ConditionOperator = "eq" | "ne" | "gte" | "gt" | "lte" | "lt" | "in";

export interface WorkflowCondition {
  conditionId: string;
  field: ConditionField;
  operator: ConditionOperator;
  value: string | number | string[];
}

export interface WorkflowStageDefinition {
  stageId: string;
  stageNumber: number;
  name: string;
  reviewerRole: string;
  decisionType: "ApproveReject" | "ReviewRecommend";
  slaBusinessDays: number;
}

export interface WorkflowActorSummary {
  actorId: string;
  name: string;
  role: string;
  status?: string;
  isActive?: boolean;
}

export interface DetailedWorkflowDefinition extends WorkflowDefinition {
  workflowCode?: string;
  stageDefinitions?: WorkflowStageDefinition[];
  conditions?: WorkflowCondition[];
  conditionLogic?: "AND" | "OR";
  scope?: { currencies: string[] };
  transactionType?: string;
  slaCalculation?: "PerStage" | "EndToEnd";
  autoEscalate?: boolean;
  escalationRole?: string;
  allowParallel?: boolean;
  requireReapproval?: boolean;
  assignmentMode?: "RoleBased" | "PoolBased";
  selectionStrategy?: "RoundRobin" | "Manual";
  segregationOfDuties?: boolean;
  notifications?: {
    onAssignment: boolean;
    beforeDue: boolean;
    onEscalation: boolean;
  };
  isDraft?: boolean;
  businessHours?: {
    timeZone: string;
    start: string;
    end: string;
    weekdays: number[];
  };

  escalationRules?: Array<{
    ruleId: string;
    trigger: "SlaBreach" | "SecondBreach" | "AgeThreshold";
    action: "Escalate" | "ComplianceReview" | "PriorityEscalation";
    escalateTo: string;
    notification: "None" | "InApp" | "EmailInApp";
    ageBusinessDays: number;
  }>;
}

export interface WorkflowDetailsResult {
  definition: DetailedWorkflowDefinition;
  actors: WorkflowActorSummary[];
  audit: WorkflowDefinitionEvent[];
}

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    cache: "no-store",
    headers: {
      "X-Actor-Id": "DEMO-POLICY-ADMIN",
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
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

export function fetchWorkflowDetails(id: string) {
  return request<WorkflowDetailsResult>(
    `/${encodeURIComponent(id)}`
  );
}

export function saveWorkflowStages(
  id: string,
  stageDefinitions: WorkflowStageDefinition[]
) {
  return request<DetailedWorkflowDefinition>(
    `/${encodeURIComponent(id)}/stages`,
    "PUT",
    { stageDefinitions }
  );
}

export function saveWorkflowConditions(
  id: string,
  conditions: WorkflowCondition[],
  conditionLogic: "AND" | "OR",
  currencies: string[]
) {
  return request<DetailedWorkflowDefinition>(
    `/${encodeURIComponent(id)}/conditions`,
    "PUT",
    {
      conditions,
      conditionLogic,
      scope: { currencies }
    }
  );
}

export function saveWorkflowAssignments(
  id: string,
  assignmentMode: "RoleBased" | "PoolBased",
  selectionStrategy: "RoundRobin" | "Manual",
  segregationOfDuties: boolean
) {
  return request<DetailedWorkflowDefinition>(
    `/${encodeURIComponent(id)}/assignments`,
    "PUT",
    {
      assignmentMode,
      selectionStrategy,
      segregationOfDuties
    }
  );
}

export function saveWorkflowSla(
  id: string,
  settings: {
    slaCalculation: "PerStage" | "EndToEnd";
    autoEscalate: boolean;
    escalationRole: string;
    allowParallel: boolean;
    requireReapproval: boolean;
    notifications: {
      onAssignment: boolean;
      beforeDue: boolean;
      onEscalation: boolean;
    };
  }
) {
  return request<DetailedWorkflowDefinition>(
    `/${encodeURIComponent(id)}/sla`,
    "PUT",
    settings
  );
}
