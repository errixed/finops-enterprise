import {
    getCollection
} from "./mongodb.repository.js";

export async function findActiveApprovalPolicy(
    riskLevel,
    session
) {
    return getCollection("approval_policies").findOne(
        {
            riskLevel,
            status: "Active"
        },
        { session }
    );
}