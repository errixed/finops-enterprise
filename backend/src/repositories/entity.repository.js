import { randomUUID } from "node:crypto";
import {
    readJsonFile,
    updateJsonFile
} from "./json.repository.js";

export function createEntityRepository(fileName, idField) {

    async function findAll() {
        return readJsonFile(fileName);
    }

    async function findById(id) {
        const items = await readJsonFile(fileName);

        return items.find(
            item => String(item[idField]) === String(id)
        ) ?? null;
    }

    async function insert(item) {
        const newItem = {
            ...item,
            [idField]: item[idField] ?? randomUUID()
        };

        await updateJsonFile(fileName, data => {
            const exists = data.some(
                existing =>
                    String(existing[idField]) === String(newItem[idField])
            );

            if (exists) {
                const error = new Error(
                    `Entity with ${idField} ${newItem[idField]} already exists`
                );
                error.statusCode = 409;
                throw error;
            }

            data.push(newItem);
            return data;
        });

        return newItem;
    }

    async function update(id, changes) {
        let updatedItem = null;

        await updateJsonFile(fileName, data => {
            const index = data.findIndex(
                item => String(item[idField]) === String(id)
            );

            if (index === -1) {
                const error = new Error(
                    `Entity with ${idField} ${id} does not exist`
                );
                error.statusCode = 404;
                throw error;
            }

            updatedItem = {
                ...data[index],
                ...changes,
                [idField]: data[index][idField]
            };

            data[index] = updatedItem;

            return data;
        });

        return updatedItem;
    }

    return {
        findAll,
        findById,
        insert,
        update
    };
}