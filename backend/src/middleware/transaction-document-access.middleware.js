export function requireTransactionDocumentAccess(req, res, next) {
    if (process.env.ENABLE_DEMO_DOCUMENT_ACCESS !== "true") {
        return res.status(403).json({
            error: {
                code: "DOCUMENT_ACCESS_DISABLED",
                message: "Document access requires authentication outside demo mode."
            }
        });
    }

    req.user = {
        userId: "ASSIGNMENT3_DEMO_USER",
        roles: [
            "TransactionCreator",
            "OperationsReviewer",
            "Administrator"
        ]
    };

    next();
}
