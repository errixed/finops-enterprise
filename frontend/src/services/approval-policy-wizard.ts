
import { API_BASE_URL } from "../../config";

const BASE = `${API_BASE_URL}/api/v1/approval-policy-wizard`;

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";
export type Role =
  | "OperationsReviewer"
  | "SeniorReviewer"
  | "ComplianceReviewer";

export type PolicyRule = {
  ruleId: string;
  field: "transactionAmount" | "transactionType" | "clientRiskRating";
  operator: "eq" | "ne" | "gte" | "gt" | "lte" | "lt" | "in";
  value: number | string | string[];
};

export type PolicyMapping = {
  riskLevel: RiskLevel;
  workflowId: string;
  workflowType: "Sequential" | "Parallel";
  stages: Role[];
};

export type StageSla = {
  riskLevel: RiskLevel;
  stageNumber: number;
  role: Role;
  target: number;
  unit: "Hours" | "Days";
  hoursMode: "Business" | "Calendar";
};

export type NotificationEvent =
  | "ApprovalRequestCreated"
  | "ApprovalAssigned"
  | "ApprovalDecision"
  | "SlaWarning"
  | "SlaBreach"
  | "PolicyStatusChanged";

export type PolicyNotification = {
  event: NotificationEvent;
  inApp: boolean;
  email: boolean;
  recipients: string[];
};

export type PolicyWizardConfig = {
  details: {
    name: string;
    version: string;
    description: string;
    policyType: "TransactionApproval" | "AccountChange" | "Exception";
    effectiveDate: string;
    owner: string;
  };
  riskRanges: Array<{
    level: RiskLevel;
    min: number;
    max: number;
    description: string;
  }>;
  rules: PolicyRule[];
  ruleLogic: "AND" | "OR";
  mappings: PolicyMapping[];
  segregationOfDuties: boolean;
  stageSlas: StageSla[];
  escalation: {
    trigger: "SlaNotMet" | "AtRisk";
    escalateTo: "NextLevel" | Role;
    delay: number;
    unit: "Hours" | "Days";
    notifyPrevious: boolean;
    autoAssignAlternate: boolean;
  };
  monitoring: {
    trackKpis: boolean;
    includeReports: boolean;
    alertOnBreach: boolean;
  };
  notifications: PolicyNotification[];
  review: {
    requireApproval: boolean;
    notifyOnChange: boolean;
    complianceReview: boolean;
  };
};

export type AvailableWorkflow = {
  definitionId: string;
  name: string;
  riskLevels: string[];
  stages: Role[];
  status: "Active" | "Inactive";
};

export type SavedWizard = {
  policyId: string;
  wizardConfig: PolicyWizardConfig;
  wizardCompleted: boolean;
};

async function api<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE}${url}`, {
    cache: "no-store",
    ...options,
    headers: {
      "X-Actor-Id": "DEMO-POLICY-ADMIN",
      ...options.headers
    }
  });

  if (response.status === 204) return undefined as T;

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body.error?.message ??
      body.message ??
      `Request failed (${response.status})`
    );
  }

  return body as T;
}

export function getWizardWorkflows() {
  return api<AvailableWorkflow[]>("/workflows");
}

export function loadWizardDraft(id: string) {
  return api<SavedWizard>(
    `/${encodeURIComponent(id)}`
  );
}

export function saveWizardDraft(
  config: PolicyWizardConfig,
  id?: string,
  complete = false
) {
  return api<SavedWizard>(
    id ? `/${encodeURIComponent(id)}` : "/",
    {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, complete })
    }
  );
}

export function deleteWizardDraft(id: string) {
  return api<void>(
    `/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}
