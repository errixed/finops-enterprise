import app from "./app.js";
import { environment } from "./config/environment.js";
import {
    connectMongoDB,
    initializeCollections,
    closeMongoDB
} from "./config/mongodb.js";
import {
    initializeValidators
} from "../scripts/initialize-validators.js";

async function startServer() {
    try {
        await connectMongoDB();

        await initializeCollections();

        await initializeValidators();

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