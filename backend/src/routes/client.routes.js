import express from "express";
import {
    getClients,
    getClient,
    getClientAccounts,
    registerClient,
    editClient,
    getClientOptions,
    getDirectorySummary,
    getClientReport,
    getDirectoryMetrics,
    exportClients
} from "../controllers/client.controller.js";
const router = express.Router();

router.get("/", getClients);
router.get("/options", getClientOptions);
router.get("/summary", getDirectorySummary);
router.get("/:id/accounts", getClientAccounts);
router.get("/metrics", getDirectoryMetrics);
router.get("/:id/report", getClientReport);
router.get("/export", exportClients);
router.get("/:id", getClient);
router.post("/", registerClient);
router.put("/:id", editClient);
router.patch("/:id", editClient);
export default router;