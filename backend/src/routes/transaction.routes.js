import express from "express";
import {
    listTransactions,
    getTransaction,
    createTransaction,
    processTransactionRequest
} from "../controllers/transaction.controller.js";
import {
    getRiskAssessmentByTransaction
} from "../controllers/risk-assessment.controller.js";
import {
    transactionDirectory
} from "../controllers/transaction-directory.controller.js";
import {
    previewTransaction
} from "../controllers/transaction-preview.controller.js";
const router = express.Router();
import {
    transactionHistory,
    transactionDocumentHistory
} from "../controllers/transaction-history.controller.js";
import {
    listTransactionDocuments,
    uploadTransactionDocument,
    downloadTransactionDocument,
    deleteTransactionDocument
} from "../controllers/transaction-document.controller.js";

import {
    requireTransactionDocumentAccess
} from "../middleware/transaction-document-access.middleware.js";

router.get("/", listTransactions);
router.get("/directory", transactionDirectory);
router.post("/preview", previewTransaction);

const documentBodyParser = express.raw({
    type: [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/msword",
        "application/vnd.ms-excel"
    ],
    limit: "10mb"
});

router.get(
    "/:id/documents",
    requireTransactionDocumentAccess,
    listTransactionDocuments
);

router.post(
    "/:id/documents",
    requireTransactionDocumentAccess,
    documentBodyParser,
    uploadTransactionDocument
);

router.get(
    "/:id/documents/:documentId",
    requireTransactionDocumentAccess,
    downloadTransactionDocument
);

router.delete(
    "/:id/documents/:documentId",
    requireTransactionDocumentAccess,
    deleteTransactionDocument
);
router.get("/history", transactionHistory);

router.get(
    "/:id/document-history",
    requireTransactionDocumentAccess,
    transactionDocumentHistory
);
router.get("/:id", getTransaction);
router.get("/:id/risk-assessment", getRiskAssessmentByTransaction);

router.post("/", createTransaction);
router.post("/:id/process", processTransactionRequest);

export default router;