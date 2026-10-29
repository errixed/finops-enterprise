
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
