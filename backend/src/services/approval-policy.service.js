import {
    findActiveApprovalPolicy
} from "../repositories/approval-policy.repository.js";

const APPROVAL_MATRIX = {
    Low: [],
    Medium: [
        "OperationsReviewer"
    ],
    High: [
        "OperationsReviewer",
        "SeniorReviewer"
    ],
    Critical: [
        "SeniorReviewer",
        "ComplianceReviewer"
    ]
};

export async function resolveApprovalPolicy(
    riskLevel,
    session
) {
    if (!Object.hasOwn(APPROVAL_MATRIX, riskLevel)) {
        throw new Error("Unsupported risk level");
    }
    const policy = await findActiveApprovalPolicy(
        riskLevel,
        session
    );
    if (!policy) {
        const error = new Error(
            `No active approval policy for ${riskLevel}`
        );

        error.statusCode = 503;
        throw error;
    }

    const expectedStages = APPROVAL_MATRIX[riskLevel];

    if (
        !Array.isArray(policy.requiredRoles) ||
        JSON.stringify(policy.requiredRoles) !==
        JSON.stringify(expectedStages)
    ) {
        throw new Error(
            "Approval policy does not match the required stage configuration"
        );
    }

    return {
        policyId: policy.policyId,
        version: policy.version,
        riskLevel,
        requiredRoles: [...policy.requiredRoles],
        approvalRequired: policy.requiredRoles.length > 0
    };
}