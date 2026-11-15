import express from "express";

import {
    getWorkflowActors
} from "../controllers/workflow-actor.controller.js";

const router = express.Router();

router.get("/", getWorkflowActors);

export default router;