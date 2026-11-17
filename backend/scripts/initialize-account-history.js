import {
    connectMongoDB,
    closeMongoDB
} from "../src/config/mongodb.js";
import {
    getCollection
} from "../src/repositories/mongodb.repository.js";
import {
    initializeAccountHistory
} from "../src/services/account-operations.service.js";
import {
    serializeAccountDocument
} from "../src/utils/account-document.js";

if (
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_ACCOUNT_HISTORY_INIT !== "1"
) {
    console.error(
        "Account history initialization requires explicit development authorization."
    );
    process.exit(1);
}

await connectMongoDB();

try {
    const accounts = getCollection("accounts").find({});
    let processed = 0;

    for await (const document of accounts) {
        const account = serializeAccountDocument(document);

        await initializeAccountHistory(account);
        processed++;
    }

    console.log(
        `Account history initialization checked ${processed} accounts.`
    );
} finally {
    await closeMongoDB();
}