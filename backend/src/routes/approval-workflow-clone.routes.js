import express from "express";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../config/mongodb.js";

const router = express.Router();

function fail(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
}

function cloneStages(source) {
    if (Array.isArray(source.stageDefinitions) &&
        source.stageDefinitions.length > 0) {
        return source.stageDefinitions.map((stage, index) => ({
            stageId: randomUUID(),
            stageNumber: index + 1,
            name: stage.name,
            reviewerRole: stage.reviewerRole,
            decisionType: stage.decisionType,
            slaBusinessDays: stage.slaBusinessDays
        }));
    }

    const originalStages = Array.isArray(source.stages)
        ? source.stages
        : [];

    const defaultDays = Math.max(
        1,
        Math.min(
            30,
            Math.ceil(
                (source.slaHours || 24) /
                Math.max(1, originalStages.length) /
                24
            )
        )
    );

    return originalStages.map((role, index) => ({
        stageId: randomUUID(),
        stageNumber: index + 1,
        name: role.replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/ Reviewer$/, " Review"),
        reviewerRole: role,
        decisionType: "ApproveReject",
        slaBusinessDays: defaultDays
    }));
}

function cloneConditions(source) {
    if (Array.isArray(source.conditions)) {
        return {
            conditions: source.conditions.map(item => ({
                conditionId: randomUUID(),
                field: item.field,
                operator: item.operator,
                value: Array.isArray(item.value)
                    ? [...item.value]
                    : item.value
            })),
            conditionLogic: source.conditionLogic ?? "AND"
        };
    }

    const levels = Array.isArray(source.riskLevels)
        ? source.riskLevels
        : [];

    if (levels.length === 0) {
        return {
            conditions: [],
            conditionLogic: "AND"
        };
    }

    if (levels.length === 1) {
        return {
            conditions: [{
                conditionId: randomUUID(),
                field: "riskLevel",
                operator: "eq",
                value: levels[0]
            }],
            conditionLogic: "AND"
        };
    }

    return {
        conditions: [{
            conditionId: randomUUID(),
            field: "riskLevel",
            operator: "in",
            value: [...levels]
        }],
        conditionLogic: "AND"
    };
}

router.post("/:id", async (req, res, next) => {
    try {
        const database = getDatabase();
        const definitions = database.collection(
            "approval_workflow_definitions"
        );

        const source = await definitions.findOne({
            definitionId: req.params.id
        });

        if (!source) {
            fail("Workflow definition not found", 404);
        }

        if (source.status === "Draft" || source.isDraft === true) {
            fail("Complete the draft before duplicating it", 409);
        }

        const stages = cloneStages(source);
        const conditionConfiguration = cloneConditions(source);
        const now = new Date();

        const copiedName = `${source.name || "Untitled Workflow"} (Copy)`;

        const copy = {
            definitionId: `AWD-${randomUUID()}`,
            name: copiedName.slice(0, 150),
            description: source.description ?? "",
            riskLevels: [...(source.riskLevels ?? [])],
            stages: stages.map(stage => stage.reviewerRole),
            stageDefinitions: stages,
            slaHours: source.slaHours ?? 24,
            transactionType: source.transactionType ?? "All",
            ...conditionConfiguration,
            scope: structuredClone(
                source.scope ?? { currencies: ["CAD", "USD"] }
            ),
            slaCalculation: source.slaCalculation ?? "PerStage",
            autoEscalate: source.autoEscalate ?? false,
            escalationRole: source.escalationRole ??
                "ComplianceReviewer",
            allowParallel: source.allowParallel ?? false,
            requireReapproval: source.requireReapproval ?? false,
            assignmentMode: source.assignmentMode ?? "RoleBased",
            selectionStrategy: source.selectionStrategy ?? "Manual",
            segregationOfDuties: source.segregationOfDuties ?? true,
            notifications: structuredClone(
                source.notifications ?? {
                    onAssignment: false,
                    beforeDue: false,
                    onEscalation: false
                }
            ),
            status: "Inactive",
            isDraft: false,
            protected: false,
            origin: "Custom",
            createdAt: now,
            updatedAt: now,
            createdBy: String(
                req.get("X-Actor-Id") || "DEMO-POLICY-ADMIN"
            ).slice(0, 100),
            duplicatedFrom: source.definitionId
        };

        await definitions.insertOne(copy);

        await database.collection(
            "approval_workflow_definition_events"
        ).insertOne({
            eventId: randomUUID(),
            definitionId: copy.definitionId,
            action: "Duplicated",
            actorId: copy.createdBy,
            details: {
                sourceDefinitionId: source.definitionId,
                sourceName: source.name,
                sourceStatus: source.status
            },
            createdAt: now
        });

        res.status(201).json(copy);
    } catch (error) {
        next(error);
    }
});

export default router;