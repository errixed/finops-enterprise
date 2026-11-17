import {
    findRiskAssessmentById,
    searchRiskAssessments
} from "../repositories/risk-assessment.repository.js";

import {
    findTransactionById
} from "../repositories/transaction.repository.js";

import {
    parsePagination
} from "../utils/pagination.js";

const RISK_LEVELS = [
    "Low",
    "Medium",
    "High",
    "Critical"
];

function fail(message, statusCode = 400, code = "INVALID_REQUEST") {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    throw error;
}

function parseDate(value, field) {
    if (value === undefined || value === "") {
        return null;
    }

    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        fail(`Invalid ${field}. Expected YYYY-MM-DD`);
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
    ) {
        fail(`Invalid ${field}`);
    }

    return date;
}

function parseRiskScore(value, field) {
    if (value === undefined || value === "") {
        return null;
    }

    if (
        typeof value !== "string" &&
        typeof value !== "number"
    ) {
        fail(`${field} must be a number between 0 and 100`);
    }

    const score = Number(value);

    if (
        !Number.isInteger(score) ||
        score < 0 ||
        score > 100
    ) {
        fail(`${field} must be an integer between 0 and 100`);
    }

    return score;
}

export async function listRiskAssessments(query = {}) {
    const {
        search = "",
        transactionId = "",
        riskLevel = "",
        minScore,
        maxScore,
        dateFrom,
        dateTo,
        sortBy = "assessedAt",
        sortOrder = "desc",
        page = 1,
        pageSize = 10
    } = query;

    const pagination = parsePagination(page, pageSize);

    if (
        typeof search !== "string" ||
        typeof transactionId !== "string" ||
        typeof riskLevel !== "string"
    ) {
        fail("Invalid risk assessment filters");
    }

    if (
        riskLevel &&
        !RISK_LEVELS.includes(riskLevel)
    ) {
        fail("Unsupported risk level");
    }

    if (
        !["assessedAt", "riskScore"].includes(sortBy)
    ) {
        fail("Unsupported assessment sort field");
    }

    if (!["asc", "desc"].includes(sortOrder)) {
        fail("Unsupported sort direction");
    }

    const minimum = parseRiskScore(minScore, "minScore");
    const maximum = parseRiskScore(maxScore, "maxScore");

    if (
        minimum !== null &&
        maximum !== null &&
        minimum > maximum
    ) {
        fail("minScore must not exceed maxScore");
    }

    const from = parseDate(dateFrom, "dateFrom");
    const to = parseDate(dateTo, "dateTo");

    if (
        from &&
        to &&
        from.getTime() > to.getTime()
    ) {
        fail("dateFrom must not be after dateTo");
    }

    const exclusiveEnd = to
        ? new Date(to.getTime() + 86400000)
        : null;

    return searchRiskAssessments({
        search: search.trim(),
        transactionId: transactionId.trim(),
        riskLevel,
        minScore: minimum,
        maxScore: maximum,
        dateFrom: from,
        dateTo: exclusiveEnd,
        sortBy,
        sortOrder,
        page: pagination.page,
        pageSize: pagination.pageSize
    });
}

export async function getRiskAssessment(assessmentId) {
    if (
        typeof assessmentId !== "string" ||
        !assessmentId.trim()
    ) {
        fail("Invalid assessment ID");
    }

    const assessment = await findRiskAssessmentById(
        assessmentId
    );

    if (!assessment) {
        fail(
            "Risk assessment not found",
            404,
            "ASSESSMENT_NOT_FOUND"
        );
    }

    return assessment;
}

export async function getTransactionRiskAssessment(
    transactionId
) {
    if (
        typeof transactionId !== "string" ||
        !transactionId.trim()
    ) {
        fail("Invalid transaction ID");
    }

    const transaction = await findTransactionById(
        transactionId
    );

    if (!transaction) {
        fail(
            "Transaction not found",
            404,
            "TRANSACTION_NOT_FOUND"
        );
    }

    if (!transaction.riskAssessmentId) {
        fail(
            "Transaction has no authoritative risk assessment",
            404,
            "ASSESSMENT_NOT_FOUND"
        );
    }

    const assessment = await findRiskAssessmentById(
        transaction.riskAssessmentId
    );

    if (
        !assessment ||
        assessment.transactionId !== transaction.transactionId ||
        assessment.riskScore !== transaction.riskScore ||
        assessment.riskLevel !== transaction.riskLevel ||
        assessment.approvalRequired !== transaction.approvalRequired
    ) {
        fail(
            "Transaction risk assessment is inconsistent",
            409,
            "ASSESSMENT_INCONSISTENT"
        );
    }

    return assessment;
}