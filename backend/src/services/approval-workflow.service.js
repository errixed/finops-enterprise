import { randomUUID } from "node:crypto";
import {
    insertApprovalWorkflow
} from "../repositories/approval-workflow.repository.js";
import {
    APPROVAL_STATUS
} from "../constants/approval-status.js";
import {
    validateNewApprovalWorkflow
} from "./approval-workflow-document.service.js";


export async function initializeApprovalWorkflow({
    transactionId,
    assessmentId,
    approvalPolicy,
    session
}) {
    if (!session?.inTransaction()) {
        throw new Error(
            "An active MongoDB transaction is required"
        );
    }


    if (!approvalPolicy.approvalRequired) {
        return {
            workflowId: null,
            approvalStatus: APPROVAL_STATUS.NOT_REQUIRED
        };
    }

    const now = new Date();

    const workflow = {
        workflowId: randomUUID(),
        transactionId,
        assessmentId,
        approvalPolicyId: approvalPolicy.policyId,
        approvalPolicyVersion: approvalPolicy.version,
        status: APPROVAL_STATUS.PENDING,
        currentStage: 1,
        requiredStages: approvalPolicy.requiredRoles.map(
            (role, index) => ({
                stageNumber: index + 1,
                requiredRole: role,
                status: index === 0
                    ? "Pending"
                    : "Waiting"
            })
        ),
        createdAt: now,
        updatedAt: now
    };

    validateNewApprovalWorkflow(
        workflow,
        approvalPolicy
    );

    await insertApprovalWorkflow(
        workflow,
        session
    );

    return {
        workflowId: workflow.workflowId,
        approvalStatus: APPROVAL_STATUS.PENDING
    };
}
