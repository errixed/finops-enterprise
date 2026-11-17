import { API_BASE_URL, API_ROUTES } from "../../config";

export interface Client {
    clientId: string;
    companyName: string;
    registrationNumber: string;
    industry: string;
    country: string;
    contactEmail: string;
    contactPhone: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    accountCount?: number;
    clientType?: "Corporate" | "Individual";
    relationshipManager?: string | null;
    nextReviewAt?: string | null;

    operatingName?: string;
    incorporationDate?: string;
    currency?: string;
    organizationSize?: string;
    businessAddress?: string;
    city?: string;
    provinceState?: string;
    postalCode?: string;
    website?: string;
    riskRating?: "Low" | "Medium" | "High" | "Critical";
    complianceCategory?: string;
    kycStatus?: "Not Started" | "In Progress" | "Pending Review" | "Verified" | "Rejected";
    checklist?: string[];
    contacts?: {
        id: string;
        name: string;
        role: string;
        email: string;
        phone: string;
        primary: boolean;
    }[];

}

export interface Account {
    accountId: string;
    accountNumber: string;
    accountType: string;
    currency: string;
    balanceMinor: number;
    status: string;
}

export interface ClientProfile extends Client {
    accounts: Account[];
}

export interface ClientInput {
    companyName: string;
    registrationNumber: string;
    industry: string;
    country: string;
    contactEmail: string;
    contactPhone: string;
    clientType?: "Corporate" | "Individual";
    relationshipManager?: string | null;
    nextReviewAt?: string | null;

    operatingName?: string;
    incorporationDate?: string;
    currency?: string;
    organizationSize?: string;
    businessAddress?: string;
    city?: string;
    provinceState?: string;
    postalCode?: string;
    website?: string;
    riskRating?: "Low" | "Medium" | "High" | "Critical";
    complianceCategory?: string;
    kycStatus?: "Not Started" | "In Progress" | "Pending Review" | "Verified" | "Rejected";
    checklist?: string[];
    contacts?: {
        id: string;
        name: string;
        role: string;
        email: string;
        phone: string;
        primary: boolean;
    }[];

}

export interface ClientFilters {
    search?: string;
    industry?: string;
    country?: string;
    status?: string;
    page?: number;
    pageSize?: number;
    clientType?: string;
    relationshipManager?: string;
    dateFrom?: string;
    dateTo?: string;
}

export interface ClientListResult {
    data: Client[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export interface ClientOptions {
    industries: string[];
    countries: string[];
    statuses: string[];
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

export function getClients(filters: ClientFilters = {}) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
            params.set(key, String(value));
        }
    });

    return request<ClientListResult>(
        `${API_ROUTES.clients}?${params.toString()}`
    );
}

export function getClient(id: string) {
    return request<ClientProfile>(
        `${API_ROUTES.clients}/${encodeURIComponent(id)}`
    );
}

export function getClientOptions() {
    return request<ClientOptions>(
        `${API_ROUTES.clients}/options`
    );
}

export function registerClient(client: ClientInput) {
    return request<Client>(API_ROUTES.clients, {
        method: "POST",
        body: JSON.stringify(client)
    });
}

export function updateClient(
    id: string,
    changes: Partial<Omit<ClientInput, "registrationNumber">> & {
        status?: string;
    }
) {
    return request<Client>(
        `${API_ROUTES.clients}/${encodeURIComponent(id)}`,
        {
            method: "PATCH",
            body: JSON.stringify(changes)
        }
    );
}

export interface ClientDirectoryStatistics {
    totalClients: number;
    activeClients: number;
    activePercentage: number;
    newClients30Days: number;
}

export function getClientDirectoryStatistics() {
    return request<ClientDirectoryStatistics>(
        `${API_ROUTES.clients}/summary`
    );
}

export interface ClientDirectoryMetrics {
    totalClients: number;
    activeClients: number;
    corporateClients: number;
    individualClients: number;
    unclassifiedClients: number;
    highRiskClients: number;
    newClients30Days: number;
    clientsDueForReview: number;
}

export interface ClientOperationalReport {

    recentTransactions: {
        transactionId: string;
        referenceNumber: string;
        transactionType: string;
        amountMinor: string;
        currency: string;
        status: string;
        createdAt: string;
        processedAt: string | null;
    }[];

    accountCount: number;
    activeAccountCount: number;
    balancesByCurrency: {
        currency: string;
        balanceMinor: string;
    }[];
    transactionCount: number;
    transactionTrend: {
        month: string;
        count: number;
        volumeByCurrency: Record<string, string>;
    }[];
    latestRisk: {
        assessmentId: string;
        transactionId: string;
        riskScore: number;
        riskLevel: string;
        assessedAt: string;
    } | null;
    riskDistribution: {
        level: string;
        count: number;
    }[];
    pendingApprovals: {
        workflowId: string;
        transactionId: string;
        status: string;
        createdAt: string;
        transaction: {
            referenceNumber: string;
            amountMinor: number;
            currency: string;
        } | null;
    }[];
    highRiskTransactions: {
        transactionId: string;
        referenceNumber: string;
        amountMinor: number;
        currency: string;
        assessment: {
            riskLevel: string;
            riskScore: number;
        };
    }[];
}

export function getClientDirectoryMetrics() {
    return request<ClientDirectoryMetrics>(
        `${API_ROUTES.clients}/metrics`
    );
}

export function getClientOperationalReport(clientId: string) {
    return request<{
        client: ClientProfile;
        report: ClientOperationalReport;
    }>(
        `${API_ROUTES.clients}/${encodeURIComponent(clientId)}/report`
    );
}

export type ClientRiskLevel =
    | "Low"
    | "Medium"
    | "High"
    | "Critical"
    | "Not Assessed";

export interface ClientWithRisk extends Client {
    derivedRiskLevel: ClientRiskLevel;
}

export function deriveClientRiskLevel(
    report: ClientOperationalReport
): ClientRiskLevel {
    const counts = new Map(
        report.riskDistribution.map(item => [item.level, item.count])
    );

    if ((counts.get("Critical") ?? 0) > 0) return "Critical";
    if ((counts.get("High") ?? 0) > 0) return "High";
    if ((counts.get("Medium") ?? 0) > 0) return "Medium";
    if ((counts.get("Low") ?? 0) > 0) return "Low";

    return "Not Assessed";
}

export async function getClientsFilteredByRisk(
    filters: ClientFilters,
    riskLevels: ClientRiskLevel[]
): Promise<ClientListResult & {
    data: ClientWithRisk[];
}> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 8;

    const baseFilters = {
        ...filters,
        page: 1,
        pageSize: 100
    };

    const first = await getClients(baseFilters);
    const allClients = [...first.data];

    const totalPages = first.pagination.totalPages;

    for (let currentPage = 2; currentPage <= totalPages; currentPage++) {
        const result = await getClients({
            ...baseFilters,
            page: currentPage
        });

        allClients.push(...result.data);
    }

    const enriched: ClientWithRisk[] = [];

    for (let i = 0; i < allClients.length; i += 5) {
        const batch = allClients.slice(i, i + 5);

        const reports = await Promise.all(
            batch.map(async client => {
                const response = await getClientOperationalReport(
                    client.clientId
                );

                return {
                    ...client,
                    derivedRiskLevel: deriveClientRiskLevel(
                        response.report
                    )
                };
            })
        );

        enriched.push(...reports);
    }

    const filtered = enriched.filter(client =>
        riskLevels.includes(client.derivedRiskLevel)
    );

    return {
        data: filtered.slice(
            (page - 1) * pageSize,
            page * pageSize
        ),
        pagination: {
            page,
            pageSize,
            total: filtered.length,
            totalPages: Math.ceil(filtered.length / pageSize)
        }
    };
}

export function parseClientCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let inQuotes = false;

    const content = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < content.length; i++) {
        const char = content[i];

        if (char === '"') {
            if (inQuotes && content[i + 1] === '"') {
                cell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            row.push(cell);
            cell = "";
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && content[i + 1] === "\n") i++;
            row.push(cell);
            if (row.some(value => value.trim() !== "")) {
                rows.push(row);
            }
            row = [];
            cell = "";
        } else {
            cell += char;
        }
    }

    if (inQuotes) {
        throw new Error("CSV contains an unclosed quoted field.");
    }

    row.push(cell);
    if (row.some(value => value.trim() !== "")) {
        rows.push(row);
    }

    return rows;
}
