import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
    connectMongoDB,
    getDatabase,
    initializeCollections,
    closeMongoDB
} from "../src/config/mongodb.js";

import {
    initializeRiskPolicies
} from "../scripts/initialize-risk-policies.js";

import {
    initializeApprovalPolicies
} from "../scripts/initialize-approval-policies.js";

import {
    initializeApprovalDecisionIndexes
} from "../src/repositories/approval-decision.repository.js";

import {
    initializeApprovalWorkflowIndexes
} from "../src/repositories/approval-workflow.repository.js";

import app from "../src/app.js";

if (process.env.MONGODB_DATABASE !== "finops_enterprise_test") {
    throw new Error("An isolated MongoDB test database is required");
}

let db;
let server;
let baseUrl;

const workflowId = randomUUID();
const transactionId = randomUUID();
const assessmentId = randomUUID();

async function request(path) {
    const response = await fetch(`${baseUrl}${path}`);

    return {
        status: response.status,
        body: await response.json()
    };
}

before(async () => {
    await connectMongoDB();

    db = getDatabase();

    await db.dropDatabase();
    await initializeCollections();
    await initializeRiskPolicies();
    await initializeApprovalPolicies();
    await initializeApprovalDecisionIndexes();
    await initializeApprovalWorkflowIndexes();

    const now = new Date();

    await db.collection("transactions").insertOne({
        transactionId,
        referenceNumber: "TXN-QUEUE-TEST-001",
        amountMinor: 2500000,
        currency: "CAD",
        status: "Pending",
        isLegacy: false,
        riskAssessmentId: assessmentId,
        riskScore: 65,
        riskLevel: "High",
        approvalRequired: true,
        approvalWorkflowId: workflowId,
        approvalStatus: "InReview",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    });

    await db.collection("risk_assessments").insertOne({
        assessmentId,
        transactionId,
        policyId: "RISK-POLICY-CAD",
        policyVersion: 1,
        riskScore: 65,
        riskLevel: "High",
        approvalRequired: true,
        triggeredRules: [],
        assessedAt: now
    });

    await db.collection("approval_workflows").insertOne({
        workflowId,
        transactionId,
        assessmentId,
        status: "InReview",
        currentStage: 2,
        requiredStages: [
            {
                stageNumber: 1,
                requiredRole: "OperationsReviewer",
                status: "Approved"
            },
            {
                stageNumber: 2,
                requiredRole: "SeniorReviewer",
                status: "Pending"
            }
        ],
        createdAt: now,
        updatedAt: now
    });

    await db.collection("approval_decisions").insertOne({
        decisionId: randomUUID(),
        workflowId,
        transactionId,
        stageNumber: 1,
        actorId: "ACTOR-OPERATIONS-001",
        actorRole: "OperationsReviewer",
        decision: "Approved",
        comments: "First stage approved",
        decidedAt: now,
        idempotencyKey: randomUUID()
    });

    server = app.listen(0);

    await new Promise(resolve =>
        server.once("listening", resolve)
    );

    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
});

after(async () => {
    if (server) {
        await new Promise(resolve =>
            server.close(resolve)
        );
    }

    if (db) {
        await db.dropDatabase();
    }

    await closeMongoDB();
});

test("8.5: risk dashboard returns HTTP 200", async () => {
    const result = await request("/risk/dashboard");

    assert.equal(result.status, 200);
    assert.equal(
        typeof result.body.totalAssessments,
        "number"
    );
});

test("8.5: approval dashboard counts workflows", async () => {
    const result = await request("/approvals/dashboard");

    assert.equal(result.status, 200);
    assert.equal(result.body.totalWorkflows, 1);
    assert.equal(result.body.awaitingReview, 1);
});

test("8.5: queue lists current Senior stage", async () => {
    const result = await request(
        "/approvals/queue?actorId=ACTOR-SENIOR-001"
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 1);
    assert.equal(result.body.data[0].workflowId, workflowId);
    assert.equal(
        result.body.data[0].requiredRole,
        "SeniorReviewer"
    );
});

test("8.5: Operations actor cannot see completed stage", async () => {
    const result = await request(
        "/approvals/queue?actorId=ACTOR-OPERATIONS-001"
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 0);
    assert.equal(result.body.data.length, 0);
});

test("8.5: unknown actor returns HTTP 404", async () => {
    const result = await request(
        "/approvals/queue?actorId=ACTOR-UNKNOWN"
    );

    assert.equal(result.status, 404);
    assert.ok(result.body.error);
});

test("8.5: workflow actors endpoint returns seeded actors", async () => {
    const result = await request("/workflow-actors");

    assert.equal(result.status, 200);
    assert.equal(result.body.length, 4);
});

test("8.3: workflow details can be retrieved", async () => {
    const result = await request(
        `/approval-workflows/${workflowId}`
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.workflowId, workflowId);
});

test("8.3: decision history can be retrieved", async () => {
    const result = await request(
        `/approval-workflows/${workflowId}/decisions`
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.length, 1);
    assert.equal(
        result.body[0].actorId,
        "ACTOR-OPERATIONS-001"
    );
});

test("9.8: queue returns transaction and risk fields", async () => {
    const result = await request("/approvals/queue");

    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 1);

    const item = result.body.data[0];

    assert.equal(item.workflowId, workflowId);
    assert.equal(item.transactionId, transactionId);
    assert.equal(item.referenceNumber, "TXN-QUEUE-TEST-001");
    assert.equal(item.amountMinor, 2500000);
    assert.equal(item.currency, "CAD");
    assert.equal(item.riskLevel, "High");
    assert.equal(item.riskScore, 65);
    assert.equal(item.currentStage, 2);
    assert.equal(item.requiredRole, "SeniorReviewer");
    assert.equal(item.actionType, "StageReview");
});

test("9.8: combined matching filters return the workflow", async () => {
    const result = await request(
        "/approvals/queue?" +
        "riskLevel=High&" +
        "status=InReview&" +
        "requiredRole=SeniorReviewer&" +
        "currency=CAD&" +
        "minAmount=20000&" +
        "maxAmount=30000&" +
        "sortBy=amount&" +
        "sortOrder=desc&" +
        "page=1&pageSize=5"
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 1);
    assert.equal(result.body.data[0].workflowId, workflowId);
});

test("9.8: incorrect risk level returns an empty queue", async () => {
    const result = await request(
        "/approvals/queue?riskLevel=Critical"
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 0);
    assert.deepEqual(result.body.data, []);
});

test("9.8: amount filters use currency minor units", async () => {
    const result = await request(
        "/approvals/queue?minAmount=25000.01"
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 0);
});

test("9.8: queue validates reversed amount ranges", async () => {
    const result = await request(
        "/approvals/queue?minAmount=30000&maxAmount=20000"
    );

    assert.equal(result.status, 400);
    assert.ok(result.body.error);
    assert.ok(Array.isArray(result.body.error.details));
});

test("9.8: queue validates unsupported workflow status", async () => {
    const result = await request(
        "/approvals/queue?status=Approved"
    );

    assert.equal(result.status, 400);
    assert.ok(result.body.error);
});

test("9.8: queue validates unsupported sorting", async () => {
    const result = await request(
        "/approvals/queue?sortBy=nonexistentField"
    );

    assert.equal(result.status, 400);
    assert.ok(result.body.error);
});

test("9.8: queue paginates after filtering", async () => {
    const result = await request(
        "/approvals/queue?page=2&pageSize=1"
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 1);
    assert.equal(result.body.pagination.totalPages, 1);
    assert.deepEqual(result.body.data, []);
});

test("9.8: queue filters by creation date", async () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const params = new URLSearchParams({
        dateFrom: yesterday.toISOString().slice(0, 10),
        dateTo: tomorrow.toISOString().slice(0, 10)
    });

    const result = await request(
        `/approvals/queue?${params.toString()}`
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 1);
});

test("9.8: queue sorts multiple workflows correctly", async () => {
    const extra = [
        {
            workflowId: randomUUID(),
            transactionId: randomUUID(),
            assessmentId: randomUUID(),
            amountMinor: 500000,
            riskScore: 55,
            riskLevel: "High",
            createdAt: new Date("2026-11-10T10:00:00Z")
        },
        {
            workflowId: randomUUID(),
            transactionId: randomUUID(),
            assessmentId: randomUUID(),
            amountMinor: 9000000,
            riskScore: 90,
            riskLevel: "Critical",
            createdAt: new Date("2026-11-12T10:00:00Z")
        }
    ];

    try {
        await db.collection("transactions").insertMany(
            extra.map(item => ({
                transactionId: item.transactionId,
                referenceNumber: `TXN-${item.transactionId}`,
                amountMinor: item.amountMinor,
                currency: "CAD",
                status: "Pending",
                isLegacy: false,
                approvalRequired: true,
                approvalStatus: "Pending",
                riskAssessmentId: item.assessmentId,
                approvalWorkflowId: item.workflowId,
                riskScore: item.riskScore,
                riskLevel: item.riskLevel
            }))
        );

        await db.collection("risk_assessments").insertMany(
            extra.map(item => ({
                assessmentId: item.assessmentId,
                transactionId: item.transactionId,
                riskScore: item.riskScore,
                riskLevel: item.riskLevel,
                approvalRequired: true,
                assessedAt: item.createdAt
            }))
        );

        await db.collection("approval_workflows").insertMany(
            extra.map(item => ({
                workflowId: item.workflowId,
                transactionId: item.transactionId,
                assessmentId: item.assessmentId,
                status: "Pending",
                currentStage: 1,
                requiredStages: [
                    {
                        stageNumber: 1,
                        requiredRole: "OperationsReviewer",
                        status: "Pending"
                    }
                ],
                createdAt: item.createdAt,
                updatedAt: item.createdAt
            }))
        );

        const byAmount = await request(
            "/approvals/queue?sortBy=amount&sortOrder=desc&pageSize=10"
        );

        assert.equal(byAmount.status, 200);
        assert.equal(byAmount.body.pagination.total, 3);
        assert.deepEqual(
            byAmount.body.data.map(item => item.amountMinor),
            [9000000, 2500000, 500000]
        );

        const byRisk = await request(
            "/approvals/queue?sortBy=riskScore&sortOrder=asc&pageSize=10"
        );

        assert.equal(byRisk.status, 200);
        assert.deepEqual(
            byRisk.body.data.map(item => item.riskScore),
            [55, 65, 90]
        );

        const byDate = await request(
            "/approvals/queue?sortBy=createdAt&sortOrder=asc&pageSize=10"
        );

        assert.equal(byDate.status, 200);
        assert.equal(
            byDate.body.data[0].workflowId,
            extra[0].workflowId
        );
        assert.equal(
            byDate.body.data[1].workflowId,
            extra[1].workflowId
        );
    } finally {
        const workflowIds = extra.map(item => item.workflowId);
        const transactionIds = extra.map(item => item.transactionId);
        const assessmentIds = extra.map(item => item.assessmentId);

        await Promise.all([
            db.collection("approval_workflows").deleteMany({
                workflowId: { $in: workflowIds }
            }),
            db.collection("transactions").deleteMany({
                transactionId: { $in: transactionIds }
            }),
            db.collection("risk_assessments").deleteMany({
                assessmentId: { $in: assessmentIds }
            })
        ]);
    }
});
