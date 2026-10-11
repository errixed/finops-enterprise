import express from "express";

import {
    listTransactions,
    getTransaction
} from "../controllers/transaction.controller.js";

const router = express.Router();

router.get("/", listTransactions);
router.get("/:id", getTransaction);

export default router;