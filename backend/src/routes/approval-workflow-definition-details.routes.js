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
const TYPES = ["All", "InternalTransfer", "ExternalTransfer"];
const OPERATORS = ["eq", "ne", "gte", "gt", "lte", "lt", "in"];
const FIELDS = ["riskLevel", "transactionType", "amount"];
const DECISIONS = ["ApproveReject", "ReviewRecommend"];
const CALCULATIONS = ["PerStage", "EndToEnd"];

function db() {
    return getDatabase();
}

function definitions() {
    return db().collection("approval_workflow_definitions");
}

function events() {
    return db().collection("approval_workflow_definition_events");
}

function fail(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
}

function actor(req) {
    return String(req.get("X-Actor-Id") || "DEMO-POLICY-ADMIN")
        .trim()
        .slice(0, 100);
}

function editable(item) {
    if (
        item.protected ||
        item.status !== "Inactive" ||
        item.isDraft === true
    ) {
        fail(
            "Only completed, inactive custom workflows can be edited",
            409
        );
    }
}

async function getDefinition(id) {
    const item = await definitions().findOne({ definitionId: id });

    if (!item) fail("Workflow definition not found", 404);

    return item;
}

async function log(req, id, action, details) {
    await events().insertOne({
        eventId: randomUUID(),
        definitionId: id,
        actorId: actor(req),
        action,
        details,
        createdAt: new Date()
    });
}

function validateConditions(input) {
    if (!Array.isArray(input) || input.length > 20) {
        fail("A workflow supports up to 20 conditions");
    }

    return input.map((item, index) => {
        if (
            !FIELDS.includes(item.field) ||
            !OPERATORS.includes(item.operator)
        ) {
            fail(`Invalid condition ${index + 1}`);
        }

        const value = item.value;

        if (item.field === "amount") {
            if (
                typeof value !== "number" ||
                !Number.isFinite(value) ||
                value < 0 ||
                value > 1000000000000 ||
                ["in"].includes(item.operator)
            ) {
                fail(`Invalid amount condition ${index + 1}`);
            }
        } else if (item.field === "riskLevel") {
            if (
                !["eq", "ne", "in"].includes(item.operator) ||
                !(typeof value === "string"
                    ? LEVELS.includes(value)
                    : Array.isArray(value) &&
                      value.length > 0 &&
                      value.every(v => LEVELS.includes(v)))
            ) {
                fail(`Invalid risk-level condition ${index + 1}`);
            }

            if (
                item.operator === "in" &&
                !Array.isArray(value)
            ) {
                fail("IN requires multiple risk levels");
            }
        } else if (
            !["eq", "ne", "in"].includes(item.operator) ||
            !(typeof value === "string"
                ? TYPES.includes(value)
                : Array.isArray(value) &&
                  value.length > 0 &&
                  value.every(v => TYPES.includes(v)))
        ) {
            fail(`Invalid transaction-type condition ${index + 1}`);
        }

        if (
            item.operator === "in" &&
            !Array.isArray(value)
        ) {
            fail("IN requires an array");
        }

        if (
            item.operator !== "in" &&
            Array.isArray(value)
        ) {
            fail("This operator requires a single value");
        }

        return {
            conditionId:
                typeof item.conditionId === "string" &&
                item.conditionId.length <= 100
                    ? item.conditionId
                    : randomUUID(),
            field: item.field,
            operator: item.operator,
            value
        };
    });
}

function validateStageDefinitions(input) {
    if (
        !Array.isArray(input) ||
        input.length < 1 ||
        input.length > 5
    ) {
        fail("A workflow requires between one and five stages");
    }

    return input.map((stage, index) => {
        const name = String(stage.name ?? "").trim();

        if (
            !name ||
            name.length > 80 ||
            !ROLES.includes(stage.reviewerRole) ||
            !DECISIONS.includes(stage.decisionType) ||
            !Number.isInteger(stage.slaBusinessDays) ||
            stage.slaBusinessDays < 1 ||
            stage.slaBusinessDays > 30
        ) {
            fail(`Invalid stage ${index + 1}`);
        }

        return {
            stageId: String(stage.stageId ?? randomUUID()).slice(0, 100),
            stageNumber: index + 1,
            name,
            reviewerRole: stage.reviewerRole,
            decisionType: stage.decisionType,
            slaBusinessDays: stage.slaBusinessDays
        };
    });
}

function validateSettings(input) {
    if (
        !CALCULATIONS.includes(input.slaCalculation) ||
        !ROLES.includes(input.escalationRole) ||
        typeof input.autoEscalate !== "boolean" ||
        typeof input.allowParallel !== "boolean" ||
        typeof input.requireReapproval !== "boolean"
    ) {
        fail("Invalid workflow settings");
    }

    return {
        slaCalculation: input.slaCalculation,
        escalationRole: input.escalationRole,
        autoEscalate: input.autoEscalate,
        allowParallel: input.allowParallel,
        requireReapproval: input.requireReapproval
    };
}

async function saveSection(req, section, fields) {
    const existing = await getDefinition(req.params.id);
    editable(existing);

    const updated = await definitions().findOneAndUpdate(
        {
            definitionId: existing.definitionId,
            protected: false,
            status: "Inactive",
            isDraft: { $ne: true },
            updatedAt: existing.updatedAt
        },
        {
            $set: {
                ...fields,
                updatedAt: new Date()
            }
        },
        { returnDocument: "after" }
    );

    if (!updated) {
        fail("Workflow was modified by another request", 409);
    }

    await log(
        req,
        existing.definitionId,
        `${section} Updated`,
        {
            before: Object.fromEntries(
                Object.keys(fields).map(key => [key, existing[key] ?? null])
            ),
            after: fields
        }
    );

    return updated;
}

router.get("/actors", async (req, res, next) => {
    try {
        const rows = await db().collection("workflow_actors")
            .find({})
            .project({
                _id: 0,
                actorId: 1,
                name: 1,
                displayName: 1,
                actorName: 1,
                role: 1,
                status: 1,
                isActive: 1
            })
            .limit(500)
            .toArray();

        res.json(rows.map(item => ({
            actorId: item.actorId,
            name: item.name ??
                item.displayName ??
                item.actorName ??
                item.actorId,
            role: item.role,
            status: item.status,
            isActive: item.isActive
        })));
    } catch (error) {
        next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const definition = await getDefinition(req.params.id);

        const [audit, actors] = await Promise.all([
            events()
                .find({ definitionId: definition.definitionId })
                .sort({ createdAt: -1 })
                .limit(500)
                .toArray(),
            db().collection("workflow_actors")
                .find({})
                .project({
                    _id: 0,
                    actorId: 1,
                    name: 1,
                    displayName: 1,
                    actorName: 1,
                    role: 1,
                    status: 1,
                    isActive: 1
                })
                .toArray()
        ]);

        res.json({
            definition,
            audit,
            actors: actors.map(item => ({
                actorId: item.actorId,
                name: item.name ??
                    item.displayName ??
                    item.actorName ??
                    item.actorId,
                role: item.role,
                status: item.status,
                isActive: item.isActive
            }))
        });
    } catch (error) {
        next(error);
    }
});

router.put("/:id/stages", async (req, res, next) => {
    try {
        const stages = validateStageDefinitions(
            req.body.stageDefinitions
        );

        res.json(await saveSection(req, "Stages", {
            stageDefinitions: stages,
            stages: stages.map(item => item.reviewerRole),
            slaHours: stages.reduce(
                (sum, item) => sum + item.slaBusinessDays * 24,
                0
            )
        }));
    } catch (error) {
        next(error);
    }
});

router.put("/:id/conditions", async (req, res, next) => {
    try {
        const conditions = validateConditions(req.body.conditions);
        const conditionLogic = req.body.conditionLogic;

        if (!["AND", "OR"].includes(conditionLogic)) {
            fail("Condition logic must be AND or OR");
        }

        const existing = await getDefinition(req.params.id);
        editable(existing);

        if (
            !req.body.scope ||
            !Array.isArray(req.body.scope.currencies) ||
            req.body.scope.currencies.length > 10 ||
            req.body.scope.currencies.some(value =>
                typeof value !== "string" ||
                !["CAD", "USD"].includes(value)
            )
        ) {
            fail("Invalid currency scope");
        }

        res.json(await saveSection(req, "Conditions", {
            conditions,
            conditionLogic,
            scope: {
                currencies: [...new Set(req.body.scope.currencies)]
            }
        }));
    } catch (error) {
        next(error);
    }
});

router.put("/:id/assignments", async (req, res, next) => {
    try {
        const mode = req.body.assignmentMode;
        const strategy = req.body.selectionStrategy;

        if (
            !["RoleBased", "PoolBased"].includes(mode) ||
            !["RoundRobin", "Manual"].includes(strategy) ||
            typeof req.body.segregationOfDuties !== "boolean"
        ) {
            fail("Invalid reviewer assignment settings");
        }

        res.json(await saveSection(req, "Assignments", {
            assignmentMode: mode,
            selectionStrategy: strategy,
            segregationOfDuties: req.body.segregationOfDuties
        }));
    } catch (error) {
        next(error);
    }
});

router.put("/:id/sla", async (req, res, next) => {
    try {
        const settings = validateSettings(req.body);

        const notifications = req.body.notifications;

        if (
            !notifications ||
            typeof notifications.onAssignment !== "boolean" ||
            typeof notifications.beforeDue !== "boolean" ||
            typeof notifications.onEscalation !== "boolean"
        ) {
            fail("Invalid notification settings");
        }

        res.json(await saveSection(req, "SLA", {
            ...settings,
            notifications
        }));
    } catch (error) {
        next(error);
    }
});

export default router;