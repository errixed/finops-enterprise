import { getCollection } from "./mongodb.repository.js";
import { handleDuplicateKey } from "./mongodb.repository.js";

function assessments() {
    return getCollection("risk_assessments");
}

export async function insertRiskAssessment(
    assessment,
    session
) {
    if (!session?.inTransaction()) {
        throw new Error(
            "An active MongoDB transaction is required"
        );
    }

    try {
        await assessments().insertOne(
            assessment,
            { session }
        );

        return assessment;
    } catch (error) {
        handleDuplicateKey(
            error,
            "Risk assessment already exists"
        );
    }
}

export async function findRiskAssessmentById(
    assessmentId,
    options = {}
) {
    return assessments().findOne(
        { assessmentId },
        options
    );
}

export async function findRiskAssessmentsByTransactionId(
    transactionId,
    options = {}
) {
    return assessments()
        .find({ transactionId }, options)
        .sort({ assessedAt: -1, assessmentId: -1 })
        .toArray();
}

export async function createRiskAssessmentIndexes() {
    await assessments().createIndexes([
        {
            key: { assessmentId: 1 },
            unique: true,
            name: "idx_risk_assessment_id"
        },
        {
            key: { transactionId: 1 },
            name: "idx_risk_assessment_transaction"
        },
        {
            key: { assessedAt: -1 },
            name: "idx_risk_assessment_date"
        }
    ]);
}

export async function searchRiskAssessments({
    search = "",
    transactionId = "",
    riskLevel = "",
    minScore = null,
    maxScore = null,
    dateFrom = null,
    dateTo = null,
    sortBy = "assessedAt",
    sortOrder = "desc",
    page = 1,
    pageSize = 10
} = {}) {
    const match = {};

    if (transactionId) {
        match.transactionId = transactionId;
    }

    if (riskLevel) {
        match.riskLevel = riskLevel;
    }

    if (minScore !== null || maxScore !== null) {
        match.riskScore = {};

        if (minScore !== null) {
            match.riskScore.$gte = minScore;
        }

        if (maxScore !== null) {
            match.riskScore.$lte = maxScore;
        }
    }

    if (dateFrom || dateTo) {
        match.assessedAt = {};

        if (dateFrom) {
            match.assessedAt.$gte = dateFrom;
        }

        if (dateTo) {
            match.assessedAt.$lt = dateTo;
        }
    }

    const pipeline = [
        { $match: match }
    ];

    if (search) {
        const escaped = search.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

        pipeline.push(
            {
                $lookup: {
                    from: "transactions",
                    localField: "transactionId",
                    foreignField: "transactionId",
                    as: "transaction"
                }
            },
            {
                $match: {
                    $or: [
                        {
                            transactionId: {
                                $regex: escaped,
                                $options: "i"
                            }
                        },
                        {
                            "transaction.referenceNumber": {
                                $regex: escaped,
                                $options: "i"
                            }
                        }
                    ]
                }
            }
        );
    }

    const direction = sortOrder === "asc" ? 1 : -1;

    pipeline.push({
        $facet: {
            data: [
                {
                    $sort: {
                        [sortBy]: direction,
                        assessmentId: 1
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
                        transaction: 0
                    }
                }
            ],
            metadata: [
                { $count: "total" }
            ]
        }
    });

    const [result] = await assessments()
        .aggregate(pipeline)
        .toArray();

    const total = result?.metadata?.[0]?.total ?? 0;

    return {
        data: result?.data ?? [],
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
}
