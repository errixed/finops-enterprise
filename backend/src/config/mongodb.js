import { MongoClient } from "mongodb";
import { environment } from "./environment.js";

let client = null;
let database = null;

const COLLECTION_NAMES = Object.freeze([
    "clients",
    "accounts",
    "transactions",
    "schema_migrations"
]);

export async function connectMongoDB() {
    if (database) {
        return database;
    }

    const mongoClient = new MongoClient(
        environment.mongodbUri,
        {
            serverSelectionTimeoutMS: 10000
        }
    );

    try {
        await mongoClient.connect();

        const db = mongoClient.db(
            environment.mongodbDbName
        );

        await db.command({ ping: 1 });

        client = mongoClient;
        database = db;

        console.log(
            `Connected to MongoDB: ${database.databaseName}`
        );

        return database;
    } catch (error) {
        await mongoClient.close();

        console.error(
            "MongoDB connection failed:",
            error.message
        );

        throw error;
    }
}

export function getDatabase() {
    if (!database) {
        throw new Error(
            "MongoDB has not been initialized."
        );
    }

    return database;
}

export function getMongoClient() {
    if (!client) {
        throw new Error(
            "MongoDB has not been initialized."
        );
    }

    return client;
}

export async function initializeCollections() {
    const db = getDatabase();

    const existingCollections = await db
        .listCollections({}, { nameOnly: true })
        .toArray();

    const existingNames = new Set(
        existingCollections.map(
            (collection) => collection.name
        )
    );

    for (const name of COLLECTION_NAMES) {
        if (!existingNames.has(name)) {
            await db.createCollection(name);

            console.log(
                `Created MongoDB collection: ${name}`
            );
        }
    }

    console.log("MongoDB collections initialized.");
}

export async function closeMongoDB() {
    if (client) {
        await client.close();
    }

    client = null;
    database = null;

    console.log("MongoDB connection closed.");
}