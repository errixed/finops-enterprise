import express from "express";
import {
    getSummary,
    getTrend
} from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get("/summary", getSummary);
router.get("/trend", getTrend);

export default router;