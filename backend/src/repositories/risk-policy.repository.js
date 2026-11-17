import {
    getCollection
} from "./mongodb.repository.js";

import {
    getMongoClient
} from "../config/mongodb.js";

const policies = () => getCollection("risk_policies");
const actors = () => getCollection("workflow_actors");

export async function findAllRiskPolicies() {
    return policies()
        .find({})
        .sort({ currency: 1, policyId: 1, version: -1 })
        .toArray();
}

export async function findRiskPolicyById(id) {
    return policies().findOne({ _id: id });
}

export async function findLatestRiskPolicy(policyId, currency) {
    return policies().findOne(
        { policyId, currency },
        { sort: { version: -1 } }
    );
}

export async function findActiveRiskPolicy(currency, session) {
    return policies().findOne(
        {
            currency,
            isDefault: true,
            status: "Active"
        },
        { session }
    );
}

export async function findWorkflowActor(actorId) {
    return actors().findOne({
        actorId,
        active: true
    });
}

export async function insertRiskPolicy(document) {
    await policies().insertOne(document);
    return document;
}

export async function updateDraftRiskPolicy(
    id,
    changes,
    expectedUpdatedAt
) {
    const filter = {
        _id: id,
        status: "Draft"
    };

    if (expectedUpdatedAt) {
        filter.updatedAt = expectedUpdatedAt;
    }

    const result = await policies().findOneAndUpdate(
        filter,
        {
            $set: {
                ...changes,
                updatedAt: new Date()
            }
        },
        { returnDocument: "after" }
    );

    return result;
}

export async function activateRiskPolicyVersion(id) {
    const session = getMongoClient().startSession();

    try {
        let activated;

        await session.withTransaction(async () => {
            const target = await policies().findOne(
                { _id: id },
                { session }
            );

            if (!target || target.status !== "Draft") {
                const error = new Error(
                    "Policy must exist and be a draft"
                );
                error.statusCode = 409;
                throw error;
            }


            const latest = await policies().findOne(
                {
                    policyId: target.policyId,
                    currency: target.currency
                },
                {
                    sort: { version: -1 },
                    session
                }
            );

            if (!latest || latest._id !== target._id) {
                const error = new Error(
                    "Only the latest policy version can be activated"
                );

                error.statusCode = 409;
                throw error;
            }

            const now = new Date();

            await policies().updateMany(
                {
                    currency: target.currency,
                    isDefault: true,
                    status: "Active"
                },
                {
                    $set: {
                        status: "Superseded",
                        effectiveTo: now,
                        updatedAt: now
                    }
                },
                { session }
            );

            const result = await policies().findOneAndUpdate(
                {
                    _id: id,
                    status: "Draft"
                },
                {
                    $set: {
                        status: "Active",
                        effectiveFrom: now,
                        effectiveTo: null,
                        updatedAt: now
                    }
                },
                {
                    session,
                    returnDocument: "after"
                }
            );

            if (!result) {
                const error = new Error(
                    "Policy activation conflict"
                );
                error.statusCode = 409;
                throw error;
            }

            activated = result;
        });

        return activated;
    } finally {
        await session.endSession();
    }
}

export async function findRiskPolicyVersion(
    policyId,
    version,
    currency,
    session
) {
    return policies().findOne(
        {
            policyId,
            version,
            currency,
            status: {
                $in: ["Active", "Superseded"]
            }
        },
        { session }
    );
}

export async function searchRiskPolicies({
    page,
    pageSize
}) {
    const collection = policies();

    const [data, total] = await Promise.all([
        collection
            .find({})
            .sort({
                currency: 1,
                policyId: 1,
                version: -1,
                _id: 1
            })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .toArray(),
        collection.countDocuments({})
    ]);

    return {
        data,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
}