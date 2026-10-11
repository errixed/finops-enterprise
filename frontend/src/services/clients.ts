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
}

export interface ClientFilters {
    search?: string;
    status?: string;
    industry?: string;
    page?: number;
    pageSize?: number;
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
        throw new Error(data.error || "Request failed");
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
