import {
    getCollection
} from "./mongodb.repository.js";

import {
    parsePagination
} from "../utils/pagination.js";

export async function initializeApprovalWorkflowIndexes() {
    const workflows = getCollection(
        "approval_workflows"
    );

    await workflows.createIndexes([
        {
            key: { workflowId: 1 },
            unique: true
        },
        {
            key: { transactionId: 1 },
            unique: true
        },
        {
            key: { status: 1, currentStage: 1 }
        }
    ]);
}

export async function insertApprovalWorkflow(
    workflow,
    session
) {
    if (!session?.inTransaction()) {
        throw new Error(
            "An active MongoDB transaction is required"
        );
    }

    await getCollection(
        "approval_workflows"
    ).insertOne(
        workflow,
        { session }
    );

    return workflow;
}

export async function findApprovalWorkflowForProcessing(
    workflowId,
    transactionId,
    assessmentId,
    session
) {
    return getCollection(
        "approval_workflows"
    ).findOne(
        {
            workflowId,
            transactionId,
            assessmentId
        },
        { session }
    );
}

export async function findApprovalWorkflowById(
    workflowId,
    session
) {
    return getCollection("approval_workflows").findOne(
        { workflowId },
        { session }
    );
}

export async function updateApprovalWorkflowState(
    previous,
    updated,
    session
) {
    if (!session?.inTransaction()) {
        throw new Error(
            "An active MongoDB transaction is required"
        );
    }

    const filter = {
        workflowId: previous.workflowId,
        status: previous.status,
        currentStage: previous.currentStage,
        requiredStages: {
            $elemMatch: {
                stageNumber: previous.currentStage,
                status: "Pending"
            }
        }
    };

    if (previous.escalation === undefined) {
        filter.escalation = { $exists: false };
    } else if (previous.escalation === null) {
        filter.escalation = null;
    } else {
        filter.escalation = previous.escalation;
    }

    const result = await getCollection(
        "approval_workflows"
    ).updateOne(
        filter,
        {
            $set: {
                status: updated.status,
                currentStage: updated.currentStage,
                requiredStages: updated.requiredStages,
                escalation: updated.escalation ?? null,
                updatedAt: new Date()
            }
        },
        { session }
    );

    return result.modifiedCount === 1;
}

export async function searchApprovalWorkflows({
    transactionId = "",
    status = "",
    page = 1,
    pageSize = 10
} = {}) {
    const pagination = parsePagination(page, pageSize);

    const filter = {};

    if (transactionId) {
        filter.transactionId = transactionId;
    }

    if (status) {
        filter.status = status;
    }

    const collection = getCollection("approval_workflows");

    const [documents, total] = await Promise.all([
        collection
            .find(filter)
            .sort({
                createdAt: -1,
                workflowId: 1
            })
            .skip(
                (pagination.page - 1) *
                pagination.pageSize
            )
            .limit(pagination.pageSize)
            .toArray(),

        collection.countDocuments(filter)
    ]);

    return {
        data: documents,
        pagination: {
            page: pagination.page,
            pageSize: pagination.pageSize,
            total,
            totalPages: Math.ceil(
                total / pagination.pageSize
            )
        }
    };
}
