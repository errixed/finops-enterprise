import { readJsonFile, updateJsonFile } from "./json.repository.js";

const FILE = "clients.json";

const normalizeRegistration = value =>
    value.trim().toLowerCase();

export async function findAllClients() {
    return readJsonFile(FILE);
}

export async function findClientById(clientId) {
    const clients = await readJsonFile(FILE);

    return clients.find(
        client => client.clientId === clientId
    ) ?? null;
}

export async function findClientByRegistrationNumber(registrationNumber) {
    const clients = await readJsonFile(FILE);
    const normalized = normalizeRegistration(registrationNumber);

    return clients.find(
        client =>
            normalizeRegistration(client.registrationNumber) === normalized
    ) ?? null;
}

export async function insertClient(client) {
    await updateJsonFile(FILE, clients => {
        const duplicate = clients.some(
            existing =>
                normalizeRegistration(existing.registrationNumber) ===
                normalizeRegistration(client.registrationNumber)
        );

        if (duplicate) {
            const error = new Error("Registration number already exists");
            error.statusCode = 409;
            throw error;
        }

        if (clients.some(existing => existing.clientId === client.clientId)) {
            const error = new Error("Client identifier already exists");
            error.statusCode = 409;
            throw error;
        }

        clients.push(client);
        return clients;
    });

    return client;
}

export async function updateClient(clientId, changes) {
    let updatedClient;

    await updateJsonFile(FILE, clients => {
        const index = clients.findIndex(
            client => client.clientId === clientId
        );

        if (index === -1) {
            const error = new Error("Client not found");
            error.statusCode = 404;
            throw error;
        }

        updatedClient = {
            ...clients[index],
            ...changes,
            clientId: clients[index].clientId,
            registrationNumber: clients[index].registrationNumber,
            createdAt: clients[index].createdAt
        };

        clients[index] = updatedClient;
        return clients;
    });

    return updatedClient;
}