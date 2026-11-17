import {
    getDatabase
} from "../src/config/mongodb.js";

import {
    DEFAULT_RISK_RULES,
    DEFAULT_RISK_THRESHOLDS
} from "../src/services/risk-assessment.service.js";

export async function initializeRiskPolicies() {
    const db = getDatabase();
    const policies = db.collection("risk_policies");
    const actors = db.collection("workflow_actors");

    await policies.createIndexes([
        {
            key: { policyId: 1, version: 1 },
            unique: true,
            name: "idx_risk_policy_version"
        },
        {
            key: { currency: 1, status: 1 },
            name: "idx_risk_policy_lookup"
        },
        {
            key: { currency: 1 },
            unique: true,
            name: "idx_unique_active_default_policy",
            partialFilterExpression: {
                status: "Active",
                isDefault: true
            }
        }
    ]);

    await actors.createIndex(
        { actorId: 1 },
        { unique: true, name: "idx_workflow_actor_id" }
    );

    await actors.createIndex(
        { role: 1 },
        { name: "idx_workflow_actor_role" }
    );

    await actors.updateOne(
        { actorId: "ACTOR-POLICY-001" },
        {
            $setOnInsert: {
                actorId: "ACTOR-POLICY-001",
                name: "Morgan Lee",
                role: "PolicyAdministrator",
                active: true
            }
        },
        { upsert: true }
    );

    const reviewers = [
        {
            actorId: "ACTOR-OPERATIONS-001",
            name: "Olivia Chen",
            role: "OperationsReviewer",
            active: true
        },
        {
            actorId: "ACTOR-SENIOR-001",
            name: "Daniel Brooks",
            role: "SeniorReviewer",
            active: true
        },
        {
            actorId: "ACTOR-COMPLIANCE-001",
            name: "Priya Shah",
            role: "ComplianceReviewer",
            active: true
        }
    ];

    for (const reviewer of reviewers) {
        await actors.updateOne(
            { actorId: reviewer.actorId },
            { $setOnInsert: reviewer },
            { upsert: true }
        );
    }

    for (const currency of ["CAD", "USD"]) {
        const policyId = `RISK-POLICY-${currency}`;

        const existing = await policies.findOne({
            policyId
        });

        if (existing) {
            continue;
        }

        const now = new Date();

        await policies.insertOne({
            _id: `DEFAULT-${currency}-V1`,
            policyId,
            version: 1,
            currency,
            isDefault: true,
            status: "Active",
            rules: structuredClone(DEFAULT_RISK_RULES),
            thresholds: structuredClone(
                DEFAULT_RISK_THRESHOLDS
            ),
            effectiveFrom: now,
            effectiveTo: null,
            createdBy: "SYSTEM",
            createdAt: now,
            updatedAt: now
        });
    }
}