import express from "express";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../config/mongodb.js";
import { findWorkflowActor } from "../repositories/risk-policy.repository.js";
import { validateCustomRule } from "../services/risk-assessment.service.js";

const router = express.Router();

function collection() {
    return getDatabase().collection("custom_risk_rules");
}

async function administrator(req, res, next) {
    try {
        const actor = await findWorkflowActor(req.get("X-Actor-Id"));

        if (!actor || actor.role !== "PolicyAdministrator") {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "Policy administrator access required"
                }
            });
        }

        next();
    } catch (error) {
        next(error);
    }
}

function normalize(input, ruleId) {
    return {
        ruleId,
        name: input.name,
        points: input.points,
        field: input.field,
        operator: input.operator,
        value: input.value
    };
}

function validate(input, ruleId) {
    const rule = normalize(input, ruleId);
    validateCustomRule(rule);
    return rule;
}

router.use(administrator);

router.get("/", async (req, res, next) => {
    try {
        const rules = await collection()
            .find({})
            .sort({ createdAt: 1, ruleId: 1 })
            .toArray();

        res.json(rules);
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    try {
        const ruleId = `CUSTOM-${randomUUID().toUpperCase()}`;
        const rule = validate(req.body, ruleId);
        const now = new Date();

        const document = {
            ...rule,
            createdAt: now,
            updatedAt: now
        };

        await collection().insertOne(document);
        res.status(201).json(document);
    } catch (error) {
        if (error.message?.includes("rule") ||
            error.message?.includes("condition") ||
            error.message?.includes("value") ||
            error.message?.includes("points") ||
            error.message?.includes("status")) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: error.message
                }
            });
        }

        next(error);
    }
});

router.put("/:id", async (req, res, next) => {
    try {
        const existing = await collection().findOne({
            ruleId: req.params.id
        });

        if (!existing) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Custom rule not found"
                }
            });
        }

        const rule = validate(req.body, existing.ruleId);

        const updated = await collection().findOneAndUpdate(
            { ruleId: existing.ruleId },
            {
                $set: {
                    ...rule,
                    updatedAt: new Date()
                }
            },
            { returnDocument: "after" }
        );

        res.json(updated);
    } catch (error) {
        if (error.message?.includes("rule") ||
            error.message?.includes("condition") ||
            error.message?.includes("value") ||
            error.message?.includes("points") ||
            error.message?.includes("status")) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: error.message
                }
            });
        }

        next(error);
    }
});

router.delete("/:id", async (req, res, next) => {
    try {
        const result = await collection().deleteOne({
            ruleId: req.params.id
        });

        if (!result.deletedCount) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Custom rule not found"
                }
            });
        }

        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

export default router;