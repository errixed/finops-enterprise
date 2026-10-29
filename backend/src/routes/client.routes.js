import express from "express";

import {
    getClients,
    getClient,
    registerClient,
    editClient,
    getClientOptions
} from "../controllers/client.controller.js";

const router = express.Router();

router.get("/", getClients);
router.get("/options", getClientOptions);
router.get("/:id", getClient);
router.post("/", registerClient);
router.put("/:id", editClient);
router.patch("/:id", editClient);

export default router;