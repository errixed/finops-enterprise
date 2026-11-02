export function normalizeRegistrationNumber(value) {
    return value.trim().toUpperCase();
}

function toDate(value, field) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid ${field}`);
    }

    return date;
}

export function toClientDocument(client) {
    return {
        ...client,
        registrationNumberNormalized:
            normalizeRegistrationNumber(client.registrationNumber),
        createdAt: toDate(client.createdAt, "createdAt"),
        updatedAt: toDate(client.updatedAt, "updatedAt")
    };
}

export function serializeClientDocument(document) {
    if (!document) {
        return null;
    }

    const {
        _id,
        registrationNumberNormalized,
        ...client
    } = document;

    return {
        ...client,
        createdAt: toDate(
            client.createdAt,
            "createdAt"
        ).toISOString(),
        updatedAt: toDate(
            client.updatedAt,
            "updatedAt"
        ).toISOString()
    };
}