import { API_BASE_URL, API_ROUTES } from "../../config";


export interface Account {
    accountId: string;
    clientId: string;
    accountNumber: string;
    accountType: string;
    accountName?: string;
    currency: string;
    purpose?: string;
    status: string;
    openDate?: string;
    balanceMinor: number;
    initialBalanceMinor?: number;
    creditLimitMinor?: number | null;
    outstandingCreditMinor?: number | null;
    allowTransactions?: boolean;
    allowInternationalTransactions?: boolean;
    requireDualApproval?: boolean;
    temporaryAccount?: boolean;
    notes?: string;
    createdAt: string;
    updatedAt?: string;
    companyName?: string;
}

export interface AccountInput {
    clientId: string;
    accountType: string;
    accountName: string;
    currency: string;
    purpose: string;
    status: string;
    openDate: string;
    balanceMinor: number;
    creditLimitMinor: number | null;
    allowTransactions: boolean;
    allowInternationalTransactions: boolean;
    requireDualApproval: boolean;
    temporaryAccount: boolean;
    notes: string;
}


export interface Transaction {
    transactionId: string;
    referenceNumber: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amountMinor: number;
    currency: string;
    transactionType?: string;
    status: string;
    createdAt: string;
    description?: string | null;
    processedAt?: string | null;
}

export interface AccountDetails extends Account {
    companyName: string;
    clientStatus: string;
    transactions: Transaction[];
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

export interface AccountFinancialReport {
    accountId: string;
    balanceMinor: number;
    currency: string;
    status: string;
    creditLimitMinor: number | null;
    availableLimitMinor: number | null;
    utilizationPercent: number | null;
}

export interface AccountWithActivity extends Account {
    lastActivityAt: string | null;
}

export function getAccountsWithActivity(
    filters: AccountFilters = {}
) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });

    return request<AccountWithActivity[]>(
        `${API_ROUTES.accounts}/with-activity?${params.toString()}`
    );
}

export interface AccountBalancePoint {
    month: string;
    balanceMinor: number | null;
    observedAt: string | null;
}

export interface AccountAuditEvent {
    eventId: string;
    accountId: string;
    eventType: string;
    actorId: string;
    details: Record<string, unknown>;
    occurredAt: string;
}

export interface AccountOperationsReport {
    history: {
        accountId: string;
        currency: string;
        trackingStartedAt: string | null;
        months: AccountBalancePoint[];
    };
    audit: AccountAuditEvent[];
    financial: {
        accountId: string;
        balanceMinor: number;
        currency: string;
        status: string;
        creditLimitMinor: number | null;
        outstandingCreditMinor: number | null;
        availableLimitMinor: number | null;
        utilizationPercent: number | null;
    };
}

export function getAccountOperationsReport(
    accountId: string,
    months: 3 | 6 | 12 = 6
) {
    return request<AccountOperationsReport>(
        `${API_ROUTES.accounts}/${encodeURIComponent(accountId)}/report?months=${months}`
    );
}

export async function downloadAccountStatement(
    accountId: string,
    from: string,
    to: string
) {
    const params = new URLSearchParams({ from, to });

    const response = await fetch(
        `${API_BASE_URL}${API_ROUTES.accounts}/${encodeURIComponent(accountId)}/statement?${params}`,
        { cache: "no-store" }
    );

    if (!response.ok) {
        throw new Error("Unable to generate account statement.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `account-${accountId}-statement.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
}
