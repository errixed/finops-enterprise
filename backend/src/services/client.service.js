import { findAllClients } from "../repositories/client.repository.js";

export async function getAllClients() {
    const clients = await findAllClients();

    return clients;
}