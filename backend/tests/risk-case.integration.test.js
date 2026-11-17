
import test, { before, after } from "node:test";
import assert from "node:assert/strict";

import {
    startIntegrationEnvironment,
    stopIntegrationEnvironment,
    request,
    expectStatus,
    unique
} from "./helpers/integration.js";

before(startIntegrationEnvironment);
after(stopIntegrationEnvironment);

async function createCase(overrides = {}) {
    const response = await request(
        "POST",
        "/risk-cases",
        {
            body: {
                subject: unique("Investigation"),
                description: "Test investigation description",
                source: "Manual",
                priority: "Medium",
                status: "Open",
                ...overrides
            }
        }
    );

    expectStatus(response, 201);
    return response.data;
}

test("Risk case is created and persisted", async () => {
    const { db } = await startIntegrationEnvironment();

    const item = await createCase();

    assert.ok(item.caseId);

    const stored = await db.collection("risk_cases").findOne({
        caseId: item.caseId
    });

    assert.ok(stored);
    assert.equal(stored.status, "Open");
});

test("Risk case can be retrieved", async () => {
    const item = await createCase();

    const response = await request(
        "GET",
        `/risk-cases/${item.caseId}`
    );

    expectStatus(response, 200);
    assert.equal(response.data.caseId, item.caseId);
});

test("Risk case can be updated", async () => {
    const item = await createCase();

    const response = await request(
        "PATCH",
        `/risk-cases/${item.caseId}`,
        {
            body: {
                subject: "Updated investigation",
                status: "In Investigation"
            }
        }
    );

    expectStatus(response, 200);
    assert.equal(response.data.status, "In Investigation");
    assert.equal(
        response.data.subject,
        "Updated investigation"
    );
});

test("Risk case accepts investigation notes", async () => {
    const item = await createCase();

    const response = await request(
        "POST",
        `/risk-cases/${item.caseId}/notes`,
        {
            body: {
                note: "Investigation evidence reviewed."
            }
        }
    );

    expectStatus(response, 201);

    const history = await request(
        "GET",
        `/risk-cases/${item.caseId}/events`
    );

    expectStatus(history, 200);

    assert.ok(
        history.data.some(event =>
            event.action === "Note Added"
        )
    );
});

test("Risk case can be resolved", async () => {
    const item = await createCase();

    const response = await request(
        "POST",
        `/risk-cases/${item.caseId}/resolve`,
        {
            body: {
                resolution: "Investigation completed."
            }
        }
    );

    expectStatus(response, 200);
    assert.equal(response.data.status, "Resolved");
});

test("Resolved case cannot be edited", async () => {
    const item = await createCase();

    const resolved = await request(
        "POST",
        `/risk-cases/${item.caseId}/resolve`,
        {
            body: {
                resolution: "Case closed."
            }
        }
    );

    expectStatus(resolved, 200);

    const edit = await request(
        "PATCH",
        `/risk-cases/${item.caseId}`,
        {
            body: {
                subject: "Illegal update"
            }
        }
    );

    expectStatus(edit, 409);
});

test("Resolved case cannot accept notes", async () => {
    const item = await createCase();

    const resolved = await request(
        "POST",
        `/risk-cases/${item.caseId}/resolve`,
        {
            body: {
                resolution: "Completed."
            }
        }
    );

    expectStatus(resolved, 200);

    const response = await request(
        "POST",
        `/risk-cases/${item.caseId}/notes`,
        {
            body: {
                note: "Late note"
            }
        }
    );

    expectStatus(response, 409);
});

test("Case cannot be resolved twice", async () => {
    const item = await createCase();

    const first = await request(
        "POST",
        `/risk-cases/${item.caseId}/resolve`,
        {
            body: {
                resolution: "Completed."
            }
        }
    );

    expectStatus(first, 200);

    const second = await request(
        "POST",
        `/risk-cases/${item.caseId}/resolve`,
        {
            body: {
                resolution: "Second resolution."
            }
        }
    );

    expectStatus(second, 409);
});

test("Concurrent resolution allows exactly one success", async () => {
    const { db } = await startIntegrationEnvironment();
    const item = await createCase();

    const responses = await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
            request(
                "POST",
                `/risk-cases/${item.caseId}/resolve`,
                {
                    body: {
                        resolution: `Resolution ${index}`
                    }
                }
            )
        )
    );

    const successful = responses.filter(
        response => response.status === 200
    );

    assert.equal(successful.length, 1);

    assert.ok(
        responses.every(response =>
            [200, 409].includes(response.status)
        )
    );

    const stored = await db.collection("risk_cases").findOne({
        caseId: item.caseId
    });

    assert.equal(stored.status, "Resolved");
});

test("Risk case without subject is rejected", async () => {
    const response = await request(
        "POST",
        "/risk-cases",
        {
            body: {
                subject: "",
                description: "Description"
            }
        }
    );

    expectStatus(response, 400);
});

test("Risk case without description is rejected", async () => {
    const response = await request(
        "POST",
        "/risk-cases",
        {
            body: {
                subject: "Test",
                description: ""
            }
        }
    );

    expectStatus(response, 400);
});

test("Invalid case priority is rejected", async () => {
    const response = await request(
        "POST",
        "/risk-cases",
        {
            body: {
                subject: "Test",
                description: "Test",
                priority: "Extreme"
            }
        }
    );

    expectStatus(response, 400);
});

test("Invalid triggering rule is rejected", async () => {
    const response = await request(
        "POST",
        "/risk-cases",
        {
            body: {
                subject: "Test",
                description: "Test",
                triggeringRuleIds: ["INVALID"]
            }
        }
    );

    expectStatus(response, 400);
});

test("Invalid due date is rejected", async () => {
    const response = await request(
        "POST",
        "/risk-cases",
        {
            body: {
                subject: "Test",
                description: "Test",
                dueDate: "2026-02-30"
            }
        }
    );

    expectStatus(response, 400);
});

test("Risk case summary endpoint responds", async () => {
    const response = await request(
        "GET",
        "/risk-cases/summary"
    );

    expectStatus(response, 200);
});

test("Unknown case returns 404", async () => {
    const response = await request(
        "GET",
        "/risk-cases/CASE-NOT-FOUND"
    );

    expectStatus(response, 404);
});
