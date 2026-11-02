import { API_BASE_URL, API_ROUTES } from "../../config";

export interface RecentTransaction {
    transactionId: string;
    referenceNumber: string;
    sourceAccountId: string;
    destinationAccountId: string;
    sourceAccountNumber: string;
    destinationAccountNumber: string;
    amountMinor: number;
    currency: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    processedAt: string | null;
}

export interface DashboardSummary {
    totalClients: number;
    activeClients: number;
    totalAccounts: number;
    activeAccounts: number;
    totalTransactions: number;

    pendingTransactions: number;
    processingTransactions: number;
    completedTransactions: number;
    rejectedTransactions: number;

    transactionStatuses: {
        Pending: number;
        Processing: number;
        Completed: number;
        Rejected: number;
    };

    completedVolumes: {
        CAD: number;
        USD: number;
    };

    recentTransactions: RecentTransaction[];
    recentProcessingActivity: RecentTransaction[];


    growthStatistics: {
        newClientsThisMonth: number;
        newAccountsThisMonth: number;
        completedTransactionsThisWeek: number;
    };

}

export async function getDashboardSummary(
    signal?: AbortSignal
): Promise<DashboardSummary> {
    const response = await fetch(
        `${API_BASE_URL}${API_ROUTES.dashboard}/summary`,
        {
            method: "GET",
            cache: "no-store",
            signal
        }
    );

    if (!response.ok) {
        throw new Error(
            `Unable to load dashboard: HTTP ${response.status}`
        );
    }

    return response.json();
}