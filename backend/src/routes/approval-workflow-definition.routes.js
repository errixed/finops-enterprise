import express from "express";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../config/mongodb.js";

const router = express.Router();

const ROLES = [
    "OperationsReviewer",
    "SeniorReviewer",
    "ComplianceReviewer"
];

const LEVELS = ["Low", "Medium", "High", "Critical"];

const DEFAULTS = [
    {
        definitionId: "AWD-HIGH",
        name: "High-Risk Transaction Approval",
        description: "Two-stage approval for high-risk transfers.",
        riskLevels: ["High"],
        stages: ["OperationsReviewer", "SeniorReviewer"],
        slaHours: 24,
        status: "Active"
    },
    {
        definitionId: "AWD-CRITICAL",
        name: "Critical-Risk Transaction Approval",
        description: "Sequential senior and compliance review.",
        riskLevels: ["Critical"],
        stages: ["SeniorReviewer", "ComplianceReviewer"],
        slaHours: 48,
        status: "Active"
    },
    {
        definitionId: "AWD-MEDIUM",
        name: "Medium-Risk Transaction Approval",
        description: "Operations review of medium-risk transfers.",
        riskLevels: ["Medium"],
        stages: ["OperationsReviewer"],
        slaHours: 24,
        status: "Active"
    },
    {
        definitionId: "AWD-EXCEPTION",
        name: "Business Rule Review",
        description: "Supplementary business-rule investigation.",
        riskLevels: ["Medium"],
        stages: ["OperationsReviewer"],
        slaHours: 24,
        status: "Active"
    },
    {
        definitionId: "AWD-MANUAL",
        name: "Manual Compliance Review",
        description: "Optional administrative compliance review.",
        riskLevels: ["High", "Critical"],
        stages: ["SeniorReviewer", "ComplianceReviewer"],
        slaHours: 48,
        status: "Inactive"
    }
];

function definitions() {
    return getDatabase().collection("approval_workflow_definitions");
}

function history() {
    return getDatabase().collection("approval_workflow_definition_events");
}

function fail(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
}

function actor(req) {
    return String(req.get("X-Actor-Id") ?? "DEMO-POLICY-ADMIN")
        .trim()
        .slice(0, 100);
}

async function logEvent(req, definitionId, action, details = {}) {
    await history().insertOne({
        eventId: randomUUID(),
        definitionId,
        action,
        actorId: actor(req),
        details,
        createdAt: new Date()
    });
}

function validate(body) {
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const riskLevels = body.riskLevels;
    const stages = body.stages;
    const slaHours = Number(body.slaHours);

    if (!name || name.length > 150) {
        fail("Workflow name must contain 1–150 characters");
    }

    if (description.length > 1000) {
        fail("Description exceeds 1000 characters");
    }

    if (
        !Array.isArray(riskLevels) ||
        riskLevels.length === 0 ||
        riskLevels.length > 4 ||
        new Set(riskLevels).size !== riskLevels.length ||
        riskLevels.some(level => !LEVELS.includes(level))
    ) {
        fail("Select valid risk levels");
    }

    if (
        !Array.isArray(stages) ||
        stages.length < 1 ||
        stages.length > 5 ||
        stages.some(role => !ROLES.includes(role))
    ) {
        fail("Select between one and five valid reviewer stages");
    }

    if (
        !Number.isInteger(slaHours) ||
        slaHours < 1 ||
        slaHours > 720
    ) {
        fail("SLA must be between 1 and 720 hours");
    }

    return {
        name,
        description,
        riskLevels,
        stages,
        slaHours
    };
}

async function findDefinition(id) {
    const definition = await definitions().findOne({
        definitionId: id
    });

    if (!definition) fail("Workflow definition not found", 404);

    return definition;
}

async function initialize() {
    await definitions().createIndex(
        { definitionId: 1 },
        { unique: true }
    );

    await history().createIndex({
        definitionId: 1,
        createdAt: -1
    });

    for (const item of DEFAULTS) {
        await definitions().updateOne(
            { definitionId: item.definitionId },
            {
                $setOnInsert: {
                    ...item,
                    protected: true,
                    origin: "Assignment3",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdBy: "SYSTEM"
                }
            },
            { upsert: true }
        );
    }
}

router.get("/summary", async (req, res, next) => {
    try {
        await initialize();

        const items = await definitions().find({}).toArray();

        const active = items.filter(item =>
            item.status === "Active"
        );

        const averageStages = items.length
            ? Number((
                items.reduce((sum, item) =>
                    sum + item.stages.length, 0
                ) / items.length
            ).toFixed(1))
            : 0;

        const workflows = await getDatabase()
            .collection("approval_workflows")
            .find({
                status: { $in: ["Approved", "Rejected"] }
            })
            .project({
                status: 1,
                createdAt: 1,
                updatedAt: 1
            })
            .toArray();

        const completed = workflows.filter(item =>
            item.createdAt && item.updatedAt &&
            new Date(item.updatedAt) >= new Date(item.createdAt)
        );

        const avgHours = completed.length
            ? Number((
                completed.reduce((sum, item) =>
                    sum + (
                        new Date(item.updatedAt) -
                        new Date(item.createdAt)
                    ) / 3600000, 0
                ) / completed.length
            ).toFixed(1))
            : null;

        const approved = workflows.filter(item =>
            item.status === "Approved"
        ).length;

        res.json({
            total: items.length,
            active: active.length,
            inactive: items.filter(item =>
                item.status === "Inactive" && item.isDraft !== true
            ).length,
            drafts: items.filter(item =>
                item.status === "Draft" || item.isDraft === true
            ).length,
            multiStage: items.filter(item =>
                item.stages.length > 1
            ).length,
            averageStages,
            averageProcessingHours: avgHours,
            approvalRate: workflows.length
                ? Number((
                    approved / workflows.length * 100
                ).toFixed(1))
                : null
        });
    } catch (error) {
        next(error);
    }
});

router.get("/", async (req, res, next) => {
    try {
        await initialize();

        const search = String(req.query.search ?? "").trim();

        if (search.length > 120) {
            fail("Search is too long");
        }

        const query = search
            ? {
                $or: [
                    {
                        name: {
                            $regex: search.replace(
                                /[.*+?^${}()|[\]\\]/g, "\\$&"
                            ),
                            $options: "i"
                        }
                    },
                    {
                        description: {
                            $regex: search.replace(
                                /[.*+?^${}()|[\]\\]/g, "\\$&"
                            ),
                            $options: "i"
                        }
                    }
                ]
            }
            : {};

        const items = await definitions()
            .find(query)
            .sort({ protected: -1, name: 1 })
            .toArray();

        res.json(items);
    } catch (error) {
        next(error);
    }
});

router.get("/:id/audit", async (req, res, next) => {
    try {
        await findDefinition(req.params.id);

        res.json(await history()
            .find({ definitionId: req.params.id })
            .sort({ createdAt: -1 })
            .toArray());
    } catch (error) {
        next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        res.json(await findDefinition(req.params.id));
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    try {
        const data = validate(req.body);

        const item = {
            definitionId: `AWD-${randomUUID()}`,
            ...data,
            status: "Inactive",
            protected: false,
            origin: "Custom",
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: actor(req)
        };

        await definitions().insertOne(item);
        await logEvent(req, item.definitionId, "Created", {
            name: item.name
        });

        res.status(201).json(item);
    } catch (error) {
        next(error);
    }
});

router.put("/:id", async (req, res, next) => {
    try {
        const existing = await findDefinition(req.params.id);

        if (existing.protected) {
            fail(
                "Built-in workflow definitions cannot be edited",
                409
            );
        }

        if (existing.status === "Active") {
            fail(
                "Deactivate the custom definition before editing",
                409
            );
        }

        const data = validate(req.body);

        const result = await definitions().findOneAndUpdate(
            {
                definitionId: existing.definitionId,
                status: "Inactive"
            },
            {
                $set: {
                    ...data,
                    updatedAt: new Date()
                }
            },
            { returnDocument: "after" }
        );

        if (!result) fail("Definition changed concurrently", 409);

        await logEvent(req, existing.definitionId, "Updated", data);

        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.post("/:id/duplicate", async (req, res, next) => {
    try {
        const original = await findDefinition(req.params.id);

        const item = {
            definitionId: `AWD-${randomUUID()}`,
            name: `${original.name} (Copy)`.slice(0, 150),
            description: original.description,
            riskLevels: [...original.riskLevels],
            stages: [...original.stages],
            slaHours: original.slaHours,
            status: "Inactive",
            protected: false,
            origin: "Custom",
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: actor(req)
        };

        await definitions().insertOne(item);

        await logEvent(req, item.definitionId, "Duplicated", {
            sourceDefinitionId: original.definitionId
        });

        res.status(201).json(item);
    } catch (error) {
        next(error);
    }
});

router.post("/:id/status", async (req, res, next) => {
    try {
        const existing = await findDefinition(req.params.id);

        if (existing.protected) {
            fail("Built-in definitions cannot be deactivated", 409);
        }

        const status = req.body.status;

        if (!["Active", "Inactive"].includes(status)) {
            fail("Invalid status");
        }

        const updated = await definitions().findOneAndUpdate(
            { definitionId: existing.definitionId },
            {
                $set: {
                    status,
                    updatedAt: new Date()
                }
            },
            { returnDocument: "after" }
        );

        await logEvent(req, existing.definitionId, status);

        res.json(updated);
    } catch (error) {
        next(error);
    }
});

router.delete("/:id", async (req, res, next) => {
    try {
        const existing = await findDefinition(req.params.id);

        if (existing.protected || existing.status !== "Inactive") {
            fail(
                "Only inactive custom definitions may be deleted",
                409
            );
        }

        await definitions().deleteOne({
            definitionId: existing.definitionId,
            protected: false,
            status: "Inactive"
        });

        await logEvent(req, existing.definitionId, "Deleted", {
            name: existing.name
        });

        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

export default router;