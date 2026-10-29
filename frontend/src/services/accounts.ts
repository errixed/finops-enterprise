import { API_BASE_URL, API_ROUTES } from "../../config";

export interface Account {
    accountId: string;
    clientId: string;
    accountNumber: string;
    accountType: string;
    currency: string;
    balanceMinor: number;
    status: string;
    createdAt: string;
    companyName?: string;
}

export interface Transaction {
    transactionId: string;
    referenceNumber: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amountMinor: number;
    currency: string;
    status: string;
    createdAt: string;
}

export interface AccountDetails extends Account {
    companyName: string;
    clientStatus: string;
    transactions: Transaction[];
}

export interface AccountInput {
    clientId: string;
    accountType: string;
    currency: string;
    balanceMinor: number;
}

export interface AccountFilters {
    clientId?: string;
    accountType?: string;
    currency?: string;
    status?: string;
}

async function request<T>(
    endpoint: string,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
            ...options,
            cache: "no-store",
            headers: {
                "Content-Type": "application/json",
                ...options?.headers
            }
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

export function getAccounts(filters: AccountFilters = {}) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });

    return request<Account[]>(
        `${API_ROUTES.accounts}?${params.toString()}`
    );
}

export function getAccount(accountId: string) {
    return request<AccountDetails>(
        `${API_ROUTES.accounts}/${encodeURIComponent(accountId)}`
    );
}

export function registerAccount(input: AccountInput) {
    return request<Account>(API_ROUTES.accounts, {
        method: "POST",
        body: JSON.stringify(input)
    });
}

export function formatMoney(balanceMinor: number, currency: string) {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency
    }).format(balanceMinor / 100);
}

export function parseMoney(value: string): number {
    const amount = value.trim();

    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount)) {
        throw new Error(
            "Enter a non-negative amount with at most two decimal places"
        );
    }

    const [whole, decimal = ""] = amount.split(".");

    const minor =
        BigInt(whole) * BigInt(100) +
        BigInt(decimal.padEnd(2, "0"));

    if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("Opening balance exceeds the supported range");
    }

    return Number(minor);
}