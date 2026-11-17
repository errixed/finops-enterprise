import express from "express";

import {
    getRiskAssessments,
    getRiskAssessmentById
} from "../controllers/risk-assessment.controller.js";
import {
    getRiskOverview
} from "../controllers/risk-overview.controller.js";
const router = express.Router();
import { getRiskAlerts } from "../controllers/risk-alerts.controller.js";
import {
    getRiskAssessmentDashboard
} from "../controllers/risk-assessment-dashboard.controller.js";
import {
    getRiskAnalytics
} from "../controllers/risk-analytics.controller.js";

router.get("/", getRiskAssessments);
router.get("/overview", getRiskOverview);
router.get("/alerts", getRiskAlerts);
router.get("/dashboard", getRiskAssessmentDashboard);
router.get("/analytics", getRiskAnalytics);
router.get("/:id", getRiskAssessmentById);

export default router;