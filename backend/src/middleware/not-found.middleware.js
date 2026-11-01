export default function notFoundMiddleware(req, res) {
    res.status(404).json({
        error: {
            code: "NOT_FOUND",
            message: "API endpoint not found",
            details: []
        }
    });
}