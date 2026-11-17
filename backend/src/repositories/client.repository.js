import {
    getCollection,
    findPage,
    escapeRegex,
    repositoryError,
    handleDuplicateKey
} from "./mongodb.repository.js";

import {
    normalizeRegistrationNumber,
    toClientDocument,
    serializeClientDocument
} from "../utils/client-document.js";

function clients() {
    return getCollection("clients");
}

export async function findClientById(
    clientId,
    options = {}
) {
    const document = await clients().findOne(
        { clientId },
        options
    );

    return serializeClientDocument(document);
}

export async function findClientByRegistrationNumber(
    registrationNumber
) {
    const document = await clients().findOne({
        registrationNumberNormalized:
            normalizeRegistrationNumber(registrationNumber)
    });

    return serializeClientDocument(document);
}

export async function searchClients({
    search = "",
    status = "",
    industry = "",
    country = "",
    page = 1,
    pageSize = 10,
    clientType = "",
    relationshipManager = "",
    dateFrom = "",
    dateTo = "",
} = {}) {
    const filter = {};

    if (clientType) {
        filter.clientType = clientType;
    }

    if (relationshipManager) {
        filter.relationshipManager = relationshipManager;
    }

    if (dateFrom || dateTo) {
        filter.createdAt = {};

        if (dateFrom) {
            filter.createdAt.$gte =
                new Date(`${dateFrom}T00:00:00.000Z`);
        }

        if (dateTo) {
            filter.createdAt.$lt =
                new Date(
                    Date.parse(`${dateTo}T00:00:00.000Z`) + 86400000
                );
        }
    }


    if (search.trim()) {
        const query = escapeRegex(search.trim());

        filter.$or = [
            {
                companyName: {
                    $regex: query,
                    $options: "i"
                }
            },
            {
                registrationNumber: {
                    $regex: query,
                    $options: "i"
                }
            },
            { clientId: { $regex: query, $options: "i" } },
        ];
    }

    if (status) {
        filter.status = status;
    }

    if (industry) {
        filter.industry = industry;
    }

    if (country) {
        filter.country = country;
    }

    const result = await findPage({
        collection: clients(),
        filter,
        sort: { _id: 1 },
        page,
        pageSize,
        serialize: serializeClientDocument
    });

    const clientIds = result.data.map(
        client => client.clientId
    );

    if (clientIds.length === 0) {
        return result;
    }

    const accountCounts = await getCollection("accounts")
        .aggregate([
            {
                $match: {
                    clientId: { $in: clientIds }
                }
            },
            {
                $group: {
                    _id: "$clientId",
                    count: { $sum: 1 }
                }
            }
        ])
        .toArray();

    const countsByClient = new Map(
        accountCounts.map(item => [
            item._id,
            item.count
        ])
    );

    return {
        ...result,
        data: result.data.map(client => ({
            ...client,
            accountCount: countsByClient.get(client.clientId) ?? 0
        }))
    };
}

export async function countClients(filter = {}) {
    return clients().countDocuments(filter);
}

export async function getClientDirectoryStatistics() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);

    thirtyDaysAgo.setUTCDate(
        thirtyDaysAgo.getUTCDate() - 30
    );

    const [statistics] = await clients().aggregate([
        {
            $group: {
                _id: null,
                totalClients: { $sum: 1 },
                activeClients: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", "Active"] },
                            1,
                            0
                        ]
                    }
                },
                newClients30Days: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    {
                                        $gte: [
                                            "$createdAt",
                                            thirtyDaysAgo
                                        ]
                                    },
                                    {
                                        $lte: [
                                            "$createdAt",
                                            now
                                        ]
                                    }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]).toArray();

    const totalClients = statistics?.totalClients ?? 0;
    const activeClients = statistics?.activeClients ?? 0;

    return {
        totalClients,
        activeClients,
        activePercentage: totalClients > 0
            ? activeClients / totalClients * 100
            : 0,
        newClients30Days:
            statistics?.newClients30Days ?? 0
    };
}

export async function insertClient(client) {
    const document = toClientDocument(client);

    try {
        await clients().insertOne(document);
        return serializeClientDocument(document);
    } catch (error) {
        handleDuplicateKey(
            error,
            "Client identifier or registration number already exists"
        );
    }
}

export async function updateClient(clientId, changes) {

    const allowed = [
        "companyName",
        "industry",
        "country",
        "contactEmail",
        "contactPhone",
        "status",
        "clientType",
        "relationshipManager",
        "nextReviewAt",
        "updatedAt",

        "operatingName",
        "incorporationDate",
        "currency",
        "organizationSize",
        "businessAddress",
        "city",
        "provinceState",
        "postalCode",
        "website",
        "riskRating",
        "complianceCategory",
        "kycStatus",
        "checklist",
        "contacts"

    ];


    const updates = {};

    for (const field of allowed) {
        if (Object.hasOwn(changes, field)) {
            updates[field] = changes[field];
        }
    }

    if (Object.hasOwn(updates, "updatedAt")) {
        updates.updatedAt = new Date(updates.updatedAt);

        if (Number.isNaN(updates.updatedAt.getTime())) {
            throw repositoryError(
                "Invalid updatedAt timestamp",
                400
            );
        }
    }

    if (Object.hasOwn(updates, "nextReviewAt") &&
        updates.nextReviewAt !== null) {
        updates.nextReviewAt = new Date(updates.nextReviewAt);

        if (Number.isNaN(updates.nextReviewAt.getTime())) {
            throw repositoryError("Invalid review date", 400);
        }
    }


    if (Object.keys(updates).length === 0) {
        throw repositoryError(
            "No valid client fields to update",
            400
        );
    }

    const result = await clients().updateOne(
        { clientId },
        { $set: updates }
    );

    if (result.matchedCount === 0) {
        throw repositoryError("Client not found", 404);
    }

    return findClientById(clientId);
}