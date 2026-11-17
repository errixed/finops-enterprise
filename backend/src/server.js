import app from "./app.js";
import { environment } from "./config/environment.js";
import {
    connectMongoDB,
    initializeCollections,
    closeMongoDB,
    getDatabase
} from "./config/mongodb.js";
import {
    initializeValidators
} from "../scripts/initialize-validators.js";
import {
    initializeRiskPolicies
} from "../scripts/initialize-risk-policies.js";
import {
    createRiskAssessmentIndexes
} from "./repositories/risk-assessment.repository.js";
import {
    initializeApprovalPolicies
} from "../scripts/initialize-approval-policies.js";
import {
    initializeApprovalWorkflowIndexes
} from "./repositories/approval-workflow.repository.js";
import {
    createRiskActivityIndex
} from "./repositories/transaction.repository.js";
import {
    initializeApprovalDecisionIndexes
} from "./repositories/approval-decision.repository.js";
import {
    initializeAccountBalanceHistoryIndexes,
    initializeAccountAuditIndexes
} from "../scripts/initialize-indexes.js";

async function startServer() {
    try {
        await connectMongoDB();

        await initializeCollections();
        await initializeAccountBalanceHistoryIndexes();
        await initializeAccountAuditIndexes();
        await createRiskAssessmentIndexes();

        const database = getDatabase();

        await database.collection("risk_cases").createIndex(
            { caseId: 1 },
            { unique: true }
        );

        await database.collection("risk_cases").createIndex(
            { createdAt: -1, status: 1 }
        );

        await database.collection("risk_case_events").createIndex(
            { caseId: 1, createdAt: 1 }
        );

        await initializeValidators();

        await initializeRiskPolicies();

        await initializeApprovalPolicies();

        await initializeApprovalWorkflowIndexes();

        await initializeApprovalDecisionIndexes();

        await createRiskActivityIndex();
        const server = app.listen(
            environment.port,
            () => {
                console.log(
                    `Server running on http://localhost:${environment.port}`
                );
            }
        );

        async function shutdown() {
            console.log("Shutting down server...");

            server.close(async () => {
                try {
                    await closeMongoDB();
                    process.exit(0);
                } catch (error) {
                    console.error(
                        "Shutdown failed:",
                        error.message
                    );
                    process.exit(1);
                }
            });
        }

        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);

    } catch (error) {
        console.error(
            "Failed to start server:",
            error.message
        );

        await closeMongoDB();
        process.exit(1);
    }
}

startServer();