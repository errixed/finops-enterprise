import {
    getRiskDashboard,
    getApprovalsDashboard,
    getApprovalQueue
} from "../services/operational-reporting.service.js";

export async function getRiskDashboardReport(
    req,
    res,
    next
) {
    try {
        const result = await getRiskDashboard();
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

export async function getApprovalsDashboardReport(
    req,
    res,
    next
) {
    try {
        const result = await getApprovalsDashboard();
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

export async function getApprovalQueueReport(
    req,
    res,
    next
) {
    try {
        const result = await getApprovalQueue(
            req.query
        );

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}