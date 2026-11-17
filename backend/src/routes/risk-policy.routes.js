import express from "express";

import {
    getRiskPolicies,
    getRiskPolicyById,
    createPolicy,
    updatePolicy,
    activatePolicy
} from "../controllers/risk-policy.controller.js";
import customRuleRouter from "./custom-rule.routes.js";
const router = express.Router();

router.get("/", getRiskPolicies);
router.use("/custom-rules", customRuleRouter);
router.get("/:id", getRiskPolicyById);
router.post("/", createPolicy);
router.put("/:id", updatePolicy);
router.post("/:id/activate", activatePolicy);

export default router;