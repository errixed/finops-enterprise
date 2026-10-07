import { readJsonFile } from "./json.repository.js";

export async function findAllClients() {
    return readJsonFile("clients.json");
}