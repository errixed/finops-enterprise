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

export async function findClientById(clientId) {
    const document = await clients().findOne({ clientId });
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
    page = 1,
    pageSize = 10
} = {}) {
    const filter = {};

    if (search.trim()) {
        const query = escapeRegex(search.trim());

        filter.$or = [
            { companyName: { $regex: query, $options: "i" } },
            { registrationNumber: { $regex: query, $options: "i" } }
        ];
    }

    if (status) {
        filter.status = status;
    }

    if (industry) {
        filter.industry = industry;
    }

    return findPage({
        collection: clients(),
        filter,
        sort: { _id: 1 },
        page,
        pageSize,
        serialize: serializeClientDocument
    });
}

export async function countClients(filter = {}) {
    return clients().countDocuments(filter);
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
        "updatedAt"
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