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
import riskCaseRoutes from "./risk-case.routes.js";
import approvalWorkflowDefinitionRoutes from "./approval-workflow-definition.routes.js";
import approvalWorkflowBuilderRoutes from "./approval-workflow-builder.routes.js";
import approvalWorkflowDefinitionDetailsRoutes from "./approval-workflow-definition-details.routes.js";
import approvalWorkflowCloneRoutes from "./approval-workflow-clone.routes.js";
import approvalWorkflowSlaRoutes from "./approval-workflow-sla.routes.js";
import approvalDecisionHistoryRoutes from "./approval-decision-history.routes.js";
import approvalAuditTrailRoutes from "./approval-audit-trail.routes.js";
import approvalPolicyManagementRoutes from "./approval-policy-management.routes.js";
import approvalPolicyWizardRoutes from "./approval-policy-wizard.routes.js";

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
router.use("/risk-cases", riskCaseRoutes);
router.use("/approval-workflows", approvalWorkflowRoutes);
router.use("/approval-workflow-definitions", approvalWorkflowDefinitionRoutes);
router.use("/approval-workflow-clones", approvalWorkflowCloneRoutes);
router.use("/approval-workflow-definition-details", approvalWorkflowDefinitionDetailsRoutes);
router.use("/approval-workflow-sla", approvalWorkflowSlaRoutes);
router.use("/workflow-actors", workflowActorRoutes);
router.use("/risk-assessments", riskAssessmentRoutes);
router.use("/risk", riskReportingRouter);
router.use("/approvals", approvalReportingRouter);
router.use("/approval-workflow-builders", approvalWorkflowBuilderRoutes);
router.use("/approval-decision-history", approvalDecisionHistoryRoutes);
router.use("/approval-audit-trail", approvalAuditTrailRoutes);
router.use("/approval-policy-management", approvalPolicyManagementRoutes);
router.use("/approval-policy-wizard", approvalPolicyWizardRoutes);

export default router;