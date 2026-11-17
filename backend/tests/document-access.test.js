
import test from "node:test";
import assert from "node:assert/strict";

import {
    requireTransactionDocumentAccess
} from "../src/middleware/transaction-document-access.middleware.js";

function createResponse() {
    return {
        statusCode: 200,
        body: null,

        status(code) {
            this.statusCode = code;
            return this;
        },

        json(body) {
            this.body = body;
            return this;
        }
    };
}

test("Document access is denied when demo mode is disabled", () => {
    const original = process.env.ENABLE_DEMO_DOCUMENT_ACCESS;

    try {
        delete process.env.ENABLE_DEMO_DOCUMENT_ACCESS;

        const req = {};
        const res = createResponse();

        let nextCalled = false;

        requireTransactionDocumentAccess(
            req,
            res,
            () => {
                nextCalled = true;
            }
        );

        assert.equal(res.statusCode, 403);

        assert.equal(
            res.body.error.code,
            "DOCUMENT_ACCESS_DISABLED"
        );

        assert.equal(nextCalled, false);
        assert.equal(req.user, undefined);
    } finally {
        if (original === undefined) {
            delete process.env.ENABLE_DEMO_DOCUMENT_ACCESS;
        } else {
            process.env.ENABLE_DEMO_DOCUMENT_ACCESS = original;
        }
    }
});

test("Document access is enabled in explicit demo mode", () => {
    const original = process.env.ENABLE_DEMO_DOCUMENT_ACCESS;

    try {
        process.env.ENABLE_DEMO_DOCUMENT_ACCESS = "true";

        const req = {};
        const res = createResponse();

        let nextCalled = false;

        requireTransactionDocumentAccess(
            req,
            res,
            () => {
                nextCalled = true;
            }
        );

        assert.equal(nextCalled, true);

        assert.equal(
            req.user.userId,
            "ASSIGNMENT3_DEMO_USER"
        );

        assert.ok(
            req.user.roles.includes("Administrator")
        );
    } finally {
        if (original === undefined) {
            delete process.env.ENABLE_DEMO_DOCUMENT_ACCESS;
        } else {
            process.env.ENABLE_DEMO_DOCUMENT_ACCESS = original;
        }
    }
});

test("Only exact string true enables demo access", () => {
    const original = process.env.ENABLE_DEMO_DOCUMENT_ACCESS;

    try {
        for (const value of [
            "TRUE",
            "1",
            "yes",
            "false"
        ]) {
            process.env.ENABLE_DEMO_DOCUMENT_ACCESS = value;

            const req = {};
            const res = createResponse();

            requireTransactionDocumentAccess(
                req,
                res,
                () => {
                    assert.fail(
                        `Access unexpectedly enabled for ${value}`
                    );
                }
            );

            assert.equal(res.statusCode, 403);
        }
    } finally {
        if (original === undefined) {
            delete process.env.ENABLE_DEMO_DOCUMENT_ACCESS;
        } else {
            process.env.ENABLE_DEMO_DOCUMENT_ACCESS = original;
        }
    }
});
