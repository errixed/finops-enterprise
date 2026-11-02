import { getCollection } from "./mongodb.repository.js";

function migrations() {
    return getCollection("schema_migrations");
}

export async function findMigrationByVersion(
    version,
    options = {}
) {
    return migrations().findOne(
        { version },
        options
    );
}

export async function hasCompletedMigration(version) {
    const migration = await migrations().findOne({
        version,
        status: "Completed"
    });

    return migration !== null;
}

export async function recordMigrationCompletion({
    version,
    checksum,
    counts,
    session
}) {
    if (!session) {
        throw new Error(
            "Migration completion requires a MongoDB session"
        );
    }

    const record = {
        version,
        checksum,
        status: "Completed",
        counts,
        completedAt: new Date()
    };

    await migrations().insertOne(record, { session });

    return record;
}