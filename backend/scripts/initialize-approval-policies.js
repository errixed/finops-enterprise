import {
    getDatabase
} from "../src/config/mongodb.js";

const DEFAULT_POLICIES = [
    {
        riskLevel: "Low",
        requiredRoles: []
    },
    {
        riskLevel: "Medium",
        requiredRoles: ["OperationsReviewer"]
    },
    {
        riskLevel: "High",
        requiredRoles: [
            "OperationsReviewer",
            "SeniorReviewer"
        ]
    },
    {
        riskLevel: "Critical",
        requiredRoles: [
            "SeniorReviewer",
            "ComplianceReviewer"
        ]
    }
];

export async function initializeApprovalPolicies() {
    const policies = getDatabase().collection(
        "approval_policies"
    );

    await policies.createIndex(
        { policyId: 1, version: 1 },
        { unique: true }
    );

    await policies.createIndex(
        { riskLevel: 1 },
        {
            unique: true,
            partialFilterExpression: {
                status: "Active"
            }
        }
    );

    for (const policy of DEFAULT_POLICIES) {
        await policies.updateOne(
            {
                policyId: `APPROVAL-POLICY-${policy.riskLevel.toUpperCase()}`,
                version: 1
            },
            {
                $setOnInsert: {
                    policyId: `APPROVAL-POLICY-${policy.riskLevel.toUpperCase()}`,
                    version: 1,
                    status: "Active",
                    ...policy,
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );
    }
}