import {
    submitApprovalDecision
} from "../services/approval-decision.service.js";

import {
    requestApprovalEscalation
} from "../services/approval-escalation.service.js";

import {
    listApprovalWorkflows,
    getApprovalWorkflow,
    getApprovalWorkflowDecisions
} from "../services/approval-workflow-query.service.js";

export async function submitDecision(req, res, next) {
    try {
        const result = await submitApprovalDecision(
            req.params.id,
            req.body,
            req.get("Idempotency-Key")
        );

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

export async function escalateWorkflow(req, res, next) {
    try {
        const result = await requestApprovalEscalation(
            req.params.id,
            req.body,
            req.get("Idempotency-Key")
        );

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

export async function getApprovalWorkflows(req, res, next) {
    try {
        const result = await listApprovalWorkflows(
            req.query
        );

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

export async function getApprovalWorkflowById(
    req,
    res,
    next
) {
    try {
        const workflow = await getApprovalWorkflow(
            req.params.id
        );

        res.status(200).json(workflow);
    } catch (error) {
        next(error);
    }
}

export async function getWorkflowDecisions(req, res, next) {
    try {
        const decisions = await getApprovalWorkflowDecisions(
            req.params.id
        );

        res.status(200).json(decisions);
    } catch (error) {
        next(error);
    }
}
