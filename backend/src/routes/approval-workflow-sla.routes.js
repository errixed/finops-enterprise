
import express from "express";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../config/mongodb.js";
import {
    calculateWorkflowSlaMetrics
} from "../services/approval-workflow-sla-metrics.service.js";
const router = express.Router();

const ROLES = [
    "OperationsReviewer",
    "SeniorReviewer",
    "ComplianceReviewer"
];

const TRIGGERS = [
    "SlaBreach",
    "SecondBreach",
    "AgeThreshold"
];

const ACTIONS = [
    "Escalate",
    "ComplianceReview",
    "PriorityEscalation"
];

const CHANNELS = [
    "None",
    "InApp",
    "EmailInApp"
];

function fail(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
}

function database() {
    return getDatabase();
}

function validate(input) {
    if (!input || typeof input !== "object") {
        fail("Invalid SLA configuration");
    }

    if (
        !["PerStage", "EndToEnd"].includes(input.slaCalculation) ||
        typeof input.autoEscalate !== "boolean" ||
        !ROLES.includes(input.escalationRole) ||
        typeof input.allowParallel !== "boolean" ||
        typeof input.requireReapproval !== "boolean"
    ) {
        fail("Invalid SLA settings");
    }

    const hours = input.businessHours;

    if (
        !hours ||
        hours.timeZone !== "America/Toronto" ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hours.start ?? "") ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hours.end ?? "") ||
        hours.start >= hours.end ||
        !Array.isArray(hours.weekdays) ||
        JSON.stringify(hours.weekdays) !== "[1,2,3,4,5]"
    ) {
        fail("Invalid business hours");
    }

    const notifications = input.notifications;

    if (
        !notifications ||
        typeof notifications.onAssignment !== "boolean" ||
        typeof notifications.beforeDue !== "boolean" ||
        typeof notifications.onEscalation !== "boolean"
    ) {
        fail("Invalid notification settings");
    }

    if (
        !Array.isArray(input.escalationRules) ||
        input.escalationRules.length > 10
    ) {
        fail("Up to ten escalation rules are supported");
    }

    const escalationRules = input.escalationRules.map((rule, index) => {
        if (
            !TRIGGERS.includes(rule.trigger) ||
            !ACTIONS.includes(rule.action) ||
            !ROLES.includes(rule.escalateTo) ||
            !CHANNELS.includes(rule.notification) ||
            !Number.isInteger(rule.ageBusinessDays) ||
            rule.ageBusinessDays < 1 ||
            rule.ageBusinessDays > 30
        ) {
            fail(`Invalid escalation rule ${index + 1}`);
        }

        return {
            ruleId: randomUUID(),
            trigger: rule.trigger,
            action: rule.action,
            escalateTo: rule.escalateTo,
            notification: rule.notification,
            ageBusinessDays: rule.ageBusinessDays
        };
    });

    return {
        slaCalculation: input.slaCalculation,
        autoEscalate: input.autoEscalate,
        escalationRole: input.escalationRole,
        allowParallel: input.allowParallel,
        requireReapproval: input.requireReapproval,
        businessHours: {
            timeZone: "America/Toronto",
            start: hours.start,
            end: hours.end,
            weekdays: [1, 2, 3, 4, 5]
        },
        notifications: {
            onAssignment: notifications.onAssignment,
            beforeDue: notifications.beforeDue,
            onEscalation: notifications.onEscalation
        },
        escalationRules
    };
}

router.get("/:id/metrics", async (req, res, next) => {
    try {
        const definition = await database()
            .collection("approval_workflow_definitions")
            .findOne({
                definitionId: req.params.id
            });

        if (!definition) {
            fail("Workflow definition not found", 404);
        }

        const metrics = await calculateWorkflowSlaMetrics(definition);

        res.json(metrics);
    } catch (error) {
        next(error);
    }
});

router.put("/:id", async (req, res, next) => {
    try {
        const fields = validate(req.body);

        const definitions = database().collection(
            "approval_workflow_definitions"
        );

        const existing = await definitions.findOne({
            definitionId: req.params.id
        });

        if (!existing) {
            fail("Workflow definition not found", 404);
        }

        if (
            existing.protected ||
            existing.status !== "Inactive" ||
            existing.isDraft === true
        ) {
            fail(
                "Only inactive custom workflow definitions can be edited",
                409
            );
        }

        const updated = await definitions.findOneAndUpdate(
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
            fail("Workflow configuration was changed concurrently", 409);
        }

        await database()
            .collection("approval_workflow_definition_events")
            .insertOne({
                eventId: randomUUID(),
                definitionId: existing.definitionId,
                actorId: String(
                    req.get("X-Actor-Id") ?? "DEMO-POLICY-ADMIN"
                ).slice(0, 100),
                action: "SLA Configuration Updated",
                details: {
                    before: {
                        escalationRules: existing.escalationRules ?? [],
                        notifications: existing.notifications ?? {},
                        businessHours: existing.businessHours ?? null
                    },
                    after: {
                        escalationRules: fields.escalationRules,
                        notifications: fields.notifications,
                        businessHours: fields.businessHours
                    }
                },
                createdAt: new Date()
            });

        res.json(updated);
    } catch (error) {
        next(error);
    }
});

export default router;
