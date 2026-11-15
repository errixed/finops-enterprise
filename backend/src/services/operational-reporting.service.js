import {
    getRiskIndicators,
    getApprovalIndicators,
    findActionableApprovalWorkflows
} from "../repositories/operational-reporting.repository.js";

import {
    findActiveWorkflowActor
} from "../repositories/workflow-actor.repository.js";

import {
    parsePagination
} from "../utils/pagination.js";

const RISK_LEVELS = [
    "Low",
    "Medium",
    "High",
    "Critical"
];

const WORKFLOW_STATUSES = [
    "Pending",
    "InReview",
    "Escalated",
    "Approved",
    "Rejected",
    "Cancelled"
];

function fail(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
}

export async function getRiskDashboard() {
    const indicators = await getRiskIndicators();

    const riskLevels = Object.fromEntries(
        RISK_LEVELS.map(level => [level, 0])
    );

    for (const item of indicators.levels) {
        if (Object.hasOwn(riskLevels, item._id)) {
            riskLevels[item._id] = item.count;
        }
    }

    const totalAssessments =
        indicators.summary?.totalAssessments ?? 0;

    const riskDistribution = RISK_LEVELS.map(level => ({
        level,
        count: riskLevels[level],
        percentage: totalAssessments === 0
            ? 0
            : Number(
                (
                    riskLevels[level] /
                    totalAssessments *
                    100
                ).toFixed(2)
            )
    }));

    return {
        totalAssessments,
        averageRiskScore: Number(
            (
                indicators.summary?.averageRiskScore ?? 0
            ).toFixed(2)
        ),
        approvalRequiredCount:
            indicators.summary?.approvalRequiredCount ?? 0,
        awaitingApproval: indicators.awaitingApproval,
        riskLevels,
        riskDistribution,
        recentHighRiskAssessments:
            indicators.recentHighRisk
    };
}

export async function getApprovalsDashboard() {
    const indicators = await getApprovalIndicators();

    const workflowStatuses = Object.fromEntries(
        WORKFLOW_STATUSES.map(status => [status, 0])
    );

    for (const item of indicators.statusGroups) {
        if (Object.hasOwn(workflowStatuses, item._id)) {
            workflowStatuses[item._id] = item.count;
        }
    }

    const totalWorkflows = Object.values(
        workflowStatuses
    ).reduce((sum, count) => sum + count, 0);

    return {
        totalWorkflows,
        pendingWorkflows: workflowStatuses.Pending,
        inReviewWorkflows: workflowStatuses.InReview,
        approvedWorkflows: workflowStatuses.Approved,
        rejectedWorkflows: workflowStatuses.Rejected,
        escalatedWorkflows: workflowStatuses.Escalated,
        cancelledWorkflows: workflowStatuses.Cancelled,
        awaitingReview:
            workflowStatuses.Pending +
            workflowStatuses.InReview,
        highRiskPendingApprovals:
            indicators.highRiskPendingApprovals,
        averageApprovalCompletionMinutes:
            indicators.averageCompletionMs === null
                ? null
                : Number(
                    (
                        indicators.averageCompletionMs /
                        60000
                    ).toFixed(2)
                ),
        completedApprovalCount:
            indicators.completedCount,
        totalDecisions: indicators.totalDecisions,
        recentDecisions: indicators.recentDecisions,
        workflowStatuses
    };
}

const QUEUE_STATUSES = [
    "Pending",
    "InReview",
    "Escalated"
];

const REVIEWER_ROLES = [
    "OperationsReviewer",
    "SeniorReviewer",
    "ComplianceReviewer"
];

function parseAmount(value, field) {
    if (value === undefined || value === "") {
        return null;
    }

    if (
        typeof value !== "string" ||
        !/^\d+(\.\d{1,2})?$/.test(value)
    ) {
        fail(`${field} must be a non-negative amount with at most two decimal places`);
    }

    const [whole, fraction = ""] = value.split(".");

    const minor = Number(whole) * 100 +
        Number(fraction.padEnd(2, "0"));

    if (!Number.isSafeInteger(minor)) {
        fail(`${field} exceeds the supported amount range`);
    }

    return minor;
}

function parseQueueDate(value, field) {
    if (value === undefined || value === "") {
        return null;
    }

    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        fail(`${field} must use YYYY-MM-DD`);
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
    ) {
        fail(`${field} is not a valid date`);
    }

    return date;
}

export async function getApprovalQueue(query = {}) {
    const {
        actorId = "",
        riskLevel = "",
        status = "",
        requiredRole = "",
        currency = "",
        minAmount = "",
        maxAmount = "",
        dateFrom = "",
        dateTo = "",
        sortBy = "createdAt",
        sortOrder = "asc",
        page = 1,
        pageSize = 10
    } = query;

    const textFields = [
        actorId,
        riskLevel,
        status,
        requiredRole,
        currency,
        sortBy,
        sortOrder
    ];

    if (textFields.some(value => typeof value !== "string")) {
        fail("Invalid approval queue filters");
    }

    if (riskLevel && !RISK_LEVELS.includes(riskLevel)) {
        fail("Unsupported risk level");
    }

    if (status && !QUEUE_STATUSES.includes(status)) {
        fail("Unsupported actionable workflow status");
    }

    if (
        requiredRole &&
        !REVIEWER_ROLES.includes(requiredRole)
    ) {
        fail("Unsupported reviewer role");
    }

    if (currency && !["CAD", "USD"].includes(currency)) {
        fail("Unsupported currency");
    }

    if (
        !["createdAt", "riskScore", "amount"].includes(sortBy)
    ) {
        fail("Unsupported sort field");
    }

    if (!["asc", "desc"].includes(sortOrder)) {
        fail("Unsupported sort direction");
    }

    const minimum = parseAmount(minAmount, "minAmount");
    const maximum = parseAmount(maxAmount, "maxAmount");

    if (
        minimum !== null &&
        maximum !== null &&
        minimum > maximum
    ) {
        fail("minAmount cannot exceed maxAmount");
    }

    const from = parseQueueDate(dateFrom, "dateFrom");
    const to = parseQueueDate(dateTo, "dateTo");

    if (from && to && from.getTime() > to.getTime()) {
        fail("dateFrom cannot exceed dateTo");
    }

    const exclusiveEnd = to
        ? new Date(to.getTime() + 86400000)
        : null;

    const pagination = parsePagination(page, pageSize);

    let effectiveRole = requiredRole;

    if (actorId.trim()) {
        const actor = await findActiveWorkflowActor(
            actorId.trim()
        );

        if (!actor) {
            fail("Workflow actor not found", 404);
        }

        if (
            effectiveRole &&
            effectiveRole !== actor.role
        ) {
            return {
                data: [],
                pagination: {
                    page: pagination.page,
                    pageSize: pagination.pageSize,
                    total: 0,
                    totalPages: 0
                }
            };
        }

        effectiveRole = actor.role;
    }

    const result = await findActionableApprovalWorkflows({
        actorId: actorId.trim(),
        requiredRole: effectiveRole,
        riskLevel,
        status,
        currency,
        minAmountMinor: minimum,
        maxAmountMinor: maximum,
        dateFrom: from,
        dateTo: exclusiveEnd,
        sortBy,
        sortOrder,
        page: pagination.page,
        pageSize: pagination.pageSize
    });

    return {
        data: result.data,
        pagination: {
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: result.total,
            totalPages: Math.ceil(
                result.total / pagination.pageSize
            )
        }
    };
}
