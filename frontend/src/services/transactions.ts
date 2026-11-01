
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
}

export interface TransactionFilters {
    search?: string;
    sourceAccountId?: string;
    status?: string;
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