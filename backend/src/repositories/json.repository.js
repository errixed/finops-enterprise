import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIRECTORY = path.resolve(
    __dirname,
    "../../data"
);

export async function readJsonFile(fileName) {
    const filePath = path.join(DATA_DIRECTORY, fileName);

    const data = await fs.readFile(filePath, "utf-8");

    return JSON.parse(data);
}