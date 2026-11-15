import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

import errorMiddleware from "../src/middleware/error.middleware.js";

async function createTestServer() {
    const app = express();

    app.get("/approval-required", (req, res, next) => {
        const error = new Error(
            "The transaction requires approval before processing."
        );

        error.statusCode = 409;
        error.code = "APPROVAL_REQUIRED";
        error.details = [
            {
                field: "approvalStatus",
                message: "The approval workflow is pending."
            }
        ];

        next(error);
    });

    app.get("/not-found", (req, res, next) => {
        const error = new Error("Workflow not found");
        error.statusCode = 404;
        error.code = "WORKFLOW_NOT_FOUND";
        next(error);
    });

    app.get("/invalid", (req, res, next) => {
        const error = new Error("Invalid actor ID");
        error.statusCode = 400;
        error.code = "INVALID_REQUEST";
        next(error);
    });

    app.get("/unavailable", (req, res, next) => {
        const error = new Error(
            "No active risk policy is available"
        );

        error.statusCode = 503;
        error.code = "RISK_POLICY_UNAVAILABLE";
        next(error);
    });

    app.use(errorMiddleware);

    const server = app.listen(0);

    await new Promise(resolve => {
        server.once("listening", resolve);
    });

    return {
        server,
        baseUrl: `http://127.0.0.1:${server.address().port}`
    };
}

test("8.7: approval error uses standard envelope", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
        const response = await fetch(
            `${baseUrl}/approval-required`
        );

        const body = await response.json();

        assert.equal(response.status, 409);
        assert.equal(body.error.code, "APPROVAL_REQUIRED");
        assert.equal(
            body.error.details[0].field,
            "approvalStatus"
        );
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test("8.7: missing resource returns HTTP 404", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
        const response = await fetch(`${baseUrl}/not-found`);
        const body = await response.json();

        assert.equal(response.status, 404);
        assert.equal(body.error.code, "WORKFLOW_NOT_FOUND");
        assert.deepEqual(body.error.details, []);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test("8.7: invalid request returns HTTP 400", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
        const response = await fetch(`${baseUrl}/invalid`);
        const body = await response.json();

        assert.equal(response.status, 400);
        assert.equal(body.error.code, "INVALID_REQUEST");
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test("8.7: explicit service error retains its code", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
        const response = await fetch(`${baseUrl}/unavailable`);
        const body = await response.json();

        assert.equal(response.status, 503);
        assert.equal(
            body.error.code,
            "RISK_POLICY_UNAVAILABLE"
        );
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
