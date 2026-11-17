
import { API_BASE_URL, API_ROUTES } from "../../config";

export interface Transaction {
    transactionId: string;
    referenceNumber: string;
    sourceAccountId: string;
    destinationAccountId: string;
    sourceAccountNumber: string;
    destinationAccountNumber: string;
    amountMinor: number;
    currency: string;
    transactionType: string;
    status: string;
    description: string;
    createdAt: string;
}

export interface RelatedAccount {
    accountId: string;
    accountNumber: string;
    clientId: string;
    currency: string;
}

export interface TransactionDetails extends Omit<
    Transaction,
    "sourceAccountNumber" | "destinationAccountNumber"
> {
    sourceAccount: RelatedAccount;
    destinationAccount: RelatedAccount;

    updatedAt: string;
    processedAt: string | null;

    isLegacy: boolean;
    rejectionCode: string | null;
    rejectionReason: string | null;

    riskAssessmentId?: string | null;
    riskScore?: number | null;
    riskLevel?: "Low" | "Medium" | "High" | "Critical" | null;
    approvalRequired?: boolean;
    approvalWorkflowId?: string | null;
    approvalStatus?: string | null;

}

export interface TransactionFilters {
    search?: string;
    sourceAccountId?: string;
    status?: string;
    currency?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
}

export interface TransactionListResult {
    data: Transaction[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

async function request<T>(endpoint: string): Promise<T> {
    const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
            method: "GET",
            cache: "no-store"
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error?.message ?? "Request failed"
        );
    }

    return data as T;
}

export function getTransactions(filters: TransactionFilters = {}) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
            params.set(key, String(value));
        }
    });

    const query = params.toString();

    return request<TransactionListResult>(
        `${API_ROUTES.transactions}${query ? `?${query}` : ""}`
    );
}

export function getTransaction(transactionId: string) {
    return request<TransactionDetails>(
        `${API_ROUTES.transactions}/${encodeURIComponent(transactionId)}`
    );
}

export interface TransactionInput {
    sourceAccountId: string;
    destinationAccountId: string;
    amountMinor: number;
    currency: string;
    description: string;
}

export interface InitiatedTransaction {
    transactionId: string;
    referenceNumber: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amountMinor: number;
    currency: string;
    transactionType: string;
    status: string;
    description: string;
    createdAt: string;
    processedAt: string | null;
}

export async function initiateTransaction(
    input: TransactionInput,
    idempotencyKey: string
): Promise<InitiatedTransaction> {
    const response = await fetch(
        `${API_BASE_URL}${API_ROUTES.transactions}`,
        {
            method: "POST",
            cache: "no-store",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": idempotencyKey
            },
            body: JSON.stringify(input)
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.error?.message ??
            "Unable to initiate transaction"
        );
    }

    return result.data as InitiatedTransaction;
}

export async function processTransaction(
    transactionId: string
): Promise<TransactionDetails> {
    const response = await fetch(
        `${API_BASE_URL}${API_ROUTES.transactions}/${encodeURIComponent(transactionId)}/process`,
        {
            method: "POST",
            cache: "no-store"
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.error?.message ??
            "Unable to process transaction"
        );
    }

    return result.data as TransactionDetails;
}

export interface DirectoryTransaction extends Transaction {
    clientId: string | null;
    companyName: string | null;
    sourceAccountName: string | null;
    destinationAccountName: string | null;
    riskLevel: string | null;
    riskScore: number | null;
    approvalStatus: string | null;
    updatedAt?: string;
}

export interface DirectoryFilters {
    search?: string;
    clientId?: string;
    accountId?: string;
    transactionType?: string;
    status?: string;
    riskLevel?: string;
    approvalStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
}

export interface DirectoryResult {
    data: DirectoryTransaction[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
    summary: {
        totalTransactions: number;
        highCriticalRisk: number;
        pendingApproval: number;
        totalInternalCreditsCADMinor: string;
        totalInternalDebitsCADMinor: string;
        netInternalChangeCADMinor: string;
    };
}

export function getTransactionDirectory(
    filters: DirectoryFilters = {}
) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
            params.set(key, String(value));
        }
    });

    return request<DirectoryResult>(
        `${API_ROUTES.transactions}/directory?${params.toString()}`
    );
}

export interface TransactionRiskPreview {
    riskScore: number;
    riskLevel: "Low" | "Medium" | "High" | "Critical";
    triggeredRules: {
        ruleId: string;
        points: number;
        reason: string;
        evaluatedInput: unknown;
    }[];
    approvalRequired: boolean;
    requiredRoles: string[];
    provisional: true;
}

export async function previewTransaction(
    input: TransactionInput
): Promise<TransactionRiskPreview> {
    const response = await fetch(
        `${API_BASE_URL}${API_ROUTES.transactions}/preview`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
            cache: "no-store"
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.error?.message ??
            "Unable to preview transaction risk"
        );
    }

    return result as TransactionRiskPreview;
}

export interface TransactionHistoryStatistics {
    total: number;
    completed: number;
    inReview: number;
    blocked: number;
    completedCADMinor: string;
}

export interface TransactionHistoryResult extends DirectoryResult {
    statistics: TransactionHistoryStatistics;
}

export interface TransactionDocumentHistoryEvent {
    eventId: string;
    transactionId: string;
    documentId: string;
    eventType: string;
    actorId: string;
    occurredAt: string;
}

export function getTransactionHistory(
    filters: DirectoryFilters = {}
) {
    const parameters = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
            parameters.set(key, String(value));
        }
    });

    return request<TransactionHistoryResult>(
        `${API_ROUTES.transactions}/history?${parameters.toString()}`
    );
}

export function getTransactionDocumentHistory(
    transactionId: string
) {
    return request<{ data: TransactionDocumentHistoryEvent[] }>(
        `${API_ROUTES.transactions}/${encodeURIComponent(transactionId)}/document-history`
    );
}
