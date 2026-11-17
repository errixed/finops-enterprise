
import express from "express";
import { getDatabase } from "../config/mongodb.js";

const router = express.Router();

const ENTITY_TYPES = ["All", "Decision", "Workflow", "WorkflowDefinition"];
const ACTION_TYPES = ["All", "Creates", "Updates", "Deletes", "Access", "Configuration", "Approved", "Rejected", "Escalated"];
const SORT_FIELDS = ["date", "user", "action", "entityType"];

function invalid(message) {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
}

function parseDate(value, nextDay = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        invalid("Date must use YYYY-MM-DD");
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
    ) {
        invalid("Invalid date");
    }

    if (nextDay) {
        date.setUTCDate(date.getUTCDate() + 1);
    }

    return date;
}

function category(action, entityType) {
    const value = String(action).toLowerCase();

    if (value.includes("delet")) return "Deletes";
    if (value.includes("creat") || value.includes("duplicat")) return "Creates";
    if (value.includes("access") || value.includes("view")) return "Access";
    if (value.includes("approved")) return "Approved";
    if (value.includes("rejected")) return "Rejected";
    if (value.includes("escalat")) return "Escalated";
    if (
        value.includes("activat") ||
        value.includes("sla") ||
        value.includes("condition") ||
        value.includes("assignment") ||
        value.includes("stage") ||
        value.includes("policy")
    ) return "Configuration";
    if (value.includes("updat") || value.includes("edit")) return "Updates";

    return entityType === "Decision" ? "Updates" : "Configuration";
}

function actionGroup(categoryName) {
    if (["Approved", "Rejected", "Escalated"].includes(categoryName)) {
        return "Updates";
    }

    return categoryName;
}

function description(event) {
    if (event.description) return event.description;

    if (event.entityType === "Decision") {
        return `${event.action} at stage ${event.stageNumber ?? "—"} of workflow ${event.workflowId ?? "—"}${event.comments ? ` — ${event.comments}` : ""}`;
    }

    if (event.entityType === "Workflow") {
        return `Approval workflow ${event.entityId} created for transaction ${event.transactionId ?? "—"}.`;
    }

    return `${event.action} on workflow definition ${event.entityId}.`;
}

router.get("/", async (req, res, next) => {
    try {
        const page = Number(req.query.page ?? 1);
        const pageSize = Number(req.query.pageSize ?? 5);
        const entityType = String(req.query.entityType ?? "All");
        const entity = String(req.query.entity ?? "all");
        const action = String(req.query.action ?? "All");
        const user = String(req.query.user ?? "all");
        const sortBy = String(req.query.sortBy ?? "date");
        const sortOrder = String(req.query.sortOrder ?? "desc");
        const from = String(req.query.from ?? "");
        const to = String(req.query.to ?? "");

        if (
            !Number.isInteger(page) ||
            page < 1 ||
            !Number.isInteger(pageSize) ||
            pageSize < 1 ||
            pageSize > 100 ||
            !ENTITY_TYPES.includes(entityType) ||
            !ACTION_TYPES.includes(action) ||
            !SORT_FIELDS.includes(sortBy) ||
            !["asc", "desc"].includes(sortOrder) ||
            entity.length > 200 ||
            user.length > 200
        ) {
            invalid("Invalid audit trail filters");
        }

        const now = new Date();
        const start = from
            ? parseDate(from)
            : new Date(now.getTime() - 30 * 86400000);
        const end = to
            ? parseDate(to, true)
            : now;

        if (start >= end) {
            invalid("End date must be after start date");
        }

        const database = getDatabase();

        const [definitionEvents, decisions, workflows, actors] =
            await Promise.all([
                database.collection("approval_workflow_definition_events")
                    .find({
                        createdAt: { $gte: start, $lt: end }
                    })
                    .sort({ createdAt: -1 })
                    .toArray(),
                database.collection("approval_decisions")
                    .find({
                        decidedAt: { $gte: start, $lt: end }
                    })
                    .sort({ decidedAt: -1 })
                    .toArray(),
                database.collection("approval_workflows")
                    .find({
                        createdAt: { $gte: start, $lt: end }
                    })
                    .sort({ createdAt: -1 })
                    .toArray(),
                database.collection("workflow_actors")
                    .find({})
                    .project({
                        actorId: 1,
                        name: 1,
                        displayName: 1,
                        actorName: 1
                    })
                    .toArray()
            ]);

        const workflowIds = [
            ...new Set(decisions.map(item => item.workflowId).filter(Boolean))
        ];

        const decisionWorkflows = workflowIds.length
            ? await database.collection("approval_workflows")
                .find({ workflowId: { $in: workflowIds } })
                .project({
                    workflowId: 1,
                    transactionId: 1,
                    approvalPolicyId: 1,
                    approvalPolicyVersion: 1
                })
                .toArray()
            : [];

        const workflowMap = new Map(
            decisionWorkflows.map(item => [item.workflowId, item])
        );

        const actorMap = new Map(
            actors.map(item => [
                item.actorId,
                item.name ?? item.displayName ??
                item.actorName ?? item.actorId
            ])
        );

        const all = [];

        for (const event of definitionEvents) {
            const item = {
                id: event.eventId,
                date: event.createdAt,
                actorId: event.actorId ?? "System",
                entityType: "WorkflowDefinition",
                entityId: event.definitionId,
                action: event.action,
                details: event.details ?? {},
                source: "approval_workflow_definition_events"
            };

            all.push(item);
        }

        for (const decision of decisions) {
            const workflow = workflowMap.get(decision.workflowId);

            all.push({
                id: decision.decisionId,
                date: decision.decidedAt,
                actorId: decision.actorId ?? "System",
                entityType: "Decision",
                entityId: decision.decisionId,
                action: decision.decision,
                stageNumber: decision.stageNumber,
                workflowId: decision.workflowId,
                transactionId: decision.transactionId ??
                    workflow?.transactionId ?? null,
                policyId: workflow?.approvalPolicyId ?? null,
                policyVersion: workflow?.approvalPolicyVersion ?? null,
                comments: decision.comments ?? "",
                role: decision.actorRole ?? null,
                details: {
                    decision: decision.decision,
                    stageNumber: decision.stageNumber,
                    actorRole: decision.actorRole,
                    comments: decision.comments ?? ""
                },
                source: "approval_decisions"
            });
        }

        for (const workflow of workflows) {
            all.push({
                id: `WORKFLOW-${workflow.workflowId}`,
                date: workflow.createdAt,
                actorId: "System",
                entityType: "Workflow",
                entityId: workflow.workflowId,
                action: "Created",
                workflowId: workflow.workflowId,
                transactionId: workflow.transactionId,
                details: {
                    transactionId: workflow.transactionId,
                    requiredStages: workflow.requiredStages,
                    approvalPolicyId: workflow.approvalPolicyId,
                    approvalPolicyVersion: workflow.approvalPolicyVersion
                },
                source: "approval_workflows"
            });
        }

        const normalized = all.map(item => {
            const eventCategory = category(item.action, item.entityType);

            return {
                ...item,
                category: eventCategory,
                group: actionGroup(eventCategory),
                actorName: actorMap.get(item.actorId) ??
                    item.actorId ?? "System",
                description: description(item),
                date: new Date(item.date).toISOString()
            };
        });

        const entities = [...new Map(
            normalized.map(item => [
                `${item.entityType}:${item.entityId}`,
                {
                    value: `${item.entityType}:${item.entityId}`,
                    label: `${item.entityType} — ${item.entityId}`
                }
            ])
        ).values()].sort((a, b) => a.label.localeCompare(b.label));

        const users = [...new Map(
            normalized.map(item => [
                item.actorId,
                { value: item.actorId, label: item.actorName }
            ])
        ).values()].sort((a, b) => a.label.localeCompare(b.label));

        const filtered = normalized.filter(item => {
            if (entityType !== "All" && item.entityType !== entityType) {
                return false;
            }

            if (
                entity !== "all" &&
                `${item.entityType}:${item.entityId}` !== entity
            ) {
                return false;
            }

            if (
                action !== "All" &&
                item.category !== action &&
                item.group !== action
            ) {
                return false;
            }

            if (user !== "all" && item.actorId !== user) {
                return false;
            }

            return true;
        });

        const summary = {
            total: filtered.length,
            creates: filtered.filter(item => item.group === "Creates").length,
            updates: filtered.filter(item => item.group === "Updates").length,
            deletes: filtered.filter(item => item.group === "Deletes").length,
            access: filtered.filter(item => item.group === "Access").length,
            configuration: filtered.filter(
                item => item.group === "Configuration"
            ).length
        };

        const sortField = {
            date: "date",
            user: "actorName",
            action: "action",
            entityType: "entityType"
        }[sortBy];

        filtered.sort((left, right) => {
            const a = String(left[sortField] ?? "");
            const b = String(right[sortField] ?? "");
            const compare = a.localeCompare(b);

            return (sortOrder === "asc" ? compare : -compare) ||
                left.id.localeCompare(right.id);
        });

        const totalPages = Math.ceil(filtered.length / pageSize);
        const offset = (page - 1) * pageSize;

        res.json({
            data: filtered.slice(offset, offset + pageSize),
            summary,
            pagination: {
                page,
                pageSize,
                total: filtered.length,
                totalPages
            },
            filters: { entities, users },
            period: {
                from: start.toISOString(),
                to: end.toISOString()
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
