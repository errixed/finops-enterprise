import {
    getAllClients,
    getClientById,
    getClientAccountsById,
    createClient,
    modifyClient,
    CLIENT_OPTIONS,
    getClientDirectorySummary
} from "../services/client.service.js";
import {
    getClientOperationalReport,
    getClientDirectoryMetrics
} from "../repositories/client-directory.repository.js";
import { getCollection, escapeRegex } from "../repositories/mongodb.repository.js";
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

export async function getClientAccounts(req, res, next) {
    try {
        const accounts = await getClientAccountsById(
            req.params.id
        );

        res.status(200).json(accounts);
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
export async function getDirectorySummary(req, res, next) {
    try {
        const result = await getClientDirectorySummary();
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}


export async function getClientReport(req, res, next) {
    try {
        const client = await getClientById(req.params.id);

        const report = await getClientOperationalReport(
            client.clientId
        );

        res.status(200).json({
            client,
            report
        });
    } catch (error) {
        next(error);
    }
}

export async function getDirectoryMetrics(req, res, next) {
    try {
        const metrics = await getClientDirectoryMetrics();
        res.status(200).json(metrics);
    } catch (error) {
        next(error);
    }
}

export async function exportClients(req, res, next) {
    try {
        const {
            search = "",
            status = "",
            industry = "",
            country = "",
            clientType = "",
            relationshipManager = "",
            dateFrom = "",
            dateTo = ""
        } = req.query;

        const filter = {};

        if (status) filter.status = status;
        if (industry) filter.industry = industry;
        if (country) filter.country = country;
        if (clientType) filter.clientType = clientType;
        if (relationshipManager) {
            filter.relationshipManager = relationshipManager;
        }

        if (search) {
            const regex = {
                $regex: escapeRegex(String(search)),
                $options: "i"
            };

            filter.$or = [
                { clientId: regex },
                { companyName: regex },
                { registrationNumber: regex }
            ];
        }

        if (dateFrom || dateTo) {
            filter.createdAt = {};

            if (dateFrom) {
                filter.createdAt.$gte =
                    new Date(`${dateFrom}T00:00:00.000Z`);
            }

            if (dateTo) {
                filter.createdAt.$lt = new Date(
                    Date.parse(`${dateTo}T00:00:00.000Z`) + 86400000
                );
            }
        }

        const headers = [
            "Client ID",
            "Client Name",
            "Registration Number",
            "Client Type",
            "Industry",
            "Country",
            "Relationship Manager",
            "Status",
            "Email",
            "Phone",
            "Created At"
        ];

        const csvCell = value => {
            let text = String(value ?? "");

            if (/^[=+\-@\t\r]/.test(text)) {
                text = `'${text}`;
            }

            return `"${text.replaceAll('"', '""')}"`;
        };

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="finops-clients.csv"'
        );

        res.write("\uFEFF");
        res.write(headers.map(csvCell).join(",") + "\r\n");

        const cursor = getCollection("clients")
            .find(filter)
            .sort({ createdAt: -1 });

        for await (const client of cursor) {
            const row = [
                client.clientId,
                client.companyName,
                client.registrationNumber,
                client.clientType,
                client.industry,
                client.country,
                client.relationshipManager,
                client.status,
                client.contactEmail,
                client.contactPhone,
                client.createdAt?.toISOString?.() ??
                    client.createdAt
            ];

            res.write(row.map(csvCell).join(",") + "\r\n");
        }

        res.end();
    } catch (error) {
        if (res.headersSent) {
            res.destroy(error);
        } else {
            next(error);
        }
    }
}
