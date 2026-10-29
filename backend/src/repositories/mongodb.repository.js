import { getDatabase } from "../config/mongodb.js";
import { parsePagination } from "../utils/pagination.js";

export function getCollection(name) {
    return getDatabase().collection(name);
}

export function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function findPage({
    collection,
    filter = {},
    sort = {},
    page = 1,
    pageSize = 10,
    serialize
}) {
    const pagination = parsePagination(page, pageSize);

    const skip =
        (pagination.page - 1) * pagination.pageSize;

    const [documents, total] = await Promise.all([
        collection
            .find(filter)
            .sort(sort)
            .skip(skip)
            .limit(pagination.pageSize)
            .toArray(),

        collection.countDocuments(filter)
    ]);

    return {
        data: documents.map(serialize),
        pagination: {
            page: pagination.page,
            pageSize: pagination.pageSize,
            total,
            totalPages: Math.ceil(
                total / pagination.pageSize
            )
        }
    };
}

export function repositoryError(
    message,
    statusCode = 500
) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

export function handleDuplicateKey(error, message) {
    if (error?.code === 11000) {
        throw repositoryError(message, 409);
    }

    throw error;
}