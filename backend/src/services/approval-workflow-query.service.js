import {
    searchApprovalWorkflows,
    findApprovalWorkflowById
} from "../repositories/approval-workflow.repository.js";

import {
    listApprovalDecisions
} from "../repositories/approval-decision.repository.js";

import {
    APPROVAL_STATES
} from "../constants/approval-status.js";

import {
    parsePagination
} from "../utils/pagination.js";

function fail(message, statusCode = 400, code = "INVALID_REQUEST") {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    throw error;
}

export async function listApprovalWorkflows(query = {}) {
    const {
        transactionId = "",
        status = "",
        page = 1,
        pageSize = 10
    } = query;

    if (
        typeof transactionId !== "string" ||
        typeof status !== "string"
    ) {
        fail("Invalid workflow search filters");
    }

    if (
        status &&
        !APPROVAL_STATES.includes(status)
    ) {
        fail("Unsupported workflow status");
    }

    const pagination = parsePagination(page, pageSize);

    return searchApprovalWorkflows({
        transactionId: transactionId.trim(),
        status,
        page: pagination.page,
        pageSize: pagination.pageSize
    });
}

export async function getApprovalWorkflow(workflowId) {
    if (
        typeof workflowId !== "string" ||
        !workflowId.trim()
    ) {
        fail("Invalid workflow ID");
    }

    const workflow = await findApprovalWorkflowById(
        workflowId.trim()
    );

    if (!workflow) {
        fail(
            "Approval workflow not found",
            404,
            "WORKFLOW_NOT_FOUND"
        );
    }

    return workflow;
}

export async function getApprovalWorkflowDecisions(workflowId) {
    const workflow = await getApprovalWorkflow(workflowId);

    const decisions = await listApprovalDecisions(
        workflow.workflowId
    );

    return decisions;
}