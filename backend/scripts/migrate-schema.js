import {
    connectMongoDB,
    getDatabase,
    getMongoClient,
    initializeCollections,
    closeMongoDB
} from "../src/config/mongodb.js";

import {
    initializeRiskPolicies
} from "./initialize-risk-policies.js";

import {
    initializeApprovalPolicies
} from "./initialize-approval-policies.js";

import {
    createRiskAssessmentIndexes
} from "../src/repositories/risk-assessment.repository.js";

import {
    initializeApprovalWorkflowIndexes
} from "../src/repositories/approval-workflow.repository.js";

import {
    initializeApprovalDecisionIndexes
} from "../src/repositories/approval-decision.repository.js";

import {
    createRiskActivityIndex
} from "../src/repositories/transaction.repository.js";

import {
    findMigrationByVersion,
    recordMigrationCompletion
} from "../src/repositories/migration.repository.js";

const MIGRATION_VERSION = "assignment3_risk_approval_v1";
const MIGRATION_CHECKSUM = "assignment3-risk-approval-schema-v1";

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function getHistoricalSnapshot(db, session) {
    const options = session ? { session } : {};

    const transactions = await db.collection("transactions")
        .find(
            { isLegacy: true },
            {
                ...options,
                projection: {
                    _id: 0,
                    transactionId: 1,
                    status: 1
                }
            }
        )
        .sort({ transactionId: 1 })
        .toArray();

    const accounts = await db.collection("accounts")
        .find(
            {},
            {
                ...options,
                projection: {
                    _id: 0,
                    accountId: 1,
                    balanceMinor: 1
                }
            }
        )
        .sort({ accountId: 1 })
        .toArray();

    return {
        transactions: transactions.map(item => ({
            transactionId: item.transactionId,
            status: item.status
        })),
        accounts: accounts.map(item => ({
            accountId: item.accountId,
            balanceMinor: item.balanceMinor.toString()
        }))
    };
}

async function migrateHistoricalTransactions(
    db,
    session
) {
    const transactions = db.collection("transactions");

    const historical = await transactions
        .find(
            { isLegacy: true },
            {
                session,
                projection: {
                    transactionId: 1,
                    status: 1
                }
            }
        )
        .toArray();

    for (const transaction of historical) {
        assert(
            ["Pending", "Completed", "Rejected"].includes(
                transaction.status
            ),
            `Unsupported historical status: ${transaction.transactionId}`
        );
    }

    for (const status of [
        "Pending",
        "Completed",
        "Rejected"
    ]) {
        const pending = status === "Pending";

        await transactions.updateMany(
            {
                isLegacy: true,
                status
            },
            [
                {
                    $set: {
                        riskAssessmentId: null,
                        riskScore: null,
                        riskLevel: null,
                        approvalRequired: pending,
                        approvalWorkflowId: null,
                        approvalStatus: pending
                            ? "Cancelled"
                            : "NotRequired"
                    }
                }
            ],
            { session }
        );
    }

    return {
        historicalTransactions: historical.length,
        historicalPending: historical.filter(
            item => item.status === "Pending"
        ).length,
        historicalCompleted: historical.filter(
            item => item.status === "Completed"
        ).length,
        historicalRejected: historical.filter(
            item => item.status === "Rejected"
        ).length
    };
}

async function verifyHistoricalCompatibility(db, session) {
    const transactions = db.collection("transactions");

    const invalid = await transactions.findOne(
        {
            isLegacy: true,
            $or: [
                { riskAssessmentId: { $ne: null } },
                { riskScore: { $ne: null } },
                { riskLevel: { $ne: null } },
                { approvalWorkflowId: { $ne: null } },
                {
                    status: "Pending",
                    approvalStatus: { $ne: "Cancelled" }
                },
                {
                    status: "Pending",
                    approvalRequired: { $ne: true }
                },
                {
                    status: { $in: ["Completed", "Rejected"] },
                    approvalStatus: { $ne: "NotRequired" }
                }
            ]
        },
        { session }
    );

    assert(
        !invalid,
        "Historical transaction compatibility verification failed"
    );
}

async function runMigration() {
    let session;

    try {
        await connectMongoDB();

        const db = getDatabase();

        await db.collection("schema_migrations")
            .createIndex(
                { version: 1 },
                { unique: true }
            );

        const existing = await findMigrationByVersion(
            MIGRATION_VERSION
        );

        if (existing) {
            assert(
                existing.status === "Completed" &&
                existing.checksum === MIGRATION_CHECKSUM,
                "Existing Assignment 3 migration record is inconsistent"
            );

            console.log(
                `Migration already completed: ${MIGRATION_VERSION}`
            );

            return;
        }

        const before = await getHistoricalSnapshot(db);

        await initializeCollections();

        await createRiskAssessmentIndexes();
        await initializeApprovalWorkflowIndexes();
        await initializeApprovalDecisionIndexes();
        await createRiskActivityIndex();

        await initializeRiskPolicies();
        await initializeApprovalPolicies();

        session = getMongoClient().startSession();

        await session.withTransaction(async () => {
            const repeated = await findMigrationByVersion(
                MIGRATION_VERSION,
                { session }
            );

            if (repeated) {
                throw new Error(
                    "Assignment 3 migration was recorded concurrently"
                );
            }

            const counts = await migrateHistoricalTransactions(
                db,
                session
            );

            await verifyHistoricalCompatibility(
                db,
                session
            );

            const after = await getHistoricalSnapshot(
                db,
                session
            );

            assert(
                JSON.stringify(before.transactions) ===
                JSON.stringify(after.transactions),
                "Historical transaction statuses changed"
            );

            assert(
                JSON.stringify(before.accounts) ===
                JSON.stringify(after.accounts),
                "Account balances changed during migration"
            );

            await recordMigrationCompletion({
                version: MIGRATION_VERSION,
                checksum: MIGRATION_CHECKSUM,
                counts,
                session
            });
        }, {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
            readPreference: "primary"
        });

        console.log(
            `Migration completed: ${MIGRATION_VERSION}`
        );
    } finally {
        if (session) {
            await session.endSession();
        }

        await closeMongoDB();
    }
}

runMigration().catch(error => {
    console.error(
        "Assignment 3 migration failed:",
        error.message
    );

    process.exitCode = 1;
});
