import { getAllClients } from "../services/client.service.js";

export async function getClients(req, res, next) {
    try {
        const clients = await getAllClients();

        res.status(200).json(clients);
    } catch (error) {
        next(error);
    }
}