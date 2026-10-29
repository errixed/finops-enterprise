import { randomUUID } from "node:crypto";
import {
    findClientById,
    insertClient,
    updateClient,
    searchClients
} from "../repositories/client.repository.js";
import {
    findAccountsByClientId
} from "../repositories/account.repository.js";
import { ENUMS } from "../../config.js";

const INDUSTRIES = ENUMS.CLIENT_INDUSTRIES;
const COUNTRIES = ENUMS.CLIENT_COUNTRIES;
const STATUSES = ENUMS.CLIENT_STATUSES;

function fail(message, statusCode, field) {
    const error = new Error(message);
    error.statusCode = statusCode;

    if (field) {
        error.details = { field };
    }

    throw error;
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateString(value, field, min, max) {
    if (typeof value !== "string") {
        fail(`${field} must be a string`, 400, field);
    }

    const trimmed = value.trim();

    if (trimmed.length < min || trimmed.length > max) {
        fail(
            `${field} must be ${min}-${max} characters`,
            400,
            field
        );
    }

    return trimmed;
}

function validateFields(input, isUpdate = false) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        fail("Invalid client data", 400);
    }

    const allowed = isUpdate
        ? [
            "companyName",
            "industry",
            "country",
            "contactEmail",
            "contactPhone",
            "status"
        ]
        : [
            "companyName",
            "registrationNumber",
            "industry",
            "country",
            "contactEmail",
            "contactPhone"
        ];

    for (const field of Object.keys(input)) {
        if (!allowed.includes(field)) {
            fail(`${field} cannot be modified`, 400, field);
        }
    }

    if (isUpdate && Object.keys(input).length === 0) {
        fail("At least one field must be provided", 400);
    }

    const result = {};

    if (!isUpdate || input.companyName !== undefined) {
        result.companyName = validateString(
            input.companyName,
            "companyName",
            2,
            150
        );
    }

    if (!isUpdate) {
        result.registrationNumber = validateString(
            input.registrationNumber,
            "registrationNumber",
            5,
            30
        );
    }

    if (!isUpdate || input.industry !== undefined) {
        if (!INDUSTRIES.includes(input.industry)) {
            fail("Unsupported industry", 400, "industry");
        }

        result.industry = input.industry;
    }

    if (!isUpdate || input.country !== undefined) {
        if (!COUNTRIES.includes(input.country)) {
            fail("Unsupported country", 400, "country");
        }

        result.country = input.country;
    }

    if (!isUpdate || input.contactEmail !== undefined) {
        const email = validateString(
            input.contactEmail,
            "contactEmail",
            3,
            254
        );

        if (!validateEmail(email)) {
            fail("Invalid contact email", 400, "contactEmail");
        }

        result.contactEmail = email;
    }

    if (!isUpdate || input.contactPhone !== undefined) {
        if (
            input.contactPhone !== null &&
            input.contactPhone !== undefined &&
            typeof input.contactPhone !== "string"
        ) {
            fail("Invalid contact phone", 400, "contactPhone");
        }

        result.contactPhone = validateString(
            input.contactPhone ?? "",
            "contactPhone",
            0,
            30
        );
    }

    if (isUpdate && input.status !== undefined) {
        if (!STATUSES.includes(input.status)) {
            fail("Unsupported status", 400, "status");
        }

        result.status = input.status;
    }

    return result;
}

export async function getAllClients({
    search = "",
    status = "",
    industry = "",
    page = 1,
    pageSize = 10
} = {}) {
    if (status && !STATUSES.includes(status)) {
        fail("Unsupported status filter", 400, "status");
    }

    if (industry && !INDUSTRIES.includes(industry)) {
        fail("Unsupported industry filter", 400, "industry");
    }

    if (typeof search !== "string") {
        fail("Invalid search parameter", 400, "search");
    }

    return searchClients({
        search,
        status,
        industry,
        page,
        pageSize
    });
}

export async function getClientById(clientId) {
    const client = await findClientById(clientId);

    if (!client) {
        fail("Client not found", 404);
    }

    const accounts = await findAccountsByClientId(clientId);

    return {
        ...client,
        accounts
    };
}

export async function createClient(input) {
    const fields = validateFields(input);

    const now = new Date().toISOString();

    const client = {
        clientId: randomUUID(),
        ...fields,
        status: "Active",
        createdAt: now,
        updatedAt: now
    };

    return insertClient(client);
}

export async function modifyClient(clientId, input) {
    const changes = validateFields(input, true);
    const existing = await findClientById(clientId);

    if (!existing) {
        fail("Client not found", 404);
    }

    return updateClient(clientId, {
        ...changes,
        updatedAt: new Date().toISOString()
    });
}

export const CLIENT_OPTIONS = {
    industries: INDUSTRIES,
    countries: COUNTRIES,
    statuses: STATUSES
};
