export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:3000";

export const API_ROUTES = Object.freeze({
    health: "/api/v1/health",
    clients: "/api/v1/clients",
    accounts: "/api/v1/accounts",
    transactions: "/api/v1/transactions",
    dashboard: "/api/v1/dashboard"
});

export const ROUTES = Object.freeze({
    dashboard: "/",
    clients: "/clients",
    clientRegistration: "/clients/new",
    clientDetails: (id: string) => `/clients/${id}`,
    clientEdit: (id: string) => `/clients/${id}/edit`,
    accounts: "/accounts",
    accountRegistration: "/accounts/new",
    accountDetails: (id: string) => `/accounts/${id}`,
    transactions: "/transactions",
    transactionDetails: (id: string) => `/transactions/${id}`
});

export const PAGINATION = Object.freeze({
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 5,
    PAGE_SIZE_OPTIONS: [5, 10, 20, 50, 100]
});

export const ENUMS = Object.freeze({
    CLIENT_STATUSES: ["Active", "Inactive", "Suspended"],
    ACCOUNT_TYPES: ["Operating", "Savings", "Investment"],
    ACCOUNT_STATUSES: ["Active", "Frozen", "Closed"],
    CURRENCIES: ["CAD", "USD"],
    TRANSACTION_STATUSES: ["Pending", "Completed", "Rejected"]
});