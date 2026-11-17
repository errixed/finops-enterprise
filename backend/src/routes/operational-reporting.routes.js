import express from "express";

import {
    getRiskDashboardReport,
    getApprovalsDashboardReport,
    getApprovalQueueReport
} from "../controllers/operational-reporting.controller.js";

export const riskReportingRouter = express.Router();
export const approvalReportingRouter = express.Router();
import {
    getApprovalOverview
} from "../controllers/approval-overview.controller.js";
riskReportingRouter.get(
    "/dashboard",
    getRiskDashboardReport
);

approvalReportingRouter.get(
    "/dashboard",
    getApprovalsDashboardReport
);

approvalReportingRouter.get(
    "/queue",
    getApprovalQueueReport
);
approvalReportingRouter.get(
    "/overview",
    getApprovalOverview
);