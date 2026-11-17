import express from "express";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../config/mongodb.js";

const router = express.Router();

const LEVELS = ["Low", "Medium", "High", "Critical"];
const ROLES = [
    "OperationsReviewer",
    "SeniorReviewer",
    "ComplianceReviewer"
];
const DECISIONS = ["ApproveReject", "ReviewRecommend"];
const CALCULATIONS = ["PerStage", "EndToEnd"];
const TRANSACTION_TYPES = [
    "All",
    "InternalTransfer",
    "ExternalTransfer"
];

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

function definitions() {
    return getDatabase().collection("approval_workflow_definitions");
}

function events() {
    return getDatabase().collection("approval_workflow_definition_events");
}

async function initializeIndexes() {
    await definitions().createIndex(
        { definitionId: 1 },
        { unique: true }
    );

    await definitions().createIndex(
        { workflowCode: 1 },
        {
            unique: true,
            partialFilterExpression: {
                workflowCode: { $type: "string" }
            }
        }
    );
}

async function logEvent(req, definitionId, action, details = {}) {
    await events().insertOne({
        eventId: randomUUID(),
        definitionId,
        action,
        actorId: actor(req),
        details,
        createdAt: new Date()
    });
}

function stringValue(value, limit, required = false) {
    if (typeof value !== "string") {
        if (!required && (value === undefined || value === null)) {
            return "";
        }
        fail("Invalid text field");
    }

    const result = value.trim();

    if (result.length > limit || (required && !result)) {
        fail(`Text must contain ${required ? "1" : "0"}–${limit} characters`);
    }

    return result;
}

function validate(input, draft = false) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        fail("Invalid workflow definition");
    }

    const name = stringValue(input.name, 150, !draft);
    const workflowCode = stringValue(
        input.workflowCode,
        40,
        !draft
    ).toUpperCase();
    const description = stringValue(input.description, 250, !draft);

    if (
        workflowCode &&
        !/^[A-Z][A-Z0-9-]{2,39}$/.test(workflowCode)
    ) {
        fail("Workflow code must contain 3–40 letters, numbers or hyphens");
    }

    const riskLevels = input.riskLevels ?? [];

    if (
        !Array.isArray(riskLevels) ||
        riskLevels.length > 4 ||
        (!draft && !riskLevels.length) ||
        new Set(riskLevels).size !== riskLevels.length ||
        riskLevels.some(level => !LEVELS.includes(level))
    ) {
        fail("Invalid applicable risk levels");
    }

    const transactionType = input.transactionType ?? "All";

    if (!TRANSACTION_TYPES.includes(transactionType)) {
        fail("Invalid transaction type");
    }

    const stages = input.stageDefinitions ?? [];

    if (
        !Array.isArray(stages) ||
        stages.length > 5 ||
        (!draft && stages.length === 0)
    ) {
        fail("A completed workflow requires one to five stages");
    }

    const stageDefinitions = stages.map((stage, index) => {
        if (!stage || typeof stage !== "object") {
            fail(`Invalid stage ${index + 1}`);
        }

        const stageName = stringValue(
            stage.name ?? "",
            80,
            !draft
        );

        if (
            !ROLES.includes(stage.reviewerRole) ||
            !DECISIONS.includes(stage.decisionType) ||
            !Number.isInteger(stage.slaBusinessDays) ||
            stage.slaBusinessDays < 1 ||
            stage.slaBusinessDays > 30
        ) {
            fail(`Invalid configuration in stage ${index + 1}`);
        }

        return {
            stageId: typeof stage.stageId === "string"
                ? stage.stageId
                : randomUUID(),
            stageNumber: index + 1,
            name: stageName,
            reviewerRole: stage.reviewerRole,
            decisionType: stage.decisionType,
            slaBusinessDays: stage.slaBusinessDays
        };
    });

    const slaCalculation = input.slaCalculation ?? "PerStage";

    if (!CALCULATIONS.includes(slaCalculation)) {
        fail("Invalid SLA calculation");
    }

    const autoEscalate = input.autoEscalate === true;
    const escalationRole = input.escalationRole ??
        "ComplianceReviewer";

    if (autoEscalate && !ROLES.includes(escalationRole)) {
        fail("Invalid escalation role");
    }

    const allowParallel = input.allowParallel === true;
    const requireReapproval = input.requireReapproval === true;
    const active = input.active === true;

    return {
        name,
        workflowCode,
        description,
        riskLevels: [...riskLevels],
        transactionType,
        stageDefinitions,
        stages: stageDefinitions.map(stage => stage.reviewerRole),
        slaCalculation,
        slaHours: stageDefinitions.reduce(
            (total, stage) =>
                total + stage.slaBusinessDays * 24,
            0
        ),
        autoEscalate,
        escalationRole,
        allowParallel,
        requireReapproval,
        active
    };
}

function storageFields(data) {
    const { active, workflowCode, ...rest } = data;

    return {
        ...rest,
        ...(workflowCode ? { workflowCode } : {})
    };
}

async function findDraft(id) {
    const item = await definitions().findOne({
        definitionId: id,
        protected: false,
        $or: [
            { status: "Draft" },
            { isDraft: true }
        ]
    });

    if (!item) {
        fail("Draft not found or no longer editable", 404);
    }

    return item;
}

function duplicateCode(error) {
    if (error.code === 11000) {
        fail("Workflow code is already in use", 409);
    }

    throw error;
}

router.post("/drafts", async (req, res, next) => {
    try {
        await initializeIndexes();

        const data = validate(req.body, true);
        const now = new Date();

        const item = {
            definitionId: `AWD-${randomUUID()}`,
            ...storageFields(data),
            status: "Draft",
            isDraft: true,
            protected: false,
            origin: "Custom",
            createdAt: now,
            updatedAt: now,
            createdBy: actor(req)
        };

        try {
            await definitions().insertOne(item);
        } catch (error) {
            duplicateCode(error);
        }

        await logEvent(req, item.definitionId, "Draft Created");

        res.status(201).json(item);
    } catch (error) {
        next(error);
    }
});

router.get("/drafts/:id", async (req, res, next) => {
    try {
        res.json(await findDraft(req.params.id));
    } catch (error) {
        next(error);
    }
});

router.put("/drafts/:id", async (req, res, next) => {
    try {
        const existing = await findDraft(req.params.id);
        const data = validate(req.body, true);

        const fields = storageFields(data);

        if (!data.workflowCode && existing.workflowCode) {
            fields.$unset = true;
        }

        const update = {
            $set: {
                ...fields,
                status: "Draft",
                isDraft: true,
                updatedAt: new Date()
            }
        };

        delete update.$set.$unset;

        if (!data.workflowCode) {
            update.$unset = { workflowCode: "" };
        }

        let result;

        try {
            result = await definitions().findOneAndUpdate(
                {
                    definitionId: existing.definitionId,
                    protected: false,
                    $or: [
                        { status: "Draft" },
                        { isDraft: true }
                    ]
                },
                update,
                { returnDocument: "after" }
            );
        } catch (error) {
            duplicateCode(error);
        }

        if (!result) {
            fail("Draft was changed concurrently", 409);
        }

        await logEvent(req, existing.definitionId, "Draft Updated");

        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.post("/drafts/:id/complete", async (req, res, next) => {
    try {
        const existing = await findDraft(req.params.id);
        const data = validate(req.body, false);

        const fields = storageFields(data);

        let result;

        try {
            result = await definitions().findOneAndUpdate(
                {
                    definitionId: existing.definitionId,
                    protected: false,
                    $or: [
                        { status: "Draft" },
                        { isDraft: true }
                    ]
                },
                {
                    $set: {
                        ...fields,
                        status: data.active ? "Active" : "Inactive",
                        isDraft: false,
                        updatedAt: new Date()
                    }
                },
                { returnDocument: "after" }
            );
        } catch (error) {
            duplicateCode(error);
        }

        if (!result) {
            fail("Draft was changed concurrently", 409);
        }

        await logEvent(
            req,
            existing.definitionId,
            "Draft Completed",
            { status: result.status }
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.delete("/drafts/:id", async (req, res, next) => {
    try {
        const existing = await findDraft(req.params.id);

        const result = await definitions().deleteOne({
            definitionId: existing.definitionId,
            protected: false,
            $or: [
                { status: "Draft" },
                { isDraft: true }
            ]
        });

        if (result.deletedCount !== 1) {
            fail("Draft was changed concurrently", 409);
        }

        await logEvent(
            req,
            existing.definitionId,
            "Draft Deleted",
            {
                name: existing.name,
                workflowCode: existing.workflowCode ?? null
            }
        );

        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    try {
        await initializeIndexes();

        const data = validate(req.body, false);
        const now = new Date();

        const item = {
            definitionId: `AWD-${randomUUID()}`,
            ...storageFields(data),
            status: data.active ? "Active" : "Inactive",
            isDraft: false,
            protected: false,
            origin: "Custom",
            createdAt: now,
            updatedAt: now,
            createdBy: actor(req)
        };

        try {
            await definitions().insertOne(item);
        } catch (error) {
            duplicateCode(error);
        }

        await logEvent(req, item.definitionId, "Created", {
            status: item.status
        });

        res.status(201).json(item);
    } catch (error) {
        next(error);
    }
});

export default router;
