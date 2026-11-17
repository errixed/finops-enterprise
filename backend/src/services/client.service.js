import { randomUUID } from "node:crypto";
import {
    findClientById,
    insertClient,
    updateClient,
    searchClients,
    getClientDirectoryStatistics
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



    const additionalFields = [
        "operatingName",
        "incorporationDate",
        "currency",
        "organizationSize",
        "businessAddress",
        "city",
        "provinceState",
        "postalCode",
        "website",
        "riskRating",
        "complianceCategory",
        "kycStatus",
        "checklist",
        "contacts"
    ];

    const allowed = isUpdate
        ? [
            "companyName",
            "industry",
            "country",
            "contactEmail",
            "contactPhone",
            "status",
            "clientType",
            "relationshipManager",
            "nextReviewAt",
            ...additionalFields
        ]
        : [
            "companyName",
            "registrationNumber",
            "industry",
            "country",
            "contactEmail",
            "contactPhone",
            "clientType",
            "relationshipManager",
            "nextReviewAt",
            ...additionalFields
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

    if (input.clientType !== undefined) {
        if (!["Corporate", "Individual"].includes(input.clientType)) {
            fail("Invalid client type", 400, "clientType");
        }

        result.clientType = input.clientType;
    } else if (!isUpdate) {
        result.clientType = "Corporate";
    }

    if (input.relationshipManager !== undefined) {
        if (input.relationshipManager === null ||
            input.relationshipManager === "") {
            result.relationshipManager = null;
        } else {
            result.relationshipManager = validateString(
                input.relationshipManager,
                "relationshipManager",
                2,
                100
            );
        }
    }

    if (input.nextReviewAt !== undefined) {
        if (input.nextReviewAt === null ||
            input.nextReviewAt === "") {
            result.nextReviewAt = null;
        } else {
            const date = new Date(input.nextReviewAt);

            if (Number.isNaN(date.getTime())) {
                fail("Invalid review date", 400, "nextReviewAt");
            }

            result.nextReviewAt = date.toISOString();
        }
    }

    for (const field of [
        "operatingName",
        "organizationSize",
        "businessAddress",
        "city",
        "provinceState",
        "postalCode",
        "website"
    ]) {
        if (input[field] !== undefined) {
            result[field] = validateString(
                input[field],
                field,
                0,
                field === "website" ? 500 : 200
            );
        }
    }

    if (input.incorporationDate !== undefined) {
        const value = input.incorporationDate;

        if (value === "") {
            result.incorporationDate = null;
        } else {
            if (
                typeof value !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
                Number.isNaN(Date.parse(`${value}T00:00:00Z`))
            ) {
                fail("Invalid incorporation date", 400, "incorporationDate");
            }

            result.incorporationDate = value;
        }
    }

    if (input.currency !== undefined) {
        if (!["CAD", "USD"].includes(input.currency)) {
            fail("Unsupported currency", 400, "currency");
        }

        result.currency = input.currency;
    }

    if (input.riskRating !== undefined) {
        if (!["Low", "Medium", "High", "Critical"]
            .includes(input.riskRating)) {
            fail("Invalid initial risk rating", 400, "riskRating");
        }

        result.riskRating = input.riskRating;
    }

    if (input.complianceCategory !== undefined) {
        if (!["Standard", "Enhanced", "Restricted"]
            .includes(input.complianceCategory)) {
            fail("Invalid compliance category", 400, "complianceCategory");
        }

        result.complianceCategory = input.complianceCategory;
    }

    if (input.kycStatus !== undefined) {
        if (![
            "Not Started",
            "In Progress",
            "Pending Review",
            "Verified",
            "Rejected"
        ].includes(input.kycStatus)) {
            fail("Invalid KYC status", 400, "kycStatus");
        }

        result.kycStatus = input.kycStatus;
    }

    if (input.checklist !== undefined) {
        const validItems = [
            "Government ID / Incorporation Documents",
            "Proof of Address",
            "Beneficial Ownership (if applicable)",
            "Sanctions & PEP Screening",
            "Compliance Review"
        ];

        if (
            !Array.isArray(input.checklist) ||
            input.checklist.some(item => !validItems.includes(item)) ||
            new Set(input.checklist).size !== input.checklist.length
        ) {
            fail("Invalid compliance checklist", 400, "checklist");
        }

        result.checklist = input.checklist;
    }

    if (input.contacts !== undefined) {
        if (
            !Array.isArray(input.contacts) ||
            input.contacts.length > 50
        ) {
            fail("Invalid contact list", 400, "contacts");
        }

        result.contacts = input.contacts.map(contact => {
            if (
                !contact ||
                typeof contact !== "object" ||
                Array.isArray(contact)
            ) {
                fail("Invalid contact", 400, "contacts");
            }

            const email = validateString(
                contact.email ?? "",
                "contact.email",
                0,
                254
            );

            if (email && !validateEmail(email)) {
                fail("Invalid contact email", 400, "contacts");
            }

            return {
                id: validateString(contact.id, "contact.id", 1, 100),
                name: validateString(contact.name, "contact.name", 2, 150),
                role: validateString(contact.role, "contact.role", 2, 100),
                email,
                phone: validateString(
                    contact.phone ?? "",
                    "contact.phone",
                    0,
                    30
                ),
                primary: contact.primary === true
            };
        });

        if (
            result.contacts.length > 0 &&
            result.contacts.filter(contact => contact.primary).length !== 1
        ) {
            fail(
                "Exactly one primary contact is required",
                400,
                "contacts"
            );
        }

        if (
            new Set(result.contacts.map(contact => contact.id)).size !==
            result.contacts.length
        ) {
            fail("Duplicate contact ID", 400, "contacts");
        }
    }

    return result;
}

export async function getAllClients({
    search = "",
    status = "",
    industry = "",
    country = "",
    page = 1,
    pageSize = 10,
    clientType = "",
    relationshipManager = "",
    dateFrom = "",
    dateTo = "",
} = {}) {
    if (status && !STATUSES.includes(status)) {
        fail("Unsupported status filter", 400, "status");
    }

    if (industry && !INDUSTRIES.includes(industry)) {
        fail("Unsupported industry filter", 400, "industry");
    }

    if (country && !COUNTRIES.includes(country)) {
        fail("Unsupported country filter", 400, "country");
    }

    if (typeof search !== "string") {
        fail("Invalid search parameter", 400, "search");
    }

    if (clientType &&
        !["Corporate", "Individual"].includes(clientType)) {
        fail("Invalid client type filter", 400, "clientType");
    }

    if (relationshipManager &&
        (typeof relationshipManager !== "string" ||
            relationshipManager.length > 100)) {
        fail("Invalid relationship manager", 400, "relationshipManager");
    }

    for (const [field, value] of [
        ["dateFrom", dateFrom],
        ["dateTo", dateTo]
    ]) {
        if (value && (
            typeof value !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
            !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
        )) {
            fail(`Invalid ${field}`, 400, field);
        }
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
        fail("Start date must precede end date", 400);
    }

    return searchClients({
        search,
        status,
        industry,
        country,
        clientType,
        relationshipManager,
        dateFrom,
        dateTo,
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

export async function getClientAccountsById(clientId) {
    const client = await findClientById(clientId);

    if (!client) {
        fail("Client not found", 404);
    }

    return findAccountsByClientId(clientId);
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


export const CLIENT_TYPES = ["Corporate", "Individual"];

export const CLIENT_OPTIONS = {
    industries: INDUSTRIES,
    countries: COUNTRIES,
    statuses: STATUSES,
    clientTypes: CLIENT_TYPES
};

export async function getClientDirectorySummary() {
    return getClientDirectoryStatistics();
}