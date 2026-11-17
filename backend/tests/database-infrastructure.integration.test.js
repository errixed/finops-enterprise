
import test, { before, after } from "node:test";
import assert from "node:assert/strict";

import {
    startIntegrationEnvironment,
    stopIntegrationEnvironment
} from "./helpers/integration.js";

import {
    initializeValidators
} from "../scripts/initialize-validators.js";

import {
    initializeRiskPolicies
} from "../scripts/initialize-risk-policies.js";

import {
    initializeApprovalPolicies
} from "../scripts/initialize-approval-policies.js";

before(startIntegrationEnvironment);
after(stopIntegrationEnvironment);

test("Required application collections exist", async () => {
    const { db } = await startIntegrationEnvironment();

    const existing = new Set(
        (await db.listCollections({}, {
            nameOnly: true
        }).toArray()).map(item => item.name)
    );

    for (const name of [
        "clients",
        "accounts",
        "transactions",
        "risk_policies",
        "risk_assessments",
        "approval_policies",
        "approval_workflows",
        "approval_decisions",
        "workflow_actors",
        "schema_migrations"
    ]) {
        assert.ok(
            existing.has(name),
            `Missing collection: ${name}`
        );
    }
});

test("Client collection has schema validation", async () => {
    const { db } = await startIntegrationEnvironment();

    const info = await db.listCollections({
        name: "clients"
    }).next();

    assert.ok(info.options.validator);
});

test("Account collection has schema validation", async () => {
    const { db } = await startIntegrationEnvironment();

    const info = await db.listCollections({
        name: "accounts"
    }).next();

    assert.ok(info.options.validator);
});

test("Transaction collection has schema validation", async () => {
    const { db } = await startIntegrationEnvironment();

    const info = await db.listCollections({
        name: "transactions"
    }).next();

    assert.ok(info.options.validator);
});

test("Database rejects malformed client documents", async () => {
    const { db } = await startIntegrationEnvironment();

    await assert.rejects(
        db.collection("clients").insertOne({
            companyName: "Invalid"
        }),
        error => error.code === 121
    );
});

test("Database rejects malformed account documents", async () => {
    const { db } = await startIntegrationEnvironment();

    await assert.rejects(
        db.collection("accounts").insertOne({
            accountId: "INVALID",
            balanceMinor: -100
        }),
        error => error.code === 121
    );
});

test("Database rejects malformed transaction documents", async () => {
    const { db } = await startIntegrationEnvironment();

    await assert.rejects(
        db.collection("transactions").insertOne({
            transactionId: "INVALID",
            amountMinor: -100
        }),
        error => error.code === 121
    );
});

test("Risk policies have unique version index", async () => {
    const { db } = await startIntegrationEnvironment();

    const indexes = await db
        .collection("risk_policies")
        .indexes();

    assert.ok(
        indexes.some(index =>
            index.unique === true &&
            index.key.policyId === 1 &&
            index.key.version === 1
        )
    );
});

test("Approval policies have unique version index", async () => {
    const { db } = await startIntegrationEnvironment();

    const indexes = await db
        .collection("approval_policies")
        .indexes();

    assert.ok(
        indexes.some(index =>
            index.unique === true &&
            index.key.policyId === 1 &&
            index.key.version === 1
        )
    );
});

test("Risk policy initialization is idempotent", async () => {
    const { db } = await startIntegrationEnvironment();

    const beforeCount = await db
        .collection("risk_policies")
        .countDocuments();

    await initializeRiskPolicies();
    await initializeRiskPolicies();

    const afterCount = await db
        .collection("risk_policies")
        .countDocuments();

    assert.equal(afterCount, beforeCount);
});

test("Approval policy initialization is idempotent", async () => {
    const { db } = await startIntegrationEnvironment();

    const beforeCount = await db
        .collection("approval_policies")
        .countDocuments();

    await initializeApprovalPolicies();
    await initializeApprovalPolicies();

    const afterCount = await db
        .collection("approval_policies")
        .countDocuments();

    assert.equal(afterCount, beforeCount);
});

test("Reapplying validators preserves valid collections", async () => {
    const { db } = await startIntegrationEnvironment();

    await initializeValidators();
    await initializeValidators();

    for (const collection of [
        "clients",
        "accounts",
        "transactions"
    ]) {
        const info = await db.listCollections({
            name: collection
        }).next();

        assert.ok(info.options.validator);
    }
});

test("Active default risk policy exists for CAD and USD", async () => {
    const { db } = await startIntegrationEnvironment();

    for (const currency of ["CAD", "USD"]) {
        const policy = await db
            .collection("risk_policies")
            .findOne({
                currency,
                status: "Active",
                isDefault: true
            });

        assert.ok(policy);
    }
});

test("Default approval policies cover all risk levels", async () => {
    const { db } = await startIntegrationEnvironment();

    const policies = await db
        .collection("approval_policies")
        .find({ status: "Active" })
        .toArray();

    const levels = new Set(
        policies.map(policy => policy.riskLevel)
    );

    for (const level of [
        "Low",
        "Medium",
        "High",
        "Critical"
    ]) {
        assert.ok(levels.has(level));
    }
});
