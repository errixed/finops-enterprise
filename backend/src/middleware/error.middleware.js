export default function errorMiddleware(err, req, res, next) {
    console.error(err);

    const statusCode =
        Number.isInteger(err.statusCode) &&
        err.statusCode >= 400 &&
        err.statusCode <= 599
            ? err.statusCode
            : 500;

    res.status(statusCode).json({
        error: statusCode === 500
            ? "Internal server error"
            : err.message,
        ...(err.details ? { details: err.details } : {})
    });
}