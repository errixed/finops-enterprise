import express from "express";
import clientRoutes from "./client.routes.js";
import accountRoutes from "./account.routes.js";
import transactionRoutes from "./transaction.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import {
    checkApplicationHealth
} from "../services/dashboard.service.js";

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

export default router;