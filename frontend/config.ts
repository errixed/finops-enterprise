export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:3000";

export const API_ROUTES = {
    health: "/api/v1/health",
    clients: "/api/v1/clients",
    accounts: "/api/v1/accounts",
    transactions: "/api/v1/transactions",
    dashboard: "/api/v1/dashboard",
};