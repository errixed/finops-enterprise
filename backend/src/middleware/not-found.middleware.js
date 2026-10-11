export default function notFoundMiddleware(req, res) {
    res.status(404).json({
        error: "API endpoint not found"
    });
}