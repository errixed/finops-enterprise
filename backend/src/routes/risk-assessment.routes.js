import express from "express";

import {
    getRiskAssessments,
    getRiskAssessmentById
} from "../controllers/risk-assessment.controller.js";

const router = express.Router();

router.get("/", getRiskAssessments);
router.get("/:id", getRiskAssessmentById);

export default router;