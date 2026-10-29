export default function errorMiddleware(err, req, res, next) {
    console.error(err);

    const statusCode =
        Number.isInteger(err.statusCode) &&
        err.statusCode >= 400 &&
        err.statusCode <= 599
            ? err.statusCode
            : 500;

    const defaultCodes = {
        400: "BAD_REQUEST",
        404: "NOT_FOUND",
        409: "CONFLICT",
        503: "SERVICE_UNAVAILABLE"
    };

    const code = statusCode === 500
        ? "INTERNAL_SERVER_ERROR"
        : err.code ??
          defaultCodes[statusCode] ??
          "REQUEST_FAILED";

    const message = statusCode === 500
        ? "Internal server error"
        : err.message;

    const details = Array.isArray(err.details)
        ? err.details
        : err.details
            ? [err.details]
            : [];

    res.status(statusCode).json({
        error: {
            code,
            message,
            details
        }
    });
}