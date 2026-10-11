import {
    getAllClients,
    getClientById,
    createClient,
    modifyClient,
    CLIENT_OPTIONS
} from "../services/client.service.js";

export async function getClients(req, res, next) {
    try {
        const result = await getAllClients(req.query);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

export async function getClient(req, res, next) {
    try {
        const client = await getClientById(req.params.id);
        res.status(200).json(client);
    } catch (error) {
        next(error);
    }
}

export async function registerClient(req, res, next) {
    try {
        const client = await createClient(req.body);
        res.status(201).json(client);
    } catch (error) {
        next(error);
    }
}

export async function editClient(req, res, next) {
    try {
        const client = await modifyClient(
            req.params.id,
            req.body
        );

        res.status(200).json(client);
    } catch (error) {
        next(error);
    }
}

export function getClientOptions(req, res) {
    res.status(200).json(CLIENT_OPTIONS);
}