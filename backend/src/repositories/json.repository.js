import {
    readFile,
    writeFile,
    rename,
    unlink
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PATHS } from "../../config.js";

const fileQueues = new Map();

export class StorageError extends Error {
    constructor(message, cause) {
        super(message, { cause });
        this.name = "StorageError";
        this.statusCode = 500;
    }
}

function getFilePath(fileName) {
    const allowedFiles = [
        "clients.json",
        "accounts.json",
        "transactions.json"
    ];

    if (!allowedFiles.includes(fileName)) {
        throw new StorageError(
            `Unknown JSON data file: ${fileName}`
        );
    }

    return path.join(PATHS.DATA_DIR, fileName);
}

function validateData(data, fileName) {
    if (!Array.isArray(data)) {
        throw new StorageError(
            `Invalid data structure in ${fileName}. Expected an array.`
        );
    }
}

async function readData(fileName) {
    const filePath = getFilePath(fileName);

    let content;

    try {
        content = await readFile(filePath, "utf8");
    } catch (error) {
        throw new StorageError(
            `Unable to read ${fileName}: ${error.message}`,
            error
        );
    }

    let data;

    try {
        data = JSON.parse(content);
    } catch (error) {
        throw new StorageError(
            `Invalid or corrupted JSON in ${fileName}`,
            error
        );
    }

    validateData(data, fileName);

    return data;
}

function withFileLock(fileName, operation) {
    const previous = fileQueues.get(fileName) || Promise.resolve();

    const current = previous
        .catch(() => {})
        .then(operation);

    const settled = current.then(
        () => undefined,
        () => undefined
    );

    fileQueues.set(fileName, settled);

    settled.then(() => {
        if (fileQueues.get(fileName) === settled) {
            fileQueues.delete(fileName);
        }
    });

    return current;
}

export async function readJsonFile(fileName) {
    return withFileLock(fileName, () => readData(fileName));
}

export async function updateJsonFile(fileName, updater) {
    return withFileLock(fileName, async () => {
        const data = await readData(fileName);

        const updatedData = await updater(structuredClone(data));

        validateData(updatedData, fileName);

        const filePath = getFilePath(fileName);
        const tempPath = `${filePath}.${randomUUID()}.tmp`;

        try {
            await writeFile(
                tempPath,
                JSON.stringify(updatedData, null, 2) + "\n",
                { encoding: "utf8", flag: "wx" }
            );

            await rename(tempPath, filePath);
        } catch (error) {
            try {
                await unlink(tempPath);
            } catch {
            }

            throw new StorageError(
                `Unable to update ${fileName}: ${error.message}`,
                error
            );
        }

        return updatedData;
    });
}
