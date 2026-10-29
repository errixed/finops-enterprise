import express from "express";
import {
    listTransactions,
    getTransaction,
    createTransaction,
    processTransactionRequest
} from "../controllers/transaction.controller.js";

const router = express.Router();

router.get("/", listTransactions);
router.get("/:id", getTransaction);

router.post("/", createTransaction);
router.post("/:id/process", processTransactionRequest);

export default router;