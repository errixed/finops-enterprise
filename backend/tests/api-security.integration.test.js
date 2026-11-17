
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
    startIntegrationEnvironment,
    stopIntegrationEnvironment,
    request,
    expectStatus
} from "./helpers/integration.js";

before(startIntegrationEnvironment);
after(stopIntegrationEnvironment);

test("Health endpoint returns healthy status", async () => {
    const response = await request(
        "GET",
        "/health"
    );

    expectStatus(response, 200);
});

test("Unknown API route returns 404", async () => {
    const response = await request(
        "GET",
        "/this-endpoint-does-not-exist"
    );

    expectStatus(response, 404);
});

test("Transaction document listing is denied by default", async () => {
    const response = await request(
        "GET",
        `/transactions/${randomUUID()}/documents`
    );

    expectStatus(response, 403);

    assert.equal(
        response.data.error.code,
        "DOCUMENT_ACCESS_DISABLED"
    );
});

test("Transaction document upload is denied by default", async () => {
    const response = await request(
        "POST",
        `/transactions/${randomUUID()}/documents`,
        {
            body: {
                filename: "test.pdf"
            }
        }
    );

    expectStatus(response, 403);
});

test("Transaction document download is denied by default", async () => {
    const response = await request(
        "GET",
        `/transactions/${randomUUID()}/documents/${randomUUID()}`
    );

    expectStatus(response, 403);
});

test("Transaction document deletion is denied by default", async () => {
    const response = await request(
        "DELETE",
        `/transactions/${randomUUID()}/documents/${randomUUID()}`
    );

    expectStatus(response, 403);
});

test("Transaction document history is denied by default", async () => {
    const response = await request(
        "GET",
        `/transactions/${randomUUID()}/document-history`
    );

    expectStatus(response, 403);
});

test("Malformed JSON returns standardized error", async () => {
    const { baseUrl } = await startIntegrationEnvironment();

    const response = await fetch(
        `${baseUrl}/api/v1/clients`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: '{"invalid":'
        }
    );

    expectStatus({
        status: response.status,
        data: await response.json()
    }, 400);
});

test("Dashboard summary responds successfully", async () => {
    const response = await request(
        "GET",
        "/dashboard/summary"
    );

    expectStatus(response, 200);
});

test("Dashboard trend responds successfully", async () => {
    const response = await request(
        "GET",
        "/dashboard/trend"
    );

    expectStatus(response, 200);
});

test("Risk assessment overview responds successfully", async () => {
    const response = await request(
        "GET",
        "/risk-assessments/overview"
    );

    expectStatus(response, 200);
});

test("Risk alerts respond successfully", async () => {
    const response = await request(
        "GET",
        "/risk-assessments/alerts"
    );

    expectStatus(response, 200);
});

test("Risk analytics respond successfully", async () => {
    const response = await request(
        "GET",
        "/risk-assessments/analytics"
    );

    expectStatus(response, 200);
});

test("Approval workflow listing responds successfully", async () => {
    const response = await request(
        "GET",
        "/approval-workflows"
    );

    expectStatus(response, 200);
});

test("Workflow actor listing responds successfully", async () => {
    const response = await request(
        "GET",
        "/workflow-actors"
    );

    expectStatus(response, 200);
});

test("Workflow definition summary responds successfully", async () => {
    const response = await request(
        "GET",
        "/approval-workflow-definitions/summary"
    );

    expectStatus(response, 200);
});

test("Approval decision history responds successfully", async () => {
    const response = await request(
        "GET",
        "/approval-decision-history"
    );

    expectStatus(response, 200);
});

test("Approval audit trail responds successfully", async () => {
    const response = await request(
        "GET",
        "/approval-audit-trail"
    );

    expectStatus(response, 200);
});
