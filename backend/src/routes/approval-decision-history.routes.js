
import express from "express";
import { getDatabase } from "../config/mongodb.js";

const router = express.Router();

const ACTIVE = ["Pending", "InReview", "Escalated"];
const DECISIONS = ["All", "Approved", "Rejected", "Pending", "Escalated"];
const SORT_FIELDS = ["date", "decision", "actor", "workflow"];

function fail(message) {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
}

function dateBoundary(value, end = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        fail("Dates must use YYYY-MM-DD");
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
    ) {
        fail("Invalid date");
    }

    if (end) date.setUTCDate(date.getUTCDate() + 1);

    return date;
}

router.get("/", async (req, res, next) => {
    try {
        const page = Number(req.query.page ?? 1);
        const pageSize = Number(req.query.pageSize ?? 5);
        const sortBy = String(req.query.sortBy ?? "date");
        const sortOrder = String(req.query.sortOrder ?? "desc");
        const decisionFilter = String(req.query.decision ?? "All");
        const policy = String(req.query.policy ?? "all");
        const workflow = String(req.query.workflow ?? "all");
        const actor = String(req.query.actor ?? "all");
        const from = String(req.query.from ?? "");
        const to = String(req.query.to ?? "");

        if (
            !Number.isInteger(page) || page < 1 ||
            !Number.isInteger(pageSize) ||
            pageSize < 1 || pageSize > 100 ||
            !SORT_FIELDS.includes(sortBy) ||
            !["asc", "desc"].includes(sortOrder) ||
            !DECISIONS.includes(decisionFilter) ||
            [policy, workflow, actor].some(value => value.length > 150)
        ) {
            fail("Invalid decision history filters");
        }

        const start = from ? dateBoundary(from) : null;
        const end = to ? dateBoundary(to, true) : null;

        if (start && end && start >= end) {
            fail("End date must be on or after start date");
        }

        const now = new Date();
        const defaultStart = new Date(
            Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() - 29
            )
        );

        const dateMatch = {
            $gte: start ?? defaultStart,
            $lt: end ?? new Date("9999-12-31T00:00:00Z")
        };

        const db = getDatabase();

        const pipeline = [
            {
                $match: {
                    decidedAt: dateMatch
                }
            },
            {
                $project: {
                    _id: 0,
                    id: "$decisionId",
                    workflowId: 1,
                    transactionId: 1,
                    stageNumber: 1,
                    decision: 1,
                    actorId: 1,
                    actorRole: 1,
                    comments: 1,
                    date: "$decidedAt",
                    isPending: { $literal: false }
                }
            },
            {
                $unionWith: {
                    coll: "approval_workflows",
                    pipeline: [
                        {
                            $match: {
                                status: { $in: ACTIVE },
                                createdAt: dateMatch
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                id: {
                                    $concat: ["PENDING-", "$workflowId"]
                                },
                                workflowId: 1,
                                transactionId: 1,
                                stageNumber: "$currentStage",
                                decision: { $literal: "Pending" },
                                actorId: { $literal: "" },
                                actorRole: {
                                    $let: {
                                        vars: {
                                            current: {
                                                $arrayElemAt: [
                                                    "$requiredStages",
                                                    {
                                                        $subtract: [
                                                            "$currentStage",
                                                            1
                                                        ]
                                                    }
                                                ]
                                            }
                                        },
                                        in: "$$current.requiredRole"
                                    }
                                },
                                comments: {
                                    $literal: "Awaiting reviewer decision"
                                },
                                date: "$createdAt",
                                isPending: { $literal: true }
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: "approval_workflows",
                    localField: "workflowId",
                    foreignField: "workflowId",
                    as: "workflowDocument"
                }
            },
            {
                $unwind: {
                    path: "$workflowDocument",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: "approval_policies",
                    let: {
                        policyId: "$workflowDocument.approvalPolicyId",
                        version: "$workflowDocument.approvalPolicyVersion"
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$policyId", "$$policyId"] },
                                        { $eq: ["$version", "$$version"] }
                                    ]
                                }
                            }
                        },
                        { $limit: 1 }
                    ],
                    as: "policyDocument"
                }
            },
            {
                $unwind: {
                    path: "$policyDocument",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: "workflow_actors",
                    localField: "actorId",
                    foreignField: "actorId",
                    as: "actorDocument"
                }
            },
            {
                $unwind: {
                    path: "$actorDocument",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    policyId: {
                        $ifNull: [
                            "$workflowDocument.approvalPolicyId",
                            "Unknown"
                        ]
                    },
                    policyVersion: {
                        $ifNull: [
                            "$workflowDocument.approvalPolicyVersion",
                            null
                        ]
                    },
                    policyName: {
                        $ifNull: [
                            "$policyDocument.name",
                            {
                                $ifNull: [
                                    "$workflowDocument.approvalPolicyId",
                                    "Unknown Policy"
                                ]
                            }
                        ]
                    },
                    workflowName: {
                        $ifNull: [
                            "$workflowDocument.name",
                            "$workflowId"
                        ]
                    },
                    actorName: {
                        $ifNull: [
                            "$actorDocument.name",
                            {
                                $cond: [
                                    "$isPending",
                                    "Awaiting assignment",
                                    "$actorId"
                                ]
                            }
                        ]
                    },
                    workflowCreatedAt:
                        "$workflowDocument.createdAt",
                    workflowStatus:
                        "$workflowDocument.status",
                    requiredStages:
                        "$workflowDocument.requiredStages"
                }
            },
            {
                $match: {
                    ...(policy !== "all" ? { policyId: policy } : {}),
                    ...(workflow !== "all"
                        ? { workflowId: workflow } : {}),
                    ...(actor !== "all" ? { actorId: actor } : {}),
                    ...(decisionFilter !== "All"
                        ? { decision: decisionFilter } : {})
                }
            }
        ];

        const sortKey = {
            date: "date",
            decision: "decision",
            actor: "actorName",
            workflow: "workflowName"
        }[sortBy];

        const direction = sortOrder === "asc" ? 1 : -1;

        const [result] = await db.collection("approval_decisions")
            .aggregate([
                ...pipeline,
                {
                    $facet: {
                        records: [
                            {
                                $sort: {
                                    [sortKey]: direction,
                                    id: 1
                                }
                            },
                            { $skip: (page - 1) * pageSize },
                            { $limit: pageSize },
                            {
                                $project: {
                                    workflowDocument: 0,
                                    policyDocument: 0,
                                    actorDocument: 0
                                }
                            }
                        ],
                        statistics: [
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: 1 },
                                    approved: {
                                        $sum: {
                                            $cond: [
                                                { $eq: ["$decision", "Approved"] },
                                                1,
                                                0
                                            ]
                                        }
                                    },
                                    rejected: {
                                        $sum: {
                                            $cond: [
                                                { $eq: ["$decision", "Rejected"] },
                                                1,
                                                0
                                            ]
                                        }
                                    },
                                    pending: {
                                        $sum: {
                                            $cond: [
                                                { $eq: ["$decision", "Pending"] },
                                                1,
                                                0
                                            ]
                                        }
                                    },
                                    escalated: {
                                        $sum: {
                                            $cond: [
                                                { $eq: ["$decision", "Escalated"] },
                                                1,
                                                0
                                            ]
                                        }
                                    }
                                }
                            }
                        ],
                        policies: [
                            {
                                $group: {
                                    _id: "$policyId",
                                    label: { $first: "$policyName" }
                                }
                            },
                            { $sort: { label: 1 } }
                        ],
                        workflows: [
                            {
                                $group: {
                                    _id: "$workflowId",
                                    label: { $first: "$workflowName" }
                                }
                            },
                            { $sort: { label: 1 } }
                        ],
                        actors: [
                            { $match: { actorId: { $ne: "" } } },
                            {
                                $group: {
                                    _id: "$actorId",
                                    label: { $first: "$actorName" }
                                }
                            },
                            { $sort: { label: 1 } }
                        ]
                    }
                }
            ], { allowDiskUse: true })
            .toArray();

        const totals = result.statistics[0] ?? {
            total: 0,
            approved: 0,
            rejected: 0,
            pending: 0,
            escalated: 0
        };

        res.json({
            data: result.records,
            summary: totals,
            pagination: {
                page,
                pageSize,
                total: totals.total,
                totalPages: Math.ceil(totals.total / pageSize)
            },
            filters: {
                policies: result.policies.map(item => ({
                    value: item._id,
                    label: item.label
                })),
                workflows: result.workflows.map(item => ({
                    value: item._id,
                    label: item.label
                })),
                actors: result.actors.map(item => ({
                    value: item._id,
                    label: item.label
                }))
            },
            period: {
                from: (start ?? defaultStart).toISOString(),
                to: (end ?? now).toISOString()
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
