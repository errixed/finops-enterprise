import express from "express";

import {
    getApprovalWorkflows,
    getApprovalWorkflowById,
    getWorkflowDecisions,
    submitDecision,
    escalateWorkflow
} from "../controllers/approval-workflow.controller.js";

const router = express.Router();

router.get("/", getApprovalWorkflows);
router.get("/:id", getApprovalWorkflowById);
router.get("/:id/decisions", getWorkflowDecisions);

router.post("/:id/decisions", submitDecision);
router.post("/:id/escalate", escalateWorkflow);

export default router;
