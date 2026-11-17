import { getCollection } from "./mongodb.repository.js";
import { serializeTransactionDocument } from "../utils/transaction-document.js";

const PENDING_APPROVAL_STATUSES = [
    "Pending",
    "InReview",
    "Escalated"
];

function lookupStages() {
    return [
        {
            $lookup: {
                from: "accounts",
                localField: "sourceAccountId",
                foreignField: "accountId",
                as: "sourceAccount"
            }
        },
        {
            $lookup: {
                from: "accounts",
                localField: "destinationAccountId",
                foreignField: "accountId",
                as: "destinationAccount"
            }
        },
        {
            $set: {
                sourceAccount: { $first: "$sourceAccount" },
                destinationAccount: { $first: "$destinationAccount" }
            }
        },
        {
            $lookup: {
                from: "clients",
                localField: "sourceAccount.clientId",
                foreignField: "clientId",
                as: "client"
            }
        },
        {
            $set: {
                client: { $first: "$client" }
            }
        },
        {
            $lookup: {
                from: "risk_assessments",
                localField: "transactionId",
                foreignField: "transactionId",
                as: "assessments"
            }
        },
        {
            $lookup: {
                from: "approval_workflows",
                localField: "transactionId",
                foreignField: "transactionId",
                as: "workflows"
            }
        },
        {
            $set: {
                riskAssessment: {
                    $first: {
                        $sortArray: {
                            input: "$assessments",
                            sortBy: { assessedAt: -1 }
                        }
                    }
                },
                approvalWorkflow: {
                    $first: {
                        $sortArray: {
                            input: "$workflows",
                            sortBy: { createdAt: -1 }
                        }
                    }
                }
            }
        },
        {
            $set: {
                riskLevel: {
                    $ifNull: [
                        "$riskAssessment.riskLevel",
                        "$riskLevel"
                    ]
                },
                riskScore: {
                    $ifNull: [
                        "$riskAssessment.riskScore",
                        "$riskScore"
                    ]
                },
                approvalStatus: {
                    $ifNull: [
                        "$approvalWorkflow.status",
                        "$approvalStatus"
                    ]
                },
                clientId: "$sourceAccount.clientId",
                companyName: "$client.companyName",
                sourceAccountNumber: "$sourceAccount.accountNumber",
                destinationAccountNumber: "$destinationAccount.accountNumber",
                sourceAccountName: "$sourceAccount.accountName",
                destinationAccountName: "$destinationAccount.accountName"
            }
        },
        {
            $unset: [
                "assessments",
                "workflows",
                "riskAssessment",
                "approvalWorkflow",
                "sourceAccount",
                "destinationAccount",
                "client"
            ]
        }
    ];
}

function buildFilter(input) {
    const match = {};

    if (input.dateFrom || input.dateTo) {
        match.createdAt = {};

        if (input.dateFrom) {
            match.createdAt.$gte = new Date(
                `${input.dateFrom}T00:00:00.000Z`
            );
        }

        if (input.dateTo) {
            match.createdAt.$lt = new Date(
                Date.parse(`${input.dateTo}T00:00:00.000Z`) + 86400000
            );
        }
    }

    return match;
}

function buildJoinedFilter(input) {
    const match = {};

    if (input.clientId) {
        match.clientId = input.clientId;
    }

    if (input.accountId) {
        match.$or = [
            { sourceAccountId: input.accountId },
            { destinationAccountId: input.accountId }
        ];
    }

    if (input.transactionType) {
        match.transactionType = input.transactionType;
    }

    if (input.status) {
        match.status = input.status;
    }

    if (input.riskLevel) {
        match.riskLevel = input.riskLevel;
    }

    if (input.approvalStatus) {
        match.approvalStatus = input.approvalStatus;
    }

    if (input.search) {
        const escaped = input.search.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

        const regex = new RegExp(escaped, "i");

        match.$and = [
            {
                $or: [
                    { referenceNumber: regex },
                    { transactionId: regex },
                    { companyName: regex },
                    { sourceAccountNumber: regex },
                    { destinationAccountNumber: regex },
                    { description: regex }
                ]
            }
        ];
    }

    return match;
}

function serializeRow(document) {
    const transaction = serializeTransactionDocument(document);

    return {
        ...transaction,
        clientId: document.clientId ?? null,
        companyName: document.companyName ?? null,
        sourceAccountNumber: document.sourceAccountNumber ?? null,
        destinationAccountNumber: document.destinationAccountNumber ?? null,
        sourceAccountName: document.sourceAccountName ?? null,
        destinationAccountName: document.destinationAccountName ?? null,
        riskLevel: document.riskLevel ?? null,
        riskScore: document.riskScore ?? null,
        approvalStatus: document.approvalStatus ?? null
    };
}

export async function getTransactionDirectoryData(input) {
    const page = Number(input.page ?? 1);
    const pageSize = Number(input.pageSize ?? 10);

    if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100
    ) {
        const error = new Error("Invalid pagination parameters");
        error.statusCode = 400;
        throw error;
    }

    const pipeline = [
        { $match: buildFilter(input) },
        ...lookupStages(),
        { $match: buildJoinedFilter(input) }
    ];

    const [result] = await getCollection("transactions")
        .aggregate([
            ...pipeline,
            {
                $facet: {
                    rows: [
                        {
                            $sort: {
                                createdAt: -1,
                                transactionId: 1
                            }
                        },
                        { $skip: (page - 1) * pageSize },
                        { $limit: pageSize }
                    ],
                    count: [
                        { $count: "total" }
                    ],
                    risk: [
                        {
                            $match: {
                                riskLevel: {
                                    $in: ["High", "Critical"]
                                }
                            }
                        },
                        { $count: "total" }
                    ],
                    approval: [
                        {
                            $match: {
                                approvalStatus: {
                                    $in: PENDING_APPROVAL_STATUSES
                                }
                            }
                        },
                        { $count: "total" }
                    ],
                    money: [
                        {
                            $match: {
                                status: "Completed",
                                currency: "CAD"
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalMinor: {
                                    $sum: "$amountMinor"
                                }
                            }
                        }
                    ]
                }
            }
        ], { allowDiskUse: true })
        .toArray();

    const total = result?.count?.[0]?.total ?? 0;

    const volume = result?.money?.[0]?.totalMinor;
    const totalCADMinor = volume == null
        ? "0"
        : volume.toString();

    return {
        data: (result?.rows ?? []).map(serializeRow),
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        },
        summary: {
            totalTransactions: total,
            highCriticalRisk: result?.risk?.[0]?.total ?? 0,
            pendingApproval: result?.approval?.[0]?.total ?? 0,
            totalInternalCreditsCADMinor: totalCADMinor,
            totalInternalDebitsCADMinor: totalCADMinor,
            netInternalChangeCADMinor: "0"
        }
    };
}

export async function getTransactionHistoryStatistics(input) {
    const pipeline = [
        { $match: buildFilter(input) },
        ...lookupStages(),
        { $match: buildJoinedFilter(input) },
        {
            $facet: {
                statuses: [
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            completed: {
                                $sum: {
                                    $cond: [
                                        { $eq: ["$status", "Completed"] },
                                        1,
                                        0
                                    ]
                                }
                            },
                            inReview: {
                                $sum: {
                                    $cond: [
                                        {
                                            $in: [
                                                "$approvalStatus",
                                                ["Pending", "InReview", "Escalated"]
                                            ]
                                        },
                                        1,
                                        0
                                    ]
                                }
                            },
                            blocked: {
                                $sum: {
                                    $cond: [
                                        { $eq: ["$status", "Rejected"] },
                                        1,
                                        0
                                    ]
                                }
                            }
                        }
                    }
                ],
                completedCAD: [
                    {
                        $match: {
                            status: "Completed",
                            currency: "CAD"
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalMinor: { $sum: "$amountMinor" }
                        }
                    }
                ]
            }
        }
    ];

    const [result] = await getCollection("transactions")
        .aggregate(pipeline, { allowDiskUse: true })
        .toArray();

    const statuses = result?.statuses?.[0] ?? {};
    const amount = result?.completedCAD?.[0]?.totalMinor;

    return {
        total: statuses.total ?? 0,
        completed: statuses.completed ?? 0,
        inReview: statuses.inReview ?? 0,
        blocked: statuses.blocked ?? 0,
        completedCADMinor: amount?.toString() ?? "0"
    };
}
