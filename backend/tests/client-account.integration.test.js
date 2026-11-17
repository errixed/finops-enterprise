
import test, { before, after } from "node:test";
import assert from "node:assert/strict";

import {
    startIntegrationEnvironment,
    stopIntegrationEnvironment,
    request,
    expectStatus,
    clientPayload,
    accountPayload,
    createTestClient,
    createTestAccount
} from "./helpers/integration.js";

before(startIntegrationEnvironment);
after(stopIntegrationEnvironment);

test("Client registration persists data in MongoDB", async () => {
    const { db } = await startIntegrationEnvironment();
    const client = await createTestClient();

    assert.ok(client.clientId);

    const stored = await db.collection("clients").findOne({
        clientId: client.clientId
    });

    assert.ok(stored);
    assert.equal(stored.companyName, client.companyName);
    assert.equal(stored.status, "Active");
});

test("Registered client can be retrieved", async () => {
    const client = await createTestClient();

    const response = await request(
        "GET",
        `/clients/${client.clientId}`
    );

    expectStatus(response, 200);
    assert.equal(response.data.clientId, client.clientId);
});

test("Client company name can be updated", async () => {
    const client = await createTestClient();

    const response = await request(
        "PATCH",
        `/clients/${client.clientId}`,
        {
            body: {
                companyName: "Updated Corporation"
            }
        }
    );

    expectStatus(response, 200);

    assert.equal(
        response.data.companyName,
        "Updated Corporation"
    );
});

test("Client update persists after subsequent retrieval", async () => {
    const client = await createTestClient();

    const update = await request(
        "PUT",
        `/clients/${client.clientId}`,
        {
            body: {
                industry: "Manufacturing"
            }
        }
    );

    expectStatus(update, 200);

    const retrieved = await request(
        "GET",
        `/clients/${client.clientId}`
    );

    expectStatus(retrieved, 200);

    assert.equal(
        retrieved.data.industry,
        "Manufacturing"
    );
});

test("Registration number cannot be edited", async () => {
    const client = await createTestClient();

    const response = await request(
        "PATCH",
        `/clients/${client.clientId}`,
        {
            body: {
                registrationNumber: "CHANGED12345"
            }
        }
    );

    expectStatus(response, 400);
});

test("Client cannot be created without company name", async () => {
    const response = await request(
        "POST",
        "/clients",
        {
            body: clientPayload({
                companyName: ""
            })
        }
    );

    expectStatus(response, 400);
});

test("Client with invalid email is rejected", async () => {
    const response = await request(
        "POST",
        "/clients",
        {
            body: clientPayload({
                contactEmail: "invalid-email"
            })
        }
    );

    expectStatus(response, 400);
});

test("Client with unsupported industry is rejected", async () => {
    const response = await request(
        "POST",
        "/clients",
        {
            body: clientPayload({
                industry: "Invalid Industry"
            })
        }
    );

    expectStatus(response, 400);
});

test("Duplicate registration number is rejected", async () => {
    const first = clientPayload();

    const original = await request(
        "POST",
        "/clients",
        { body: first }
    );

    expectStatus(original, 201);

    const duplicate = await request(
        "POST",
        "/clients",
        {
            body: {
                ...clientPayload(),
                registrationNumber:
                    first.registrationNumber.toLowerCase()
            }
        }
    );

    expectStatus(duplicate, 409);
});

test("Unknown client returns 404", async () => {
    const response = await request(
        "GET",
        "/clients/nonexistent-client"
    );

    expectStatus(response, 404);
});

test("Client directory summary responds successfully", async () => {
    const response = await request(
        "GET",
        "/clients/summary"
    );

    expectStatus(response, 200);
});

test("Client directory metrics respond successfully", async () => {
    const response = await request(
        "GET",
        "/clients/metrics"
    );

    expectStatus(response, 200);
});

test("Account creation persists balance as MongoDB Long", async () => {
    const { db } = await startIntegrationEnvironment();

    const client = await createTestClient();

    const account = await createTestAccount(
        client.clientId,
        { balanceMinor: 250000 }
    );

    const stored = await db.collection("accounts").findOne({
        accountId: account.accountId
    });

    assert.ok(stored);
    assert.equal(BigInt(stored.balanceMinor), 250000n);
    assert.equal(stored.clientId, client.clientId);
});

test("Account can be retrieved by ID", async () => {
    const client = await createTestClient();
    const account = await createTestAccount(client.clientId);

    const response = await request(
        "GET",
        `/accounts/${account.accountId}`
    );

    expectStatus(response, 200);
    assert.equal(response.data.accountId, account.accountId);
});

test("Client accounts endpoint returns its account", async () => {
    const client = await createTestClient();
    const account = await createTestAccount(client.clientId);

    const response = await request(
        "GET",
        `/clients/${client.clientId}/accounts`
    );

    expectStatus(response, 200);

    const serialized = JSON.stringify(response.data);

    assert.ok(serialized.includes(account.accountId));
});

test("Account cannot be created for an unknown client", async () => {
    const response = await request(
        "POST",
        "/accounts",
        {
            body: accountPayload(
                "00000000-0000-4000-8000-000000000001"
            )
        }
    );

    expectStatus(response, 404);
});

test("Negative initial balance is rejected", async () => {
    const client = await createTestClient();

    const response = await request(
        "POST",
        "/accounts",
        {
            body: accountPayload(client.clientId, {
                balanceMinor: -100
            })
        }
    );

    expectStatus(response, 400);
});

test("Fractional balance is rejected", async () => {
    const client = await createTestClient();

    const response = await request(
        "POST",
        "/accounts",
        {
            body: accountPayload(client.clientId, {
                balanceMinor: 10.25
            })
        }
    );

    expectStatus(response, 400);
});

test("Unsupported account currency is rejected", async () => {
    const client = await createTestClient();

    const response = await request(
        "POST",
        "/accounts",
        {
            body: accountPayload(client.clientId, {
                currency: "EUR"
            })
        }
    );

    expectStatus(response, 400);
});

test("Future account opening date is rejected", async () => {
    const client = await createTestClient();

    const response = await request(
        "POST",
        "/accounts",
        {
            body: accountPayload(client.clientId, {
                openDate: "2099-01-01"
            })
        }
    );

    expectStatus(response, 400);
});

test("Invalid account status is rejected", async () => {
    const client = await createTestClient();

    const response = await request(
        "POST",
        "/accounts",
        {
            body: accountPayload(client.clientId, {
                status: "Invalid"
            })
        }
    );

    expectStatus(response, 400);
});

test("Frozen client cannot register new accounts", async () => {
    const client = await createTestClient();

    const update = await request(
        "PATCH",
        `/clients/${client.clientId}`,
        {
            body: { status: "Suspended" }
        }
    );

    expectStatus(update, 200);

    const response = await request(
        "POST",
        "/accounts",
        {
            body: accountPayload(client.clientId)
        }
    );

    expectStatus(response, 409);
});

test("Invalid account filter is rejected", async () => {
    const response = await request(
        "GET",
        "/accounts?currency=EUR"
    );

    expectStatus(response, 400);
});

test("Unknown account returns 404", async () => {
    const response = await request(
        "GET",
        "/accounts/00000000-0000-4000-8000-000000000001"
    );

    expectStatus(response, 404);
});
