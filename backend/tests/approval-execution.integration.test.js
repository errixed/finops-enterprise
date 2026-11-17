import { Long } from "mongodb";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
    startIntegrationEnvironment,
    stopIntegrationEnvironment,
    request,
    expectStatus,
    createTestClient,
    createTestAccount
} from "./helpers/integration.js";

before(startIntegrationEnvironment);
after(stopIntegrationEnvironment);

async function setupTransfer(
    amountMinor,
    {
        sourceBalanceMinor = 20000000,
        destinationBalanceMinor = 20000000
    } = {}
) {
    const { db } = await startIntegrationEnvironment();

    const client = await createTestClient();

    const source = await createTestAccount(
        client.clientId,
        { balanceMinor: sourceBalanceMinor }
    );

    const destination = await createTestAccount(
        client.clientId,
        { balanceMinor: destinationBalanceMinor }
    );

    const created = await request(
        "POST",
        "/transactions",
        {
            body: {
                sourceAccountId: source.accountId,
                destinationAccountId: destination.accountId,
                amountMinor,
                currency: "CAD"
            },
            headers: {
                "Idempotency-Key": randomUUID()
            }
        }
    );

    expectStatus(created, 201);

    const transactionId = created.data.data.transactionId;

    const workflow = await db
        .collection("approval_workflows")
        .findOne({ transactionId });

    return {
        db,
        source,
        destination,
        transactionId,
        workflow
    };
}

async function decide(
    workflowId,
    actorId,
    decision,
    key = randomUUID()
) {
    return request(
        "POST",
        `/approval-workflows/${workflowId}/decisions`,
        {
            body: {
                actorId,
                decision,
                comments: "Reviewed during integration testing"
            },
            headers: {
                "Idempotency-Key": key
            }
        }
    );
}

test("Medium-risk transaction requires one approval", async () => {
    const context = await setupTransfer(1500000, {
        sourceBalanceMinor: 2000000,
        destinationBalanceMinor: 20000000
    });

    const assessment = await context.db
        .collection("risk_assessments")
        .findOne({
            transactionId: context.transactionId
        });

    assert.ok(assessment);
    assert.equal(assessment.riskLevel, "Medium");

    assert.ok(context.workflow);
    assert.equal(context.workflow.requiredStages.length, 1);

    const response = await decide(
        context.workflow.workflowId,
        "ACTOR-OPERATIONS-001",
        "Approved"
    );

    expectStatus(response, 200);

    const stored = await context.db
        .collection("approval_workflows")
        .findOne({
            workflowId: context.workflow.workflowId
        });

    assert.equal(stored.status, "Approved");
});


test("High-risk transaction requires sequential approvals", async () => {
    const context = await setupTransfer(10000000);

    assert.ok(context.workflow);

    assert.equal(
        context.workflow.requiredStages.length,
        2
    );

    const first = await decide(
        context.workflow.workflowId,
        "ACTOR-OPERATIONS-001",
        "Approved"
    );

    expectStatus(first, 200);

    const pending = await context.db
        .collection("approval_workflows")
        .findOne({
            workflowId: context.workflow.workflowId
        });

    assert.equal(pending.status, "InReview");
    assert.equal(pending.currentStage, 2);

    const second = await decide(
        context.workflow.workflowId,
        "ACTOR-SENIOR-001",
        "Approved"
    );

    expectStatus(second, 200);

    const approved = await context.db
        .collection("approval_workflows")
        .findOne({
            workflowId: context.workflow.workflowId
        });

    assert.equal(approved.status, "Approved");
});

test("Second-stage reviewer cannot approve first stage", async () => {
    const context = await setupTransfer(10000000);

    const response = await decide(
        context.workflow.workflowId,
        "ACTOR-SENIOR-001",
        "Approved"
    );

    assert.ok([400, 403, 409].includes(response.status));
});

test("Unknown reviewer cannot approve transaction", async () => {
    const context = await setupTransfer(10000000);

    const response = await decide(
        context.workflow.workflowId,
        "NONEXISTENT-ACTOR",
        "Approved"
    );

    assert.ok([400, 403, 404, 409].includes(response.status));
});

test("Approval decision requires an idempotency key", async () => {
    const context = await setupTransfer(10000000);

    const response = await request(
        "POST",
        `/approval-workflows/${context.workflow.workflowId}/decisions`,
        {
            body: {
                actorId: "ACTOR-OPERATIONS-001",
                decision: "Approved",
                comments: "Reviewed"
            }
        }
    );

    expectStatus(response, 400);
});

test("Approval decision can be safely replayed", async () => {
    const context = await setupTransfer(10000000);
    const key = randomUUID();

    const first = await decide(
        context.workflow.workflowId,
        "ACTOR-OPERATIONS-001",
        "Approved",
        key
    );

    const second = await decide(
        context.workflow.workflowId,
        "ACTOR-OPERATIONS-001",
        "Approved",
        key
    );

    expectStatus(first, 200);
    expectStatus(second, 200);

    assert.equal(second.data.replayed, true);

    const count = await context.db
        .collection("approval_decisions")
        .countDocuments({
            workflowId: context.workflow.workflowId,
            idempotencyKey: key
        });

    assert.equal(count, 1);
});

test("Same decision idempotency key cannot represent a different decision", async () => {
    const context = await setupTransfer(10000000);
    const key = randomUUID();

    const first = await decide(
        context.workflow.workflowId,
        "ACTOR-OPERATIONS-001",
        "Approved",
        key
    );

    expectStatus(first, 200);

    const second = await decide(
        context.workflow.workflowId,
        "ACTOR-OPERATIONS-001",
        "Rejected",
        key
    );

    expectStatus(second, 409);
});

test("Rejected workflow cannot proceed to financial execution", async () => {
    const context = await setupTransfer(10000000);

    const rejected = await decide(
        context.workflow.workflowId,
        "ACTOR-OPERATIONS-001",
        "Rejected"
    );

    expectStatus(rejected, 200);

    const processing = await request(
        "POST",
        `/transactions/${context.transactionId}/process`
    );

    assert.ok([400, 409].includes(processing.status));
});

test("Completed approvals permit transaction processing", async () => {
    const context = await setupTransfer(10000000);

    const first = await decide(
        context.workflow.workflowId,
        "ACTOR-OPERATIONS-001",
        "Approved"
    );

    expectStatus(first, 200);

    const second = await decide(
        context.workflow.workflowId,
        "ACTOR-SENIOR-001",
        "Approved"
    );

    expectStatus(second, 200);

    const processed = await request(
        "POST",
        `/transactions/${context.transactionId}/process`
    );

    expectStatus(processed, 200);

    assert.equal(
        processed.data.data.status,
        "Completed"
    );

    const sourceAfter = await context.db
        .collection("accounts")
        .findOne({
            accountId: context.source.accountId
        });

    const destinationAfter = await context.db
        .collection("accounts")
        .findOne({
            accountId: context.destination.accountId
        });

    assert.equal(
        BigInt(sourceAfter.balanceMinor),
        10000000n
    );

    assert.equal(
        BigInt(destinationAfter.balanceMinor),
        30000000n
    );
});

test("Completed transaction cannot debit accounts twice", async () => {
    const context = await setupTransfer(10000);

    const first = await request(
        "POST",
        `/transactions/${context.transactionId}/process`
    );

    expectStatus(first, 200);

    const sourceAfterFirst = await context.db
        .collection("accounts")
        .findOne({
            accountId: context.source.accountId
        });

    const second = await request(
        "POST",
        `/transactions/${context.transactionId}/process`
    );

    assert.ok([200, 400, 409].includes(second.status));

    const sourceAfterSecond = await context.db
        .collection("accounts")
        .findOne({
            accountId: context.source.accountId
        });

    assert.equal(
        BigInt(sourceAfterSecond.balanceMinor),
        BigInt(sourceAfterFirst.balanceMinor)
    );
});

test("Insufficient funds cannot create a negative balance", async () => {
    const context = await setupTransfer(10000);

    await context.db.collection("accounts").updateOne(
        { accountId: context.source.accountId },
        {
            $set: {
                balanceMinor: Long.fromNumber(0)
            }
        }
    );

    const response = await request(
        "POST",
        `/transactions/${context.transactionId}/process`
    );

    assert.equal(response.status, 200);
    assert.equal(response.data.data.status, "Rejected");

    const source = await context.db
        .collection("accounts")
        .findOne({
            accountId: context.source.accountId
        });

    const destination = await context.db
        .collection("accounts")
        .findOne({
            accountId: context.destination.accountId
        });

    assert.equal(BigInt(source.balanceMinor), 0n);
    assert.equal(BigInt(destination.balanceMinor), 20000000n);
});