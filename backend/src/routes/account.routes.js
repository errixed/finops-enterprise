import express from "express";

import {
    listAccounts,
    getAccount,
    registerAccount,
    getAccountOptions
} from "../controllers/account.controller.js";

const router = express.Router();

router.get("/", listAccounts);
router.get("/options", getAccountOptions);
router.get("/:id", getAccount);
router.post("/", registerAccount);

export default router;