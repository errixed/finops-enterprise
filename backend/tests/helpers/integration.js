
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const databaseName = `finops_test_${randomUUID().replaceAll("-", "")}`;

process.env.MONGODB_DATABASE = databaseName;
process.env.MONGODB_DB_NAME = databaseName;
process.env.ENABLE_DEMO_DOCUMENT_ACCESS = "false";

const { default: app } = await import(
    "../../src/app.js"
);

const mongodb = await import(
    "../../src/config/mongodb.js"
);

const { initializeValidators } = await import(
    "../../scripts/initialize-validators.js"
);

const { initializeRiskPolicies } = await import(
    "../../scripts/initialize-risk-policies.js"
);

const { initializeApprovalPolicies } = await import(
    "../../scripts/initialize-approval-policies.js"
);

const {
    createRiskAssessmentIndexes
} = await import(
    "../../src/repositories/risk-assessment.repository.js"
);

const {
    initializeApprovalWorkflowIndexes
} = await import(
    "../../src/repositories/approval-workflow.repository.js"
);

const {
    initializeApprovalDecisionIndexes
} = await import(
    "../../src/repositories/approval-decision.repository.js"
);

const {
    createRiskActivityIndex
} = await import(
    "../../src/repositories/transaction.repository.js"
);
const {
    initializeClientIndexes,
    initializeAccountIndexes,
    initializeTransactionIndexes,
    initializeAccountBalanceHistoryIndexes,
    initializeAccountAuditIndexes
} = await import(
    "../../scripts/initialize-indexes.js"
);

let server;
let baseUrl;
let started = false;

export async function startIntegrationEnvironment() {
    if (started) {
        return {
            db: mongodb.getDatabase(),
            baseUrl
        };
    }

    await mongodb.connectMongoDB();

    const db = mongodb.getDatabase();

    if (
        db.databaseName !== databaseName ||
        !db.databaseName.startsWith("finops_test_")
    ) {
        await mongodb.closeMongoDB();

        throw new Error(
            `Unsafe integration test database: ${db.databaseName}`
        );
    }

    await mongodb.initializeCollections();

    await initializeClientIndexes();
    await initializeAccountIndexes();
    await initializeTransactionIndexes();
    await initializeAccountBalanceHistoryIndexes();
    await initializeAccountAuditIndexes();
    await createRiskAssessmentIndexes();
    await initializeValidators();
    await initializeRiskPolicies();
    await initializeApprovalPolicies();
    await initializeApprovalWorkflowIndexes();
    await initializeApprovalDecisionIndexes();
    await createRiskActivityIndex();


    await db.collection("risk_cases").createIndex(
        { caseId: 1 },
        { unique: true }
    );

    await db.collection("risk_case_events").createIndex({
        caseId: 1,
        createdAt: 1
    });

    server = app.listen(0);

    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    baseUrl = `http://127.0.0.1:${server.address().port}`;
    started = true;

    return {
        db,
        baseUrl
    };
}
export async function stopIntegrationEnvironment() {
    try {
        if (server) {
            await new Promise((resolve, reject) => {
                server.close(error => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        }

        if (started) {
            const db = mongodb.getDatabase();

            if (
                db.databaseName !== databaseName ||
                !db.databaseName.startsWith("finops_test_")
            ) {
                throw new Error(
                    `Refusing to drop unsafe database: ${db.databaseName}`
                );
            }

            await db.dropDatabase();
        }
    } finally {
        await mongodb.closeMongoDB();

        server = undefined;
        baseUrl = undefined;
        started = false;
    }
}

export async function request(
    method,
    path,
    { body, headers = {} } = {}
) {
    assert.ok(
        baseUrl,
        "Integration environment is not running"
    );

    const response = await fetch(
        `${baseUrl}/api/v1${path}`,
        {
            method,
            headers: {
                ...(body !== undefined
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...headers
            },
            ...(body !== undefined
                ? { body: JSON.stringify(body) }
                : {})
        }
    );

    const contentType =
        response.headers.get("content-type") || "";

    const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    return {
        status: response.status,
        headers: response.headers,
        data
    };
}

export function expectStatus(response, expected) {
    assert.equal(
        response.status,
        expected,
        JSON.stringify(response.data, null, 2)
    );
}

export function unique(prefix = "TEST") {
    return `${prefix}-${randomUUID()}`;
}

export function clientPayload(overrides = {}) {
    return {
        companyName: "Integration Test Corporation",
        registrationNumber:
            `REG${randomUUID().replaceAll("-", "").slice(0, 12)}`,
        industry: "Technology",
        country: "Canada",
        contactEmail: "integration@example.com",
        contactPhone: "4165550123",
        clientType: "Corporate",
        ...overrides
    };
}

export function accountPayload(clientId, overrides = {}) {
    return {
        clientId,
        accountType: "Operating",
        accountName: unique("Account"),
        currency: "CAD",
        purpose: "Integration testing",
        openDate: "2026-01-01",
        balanceMinor: 10000000,
        allowTransactions: true,
        ...overrides
    };
}

export async function createTestClient(overrides = {}) {
    const response = await request(
        "POST",
        "/clients",
        {
            body: clientPayload(overrides)
        }
    );

    expectStatus(response, 201);

    return response.data;
}

export async function createTestAccount(
    clientId,
    overrides = {}
) {
    const response = await request(
        "POST",
        "/accounts",
        {
            body: accountPayload(clientId, overrides)
        }
    );

    expectStatus(response, 201);

    return response.data;
}
