import {
    getCollection
} from "./mongodb.repository.js";

export async function getRiskIndicators() {
    const assessments = getCollection("risk_assessments");
    const transactions = getCollection("transactions");

    const [riskSummary, awaitingApprovalResult] = await Promise.all([
        assessments.aggregate([
            {
                $facet: {
                    totals: [
                        {
                            $group: {
                                _id: null,
                                totalAssessments: { $sum: 1 },
                                averageRiskScore: {
                                    $avg: "$riskScore"
                                },
                                approvalRequiredCount: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: [
                                                    "$approvalRequired",
                                                    true
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ],
                    levels: [
                        {
                            $group: {
                                _id: "$riskLevel",
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    recentHighRisk: [
                        {
                            $match: {
                                riskLevel: {
                                    $in: ["High", "Critical"]
                                }
                            }
                        },
                        {
                            $sort: {
                                assessedAt: -1,
                                assessmentId: 1
                            }
                        },
                        { $limit: 10 },
                        {
                            $project: {
                                _id: 0,
                                assessmentId: 1,
                                transactionId: 1,
                                riskScore: 1,
                                riskLevel: 1,
                                assessedAt: 1
                            }
                        }
                    ]
                }
            }
        ]).toArray(),

        transactions.aggregate([
            {
                $match: {
                    isLegacy: false,
                    status: "Pending",
                    approvalRequired: true,
                    approvalStatus: {
                        $in: [
                            "Pending",
                            "InReview",
                            "Escalated"
                        ]
                    }
                }
            },
            {
                $count: "total"
            }
        ]).toArray()
    ]);

    const result = riskSummary[0] ?? {};

    return {
        summary: result.totals?.[0] ?? null,
        levels: result.levels ?? [],
        recentHighRisk: result.recentHighRisk ?? [],
        awaitingApproval:
            awaitingApprovalResult[0]?.total ?? 0
    };
}

export async function getApprovalIndicators() {
    const workflows = getCollection("approval_workflows");
    const decisions = getCollection("approval_decisions");

    const [workflowResult, recentDecisions] = await Promise.all([
        workflows.aggregate([
            {
                $facet: {
                    statuses: [
                        {
                            $group: {
                                _id: "$status",
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    highRiskPending: [
                        {
                            $match: {
                                status: {
                                    $in: [
                                        "Pending",
                                        "InReview",
                                        "Escalated"
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: "risk_assessments",
                                localField: "assessmentId",
                                foreignField: "assessmentId",
                                as: "assessment"
                            }
                        },
                        {
                            $unwind: "$assessment"
                        },
                        {
                            $match: {
                                "assessment.riskLevel": {
                                    $in: ["High", "Critical"]
                                }
                            }
                        },
                        {
                            $count: "count"
                        }
                    ],
                    completion: [
                        {
                            $match: {
                                status: "Approved",
                                createdAt: { $type: "date" },
                                updatedAt: { $type: "date" }
                            }
                        },
                        {
                            $project: {
                                durationMs: {
                                    $dateDiff: {
                                        startDate: "$createdAt",
                                        endDate: "$updatedAt",
                                        unit: "millisecond"
                                    }
                                }
                            }
                        },
                        {
                            $match: {
                                durationMs: { $gte: 0 }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                averageMs: { $avg: "$durationMs" },
                                completedCount: { $sum: 1 }
                            }
                        }
                    ]
                }
            }
        ]).toArray(),

        decisions.aggregate([
            {
                $facet: {
                    total: [
                        { $count: "count" }
                    ],
                    recent: [
                        {
                            $sort: {
                                decidedAt: -1,
                                decisionId: 1
                            }
                        },
                        { $limit: 10 },
                        {
                            $project: {
                                _id: 0,
                                decisionId: 1,
                                workflowId: 1,
                                transactionId: 1,
                                stageNumber: 1,
                                actorId: 1,
                                actorRole: 1,
                                decision: 1,
                                reviewType: 1,
                                comments: 1,
                                decidedAt: 1
                            }
                        }
                    ]
                }
            }
        ]).toArray()
    ]);

    const result = workflowResult[0] ?? {};
    const decisionResult = recentDecisions[0] ?? {};

    return {
        statusGroups: result.statuses ?? [],
        highRiskPendingApprovals:
            result.highRiskPending?.[0]?.count ?? 0,
        averageCompletionMs:
            result.completion?.[0]?.averageMs ?? null,
        completedCount:
            result.completion?.[0]?.completedCount ?? 0,
        totalDecisions:
            decisionResult.total?.[0]?.count ?? 0,
        recentDecisions: decisionResult.recent ?? []
    };
}

export async function findActionableApprovalWorkflows({
    actorId = "",
    requiredRole = "",
    riskLevel = "",
    status = "",
    currency = "",
    minAmountMinor = null,
    maxAmountMinor = null,
    dateFrom = null,
    dateTo = null,
    sortBy = "createdAt",
    sortOrder = "asc",
    page = 1,
    pageSize = 10
} = {}) {
    const workflows = getCollection("approval_workflows");

    const activeStatuses = ["Pending", "InReview", "Escalated"];

    const pipeline = [
        {
            $match: {
                status: status
                    ? status
                    : { $in: activeStatuses }
            }
        },
        {
            $addFields: {
                activeStage: {
                    $first: {
                        $filter: {
                            input: {
                                $ifNull: ["$requiredStages", []]
                            },
                            as: "stage",
                            cond: {
                                $eq: [
                                    "$$stage.stageNumber",
                                    "$currentStage"
                                ]
                            }
                        }
                    }
                }
            }
        },
        {
            $match: {
                "activeStage.status": "Pending"
            }
        },
        {
            $addFields: {
                requiredRole: {
                    $cond: [
                        { $eq: ["$status", "Escalated"] },
                        "$escalation.destinationRole",
                        "$activeStage.requiredRole"
                    ]
                },
                actionType: {
                    $cond: [
                        { $eq: ["$status", "Escalated"] },
                        "EscalationReview",
                        "StageReview"
                    ]
                }
            }
        },
        {
            $match: {
                $or: [
                    {
                        status: { $in: ["Pending", "InReview"] }
                    },
                    {
                        status: "Escalated",
                        "escalation.status": "Pending"
                    }
                ],
                ...(requiredRole ? { requiredRole } : {})
            }
        },
        {
            $lookup: {
                from: "transactions",
                localField: "transactionId",
                foreignField: "transactionId",
                as: "transaction"
            }
        },
        {
            $unwind: "$transaction"
        },
        {
            $match: {
                "transaction.status": "Pending",
                "transaction.isLegacy": false,
                "transaction.approvalRequired": true,
                ...(currency
                    ? { "transaction.currency": currency }
                    : {})
            }
        },
        {
            $lookup: {
                from: "risk_assessments",
                localField: "assessmentId",
                foreignField: "assessmentId",
                as: "assessment"
            }
        },
        {
            $unwind: "$assessment"
        },
        {
            $match: {
                ...(riskLevel
                    ? { "assessment.riskLevel": riskLevel }
                    : {})
            }
        }
    ];

    const amountFilter = {};

    if (minAmountMinor !== null) {
        amountFilter.$gte = minAmountMinor;
    }

    if (maxAmountMinor !== null) {
        amountFilter.$lte = maxAmountMinor;
    }

    if (Object.keys(amountFilter).length) {
        pipeline.push({
            $match: {
                "transaction.amountMinor": amountFilter
            }
        });
    }

    const createdAtFilter = {};

    if (dateFrom) {
        createdAtFilter.$gte = dateFrom;
    }

    if (dateTo) {
        createdAtFilter.$lt = dateTo;
    }

    if (Object.keys(createdAtFilter).length) {
        pipeline.push({
            $match: {
                createdAt: createdAtFilter
            }
        });
    }

    if (actorId) {
        pipeline.push(
            {
                $lookup: {
                    from: "approval_decisions",
                    let: {
                        workflow: "$workflowId"
                    },
                    pipeline: [
                        {
                            $match: {
                                actorId,
                                decision: "Approved",
                                $expr: {
                                    $eq: [
                                        "$workflowId",
                                        "$$workflow"
                                    ]
                                }
                            }
                        },
                        {
                            $match: {
                                $or: [
                                    {
                                        reviewType: {
                                            $exists: false
                                        }
                                    },
                                    {
                                        reviewType: "StageReview"
                                    }
                                ]
                            }
                        },
                        { $limit: 1 }
                    ],
                    as: "actorApprovals"
                }
            },
            {
                $match: {
                    actorApprovals: { $size: 0 },
                    $or: [
                        {
                            status: { $ne: "Escalated" }
                        },
                        {
                            "escalation.requestedBy": {
                                $ne: actorId
                            }
                        }
                    ]
                }
            }
        );
    }

    const direction = sortOrder === "asc" ? 1 : -1;

    const sortField = {
        createdAt: "createdAt",
        riskScore: "assessment.riskScore",
        amount: "transaction.amountMinor"
    }[sortBy];

    pipeline.push({
        $facet: {
            data: [
                {
                    $sort: {
                        [sortField]: direction,
                        workflowId: 1
                    }
                },
                {
                    $skip: (page - 1) * pageSize
                },
                {
                    $limit: pageSize
                },
                {
                    $project: {
                        _id: 0,
                        workflowId: 1,
                        transactionId: 1,
                        assessmentId: 1,
                        status: 1,
                        currentStage: 1,
                        requiredRole: 1,
                        actionType: 1,
                        createdAt: 1,
                        referenceNumber:
                            "$transaction.referenceNumber",
                        amountMinor:
                            "$transaction.amountMinor",
                        currency:
                            "$transaction.currency",
                        riskLevel:
                            "$assessment.riskLevel",
                        riskScore:
                            "$assessment.riskScore"
                    }
                }
            ],
            metadata: [
                {
                    $count: "total"
                }
            ]
        }
    });

    const [result] = await workflows.aggregate(
        pipeline
    ).toArray();

    return {
        data: result?.data ?? [],
        total: result?.metadata?.[0]?.total ?? 0
    };
}
