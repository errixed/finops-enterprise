
import { API_BASE_URL } from "../../config";

const BASE = `${API_BASE_URL}/api/v1/risk-cases`;

export type CaseStatus =
  | "Open"
  | "In Investigation"
  | "Resolved";

export type CaseRiskLevel =
  | "Low"
  | "Medium"
  | "High"
  | "Critical";

export interface RiskCase {
  caseId: string;
  subject: string;
  summary: string;
  nextAction: string;
  clientId: string | null;
  clientName: string;
  transactionId: string | null;
  riskLevel: CaseRiskLevel;
  status: CaseStatus;
  assignedTo: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  createdBy: string;
  source?: "Risk Assessment" | "Manual" | "External Referral";
  assessmentId?: string | null;
  triggeringRuleIds?: string[];
  priority?: CaseRiskLevel;
  dueDate?: string | null;
  description?: string;
  initialNote?: string;
}

export interface CaseListResponse {
  data: RiskCase[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CaseSummary {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  averageResolutionDays: number | null;
  totalChange: number | null;
  resolutionChange: number | null;
}

export interface CaseEvent {
  eventId: string;
  caseId: string;
  action: string;
  details: string;
  actorId: string;
  createdAt: string;
}

export interface CaseTriggerResponse {
  assessment: {
    assessmentId: string;
    policyId: string;
    policyVersion: number;
    riskScore: number;
    riskLevel: CaseRiskLevel;
    assessedAt: string;
  } | null;
  triggeredRules: {
    ruleId: string;
    points: number;
    reason: string;
    evaluatedInput?: unknown;
  }[];
}

export interface CaseDocument {
  documentId: string;
  filename: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  uploadedBy: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      "X-Actor-Id": "DEMO-USER",
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
      `Request failed: HTTP ${response.status}`
    );
  }

  return result as T;
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

export function getCaseSummary(period: string) {
  return request<CaseSummary>(
    `/summary?period=${encodeURIComponent(period)}`
  );
}

export function getRiskCases(filters: {
  period: string;
  status: string;
  search: string;
  page: number;
  pageSize: number;
}) {
  const parameters = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    parameters.set(key, String(value));
  }

  return request<CaseListResponse>(`/?${parameters}`);
}

export function getCase(id: string) {
  return request<RiskCase>(`/${encodeURIComponent(id)}`);
}

export interface CreateCaseInput {
  subject: string;
  source: "Risk Assessment" | "Manual" | "External Referral";
  assessmentId: string;
  triggeringRuleIds: string[];
  priority: CaseRiskLevel;
  riskLevel: CaseRiskLevel;
  status: "Open" | "In Investigation";
  assignedTo: string;
  dueDate: string;
  description: string;
  summary: string;
  initialNote: string;
  nextAction: string;
  clientId: string;
  transactionId: string;
}

export interface CaseAssessmentOption {
  assessmentId: string;
  transactionId: string;
  riskScore: number;
  riskLevel: CaseRiskLevel;
  assessedAt: string;
  triggeredRules: {
    ruleId: string;
    points?: number;
    reason?: string;
  }[];
}

export interface CaseTransactionOption {
  transactionId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: number | null;
  amount: number | null;
  currency: string;
  createdAt: string;
  referenceNumber: string;
}

export interface CaseActorOption {
  actorId: string;
  name: string;
  role: string;
}

export interface CaseRuleOption {
  ruleId: string;
  name: string;
}

export async function getCreateCaseOptions<
  T extends "assessments" | "transactions" | "actors" | "rules"
>(
  type: T,
  search = ""
): Promise<
  T extends "assessments" ? CaseAssessmentOption[] :
  T extends "transactions" ? CaseTransactionOption[] :
  T extends "actors" ? CaseActorOption[] :
  CaseRuleOption[]
> {
  const parameters = new URLSearchParams({ type, q: search });

  return request<
    T extends "assessments" ? CaseAssessmentOption[] :
    T extends "transactions" ? CaseTransactionOption[] :
    T extends "actors" ? CaseActorOption[] :
    CaseRuleOption[]
  >(`/create-options?${parameters}`);
}

export function createCase(input: CreateCaseInput) {
  return request<RiskCase>("/", json("POST", input));
}

export function updateCase(
  id: string,
  changes: Partial<Pick<
    RiskCase,
    "subject" | "summary" | "nextAction" |
    "assignedTo" | "status"
  >>
) {
  return request<RiskCase>(
    `/${encodeURIComponent(id)}`,
    json("PATCH", changes)
  );
}

export function resolveCase(id: string, resolution: string) {
  return request<RiskCase>(
    `/${encodeURIComponent(id)}/resolve`,
    json("POST", { resolution })
  );
}

export function getCaseEvents(id: string) {
  return request<CaseEvent[]>(
    `/${encodeURIComponent(id)}/events`
  );
}

export function addCaseNote(id: string, note: string) {
  return request<{ message: string }>(
    `/${encodeURIComponent(id)}/notes`,
    json("POST", { note })
  );
}

export function getCaseTriggers(id: string) {
  return request<CaseTriggerResponse>(
    `/${encodeURIComponent(id)}/triggers`
  );
}

export function getCaseDocuments(id: string) {
  return request<CaseDocument[]>(
    `/${encodeURIComponent(id)}/documents`
  );
}

export function uploadCaseDocument(id: string, file: File) {
  return request<{ documentId: string; filename: string }>(
    `/${encodeURIComponent(id)}/documents`,
    {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-Filename": encodeURIComponent(file.name)
      },
      body: file
    }
  );
}

export async function downloadCaseDocument(
  id: string,
  document: CaseDocument
) {
  const response = await fetch(
    `${BASE}/${encodeURIComponent(id)}/documents/${encodeURIComponent(document.documentId)}`,
    {
      headers: { "X-Actor-Id": "DEMO-USER" }
    }
  );

  if (!response.ok) {
    throw new Error("Unable to download document");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");

  anchor.href = url;
  anchor.download = document.filename;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function deleteCaseDocument(id: string, documentId: string) {
  return request<void>(
    `/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`,
    { method: "DELETE" }
  );
}
