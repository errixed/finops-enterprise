import express from "express";

import {
    listAccounts,
    getAccount,
    registerAccount,
    getAccountOptions
} from "../controllers/account.controller.js";
import {
    accountReport,
    accountsWithActivity,
    downloadAccountStatement
} from "../controllers/account-operations.controller.js";

const router = express.Router();

router.get("/", listAccounts);
router.get("/options", getAccountOptions);
router.get("/with-activity", accountsWithActivity);

router.get("/:id/report", accountReport);
router.get("/:id/statement", downloadAccountStatement);
router.get("/:id", getAccount);

router.post("/", registerAccount);

export default router;