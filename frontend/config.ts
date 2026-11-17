export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export const API_ROUTES = Object.freeze({
    health: "/api/v1/health",
    clients: "/api/v1/clients",
    accounts: "/api/v1/accounts",
    transactions: "/api/v1/transactions",
    dashboard: "/api/v1/dashboard",
    riskDashboard: "/api/v1/risk/dashboard",
    riskAssessments: "/api/v1/risk-assessments",
    riskPolicies: "/api/v1/risk-policies",
    approvalsDashboard: "/api/v1/approvals/dashboard",
    approvalsQueue: "/api/v1/approvals/queue",
    approvalWorkflows: "/api/v1/approval-workflows",
    workflowActors: "/api/v1/workflow-actors"
});

export const ROUTES = Object.freeze({
    riskAlerts: "/risk/alerts",
    transactionHistory: "/transactions/history",
    dashboard: "/",
    clients: "/clients",
    clientRegistration: "/clients/new",
    clientDetails: (id: string) => `/clients/${encodeURIComponent(id)}`,
    clientEdit: (id: string) => `/clients/${encodeURIComponent(id)}/edit`,
    accounts: "/accounts",
    accountRegistration: "/accounts/new",
    accountDetails: (id: string) => `/accounts/${encodeURIComponent(id)}`,
    transactions: "/transactions",
    transactionCreate: "/transactions/new",
    transactionDetails: (id: string) => `/transactions/${encodeURIComponent(id)}`,

    risk: "/risk",
    riskAssessments: "/risk/assessments",
    riskAssessmentDetails: (id: string) =>
        `/risk/assessments/${encodeURIComponent(id)}`,
    riskPolicies: "/risk/policies",
    riskPolicyNew: "/risk/policies/new",
    riskPolicyDetails: (id: string) =>
        `/risk/policies/${encodeURIComponent(id)}`,
    riskPolicyEdit: (id: string) =>
        `/risk/policies/${encodeURIComponent(id)}/edit`,

    approvals: "/approvals",
    approvalsQueue: "/approvals/queue",
    approvalDetails: (id: string) =>
        `/approvals/${encodeURIComponent(id)}`
});

export const PAGINATION = Object.freeze({
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 5,
    PAGE_SIZE_OPTIONS: [5, 10, 20, 50, 100]
});

export const ENUMS = Object.freeze({
    CLIENT_STATUSES: ["Active", "Inactive", "Suspended"],
    ACCOUNT_TYPES: [
        "Operating",
        "Trade Finance",
        "Foreign Currency",
        "Savings",
        "Investment",
        "Escrow"
    ],
    ACCOUNT_STATUSES: ["Active", "Frozen", "Closed"],
    CURRENCIES: ["CAD", "USD"],
    TRANSACTION_STATUSES: ["Pending", "Processing", "Completed", "Rejected"]
});