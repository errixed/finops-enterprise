import express from "express";
import clientRoutes from "./client.routes.js";
import accountRoutes from "./account.routes.js";
import transactionRoutes from "./transaction.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import riskPolicyRoutes from "./risk-policy.routes.js";
import {
    checkApplicationHealth
} from "../services/dashboard.service.js";
import approvalWorkflowRoutes from "./approval-workflow.routes.js";
import workflowActorRoutes from "./workflow-actor.routes.js";
import riskAssessmentRoutes from "./risk-assessment.routes.js";
import {
    riskReportingRouter,
    approvalReportingRouter
} from "./operational-reporting.routes.js";

const router = express.Router();

router.get("/health", async (req, res, next) => {
    try {
        const health = await checkApplicationHealth();
        res.status(200).json(health);
    } catch (error) {
        error.statusCode = 503;
        error.code = "SERVICE_UNAVAILABLE";
        error.message = "Database service unavailable";
        next(error);
    }
});

router.use("/clients", clientRoutes);
router.use("/accounts", accountRoutes);
router.use("/transactions", transactionRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/risk-policies", riskPolicyRoutes);
router.use("/approval-workflows", approvalWorkflowRoutes);
router.use("/workflow-actors", workflowActorRoutes);
router.use("/risk-assessments", riskAssessmentRoutes);
router.use("/risk", riskReportingRouter);
router.use("/approvals", approvalReportingRouter);

export default router;