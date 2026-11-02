import {
    MongoNetworkError,
    MongoServerSelectionError
} from "mongodb";

export default function errorMiddleware(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    console.error("API error:", err);

    const isMalformedJson =
        err?.type === "entity.parse.failed";

    const isDuplicateKey =
        err?.code === 11000;

    const isDatabaseUnavailable =
        err instanceof MongoNetworkError ||
        err instanceof MongoServerSelectionError ||
        err?.name === "MongoNotConnectedError";

    let statusCode = 500;
    let code = "INTERNAL_SERVER_ERROR";
    let message = "Internal server error";
    let details = [];

    if (isMalformedJson) {
        statusCode = 400;
        code = "INVALID_JSON";
        message = "Request body contains invalid JSON";
    } else if (isDuplicateKey) {
        statusCode = 409;
        code = "DUPLICATE_RESOURCE";
        message = "A resource with the supplied unique value already exists";
    } else if (isDatabaseUnavailable) {
        statusCode = 503;
        code = "SERVICE_UNAVAILABLE";
        message = "Database service unavailable";
    } else if (
        Number.isInteger(err?.statusCode) &&
        err.statusCode >= 400 &&
        err.statusCode <= 599
    ) {
        statusCode = err.statusCode;

        const defaultCodes = {
            400: "BAD_REQUEST",
            404: "NOT_FOUND",
            409: "CONFLICT",
            503: "SERVICE_UNAVAILABLE"
        };

        if (statusCode === 503) {
            code = "SERVICE_UNAVAILABLE";
            message = "Database service unavailable";
        } else if (statusCode !== 500) {
            code =
                typeof err.code === "string"
                    ? err.code
                    : defaultCodes[statusCode] ??
                      "REQUEST_FAILED";

            message =
                typeof err.message === "string"
                    ? err.message
                    : "Request failed";

            details = Array.isArray(err.details)
                ? err.details
                : err.details
                    ? [err.details]
                    : [];
        }
    }

    res.status(statusCode).json({
        error: {
            code,
            message,
            details
        }
    });
}