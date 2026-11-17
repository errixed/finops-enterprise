import express from "express";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { GridFSBucket, ObjectId } from "mongodb";
import { getDatabase } from "../config/mongodb.js";
import createOptionsRouter from "./risk-case-create-options.routes.js";

const router = express.Router();
router.use("/create-options", createOptionsRouter);
const STATUSES = ["Open", "In Investigation", "Resolved"];
const LEVELS = ["Low", "Medium", "High", "Critical"];
const PERIODS = ["7", "30", "90", "all"];

const MIME_TYPES = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

function collection() {
    return getDatabase().collection("risk_cases");
}

function events() {
    return getDatabase().collection("risk_case_events");
}

function documents() {
    return getDatabase().collection("risk_case_attachments.files");
}

function bucket() {
    return new GridFSBucket(getDatabase(), {
        bucketName: "risk_case_attachments"
    });
}

function fail(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
}

function clean(value, max = 500) {
    if (typeof value !== "string") {
        fail("A valid text value is required");
    }

    return value.trim().slice(0, max);
}

function actor(req) {
    const value = req.get("X-Actor-Id");

    return typeof value === "string" && value.trim()
        ? value.trim().slice(0, 100)
        : "DEMO-USER";
}

function periodStart(period) {
    if (period === "all") return null;

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - Number(period) + 1);

    return start;
}

function caseId() {
    return `CASE-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function getCaseOrFail(id) {
    const item = await collection().findOne({ caseId: id });

    if (!item) fail("Case not found", 404);

    return item;
}

async function recordEvent(caseIdentifier, action, details, user) {
    await events().insertOne({
        eventId: randomUUID(),
        caseId: caseIdentifier,
        action,
        details,
        actorId: user,
        createdAt: new Date()
    });
}

function averageResolutionDays(rows) {
    const resolved = rows.filter(item =>
        item.resolvedAt && item.createdAt
    );

    if (!resolved.length) return null;

    const total = resolved.reduce((sum, item) => {
        return sum + (
            new Date(item.resolvedAt) - new Date(item.createdAt)
        ) / 86400000;
    }, 0);

    return Number((total / resolved.length).toFixed(1));
}

function safeFileName(value) {
    const name = String(value ?? "")
        .split(/[\\/]/)
        .pop()
        ?.replace(/[\x00-\x1f\x7f]/g, "")
        .trim()
        .slice(0, 150);

    if (!name || name === "." || name === "..") {
        fail("Invalid file name");
    }

    return name;
}

function validSignature(type, buffer) {
    if (type === "application/pdf") {
        return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    }

    if (type === "image/png") {
        return buffer.subarray(0, 8).equals(
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
        );
    }

    if (type === "image/jpeg") {
        return buffer.length >= 3 &&
            buffer[0] === 255 &&
            buffer[1] === 216 &&
            buffer[2] === 255;
    }

    if (type === "text/plain") {
        return !buffer.includes(0);
    }
    if (
        type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
        return buffer.length >= 4 &&
            buffer.subarray(0, 4).equals(
                Buffer.from([80, 75, 3, 4])
            );
    }
    return false;
}

router.get("/summary", async (req, res, next) => {
    try {
        const period = String(req.query.period ?? "30");

        if (!PERIODS.includes(period)) {
            fail("Invalid period");
        }

        const start = periodStart(period);

        const base = start
            ? { createdAt: { $gte: start } }
            : {};

        const current = await collection().find(base).toArray();

        let previous = [];

        if (start) {
            const days = Number(period);
            const earlier = new Date(start);
            earlier.setUTCDate(earlier.getUTCDate() - days);

            previous = await collection().find({
                createdAt: { $gte: earlier, $lt: start }
            }).toArray();
        }

        const count = status =>
            current.filter(item => item.status === status).length;

        const average = averageResolutionDays(current);
        const previousAverage = averageResolutionDays(previous);

        res.json({
            total: current.length,
            open: count("Open"),
            investigating: count("In Investigation"),
            resolved: count("Resolved"),
            averageResolutionDays: average,
            totalChange: previous.length
                ? Number((
                    (current.length - previous.length) /
                    previous.length * 100
                ).toFixed(1))
                : null,
            resolutionChange: average !== null &&
                previousAverage !== null
                ? Number((average - previousAverage).toFixed(1))
                : null
        });
    } catch (error) {
        next(error);
    }
});

router.get("/", async (req, res, next) => {
    try {
        const period = String(req.query.period ?? "30");
        const status = String(req.query.status ?? "");
        const search = String(req.query.search ?? "").trim();
        const page = Number(req.query.page ?? 1);
        const pageSize = Number(req.query.pageSize ?? 8);

        if (
            !PERIODS.includes(period) ||
            (status && !STATUSES.includes(status)) ||
            !Number.isInteger(page) ||
            page < 1 ||
            !Number.isInteger(pageSize) ||
            pageSize < 1 ||
            pageSize > 100 ||
            search.length > 120
        ) {
            fail("Invalid case search parameters");
        }

        const query = {};
        const start = periodStart(period);

        if (start) query.createdAt = { $gte: start };
        if (status) query.status = status;

        if (search) {
            const expression = new RegExp(
                search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "i"
            );

            query.$or = [
                { caseId: expression },
                { subject: expression },
                { clientName: expression },
                { clientId: expression },
                { assignedTo: expression }
            ];
        }

        const [items, total] = await Promise.all([
            collection()
                .find(query)
                .sort({ updatedAt: -1, caseId: 1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .toArray(),
            collection().countDocuments(query)
        ]);

        res.json({
            data: items,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    try {
        const subject = clean(req.body.subject ?? "", 150);
        const description = clean(
            req.body.description ?? req.body.summary ?? "",
            1000
        );
        const initialNote = clean(req.body.initialNote ?? "", 1000);
        const nextAction = clean(req.body.nextAction ?? "", 1000);
        const source = req.body.source ?? "Manual";
        const priority = req.body.priority ?? req.body.riskLevel ?? "Medium";
        const status = req.body.status ?? "Open";
        const assessmentId = clean(req.body.assessmentId ?? "", 100);
        const transactionId = clean(req.body.transactionId ?? "", 100);
        const clientIdInput = clean(req.body.clientId ?? "", 100);
        const assignedTo = clean(req.body.assignedTo ?? "", 120);
        const ruleIds = req.body.triggeringRuleIds ?? [];

        if (!subject) fail("Case subject is required");
        if (!description) fail("Case description is required");

        if (!["Risk Assessment", "Manual", "External Referral"].includes(source)) {
            fail("Invalid case source");
        }

        if (!LEVELS.includes(priority)) {
            fail("Invalid case priority");
        }

        if (!["Open", "In Investigation"].includes(status)) {
            fail("New cases must be Open or In Investigation");
        }

        if (
            !Array.isArray(ruleIds) ||
            ruleIds.length > 50 ||
            ruleIds.some(value =>
                typeof value !== "string" ||
                !/^(RISK-\d{3}|CUSTOM-[\w-]+)$/.test(value)
            )
        ) {
            fail("Invalid triggering rules");
        }

        const uniqueRules = [...new Set(ruleIds)];

        let dueDate = null;

        if (req.body.dueDate) {
            const raw = req.body.dueDate;

            if (
                typeof raw !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(raw)
            ) {
                fail("Invalid due date");
            }

            dueDate = new Date(`${raw}T23:59:59.999Z`);

            if (
                Number.isNaN(dueDate.getTime()) ||
                dueDate.toISOString().slice(0, 10) !== raw
            ) {
                fail("Invalid due date");
            }
        }

        const db = getDatabase();

        let assessment = null;
        let finalTransactionId = transactionId || null;

        if (source === "Risk Assessment") {
            if (!assessmentId) {
                fail("A risk assessment is required for this source");
            }

            assessment = await db.collection("risk_assessments")
                .findOne({ assessmentId });

            if (!assessment) fail("Risk assessment not found", 404);

            if (
                finalTransactionId &&
                finalTransactionId !== assessment.transactionId
            ) {
                fail("Transaction does not belong to the selected assessment");
            }

            finalTransactionId = assessment.transactionId;

            const actualRuleIds = new Set(
                (assessment.triggeredRules ?? []).map(rule => rule.ruleId)
            );

            if (
                uniqueRules.length === 0 ||
                uniqueRules.some(rule => !actualRuleIds.has(rule))
            ) {
                fail("Select valid rules triggered by the assessment");
            }

            if (priority !== assessment.riskLevel) {
                fail("Case priority must match the linked assessment risk level");
            }
        } else if (assessmentId) {
            fail("Assessment ID is only supported for assessment-sourced cases");
        }

        let transaction = null;
        let client = null;

        if (finalTransactionId) {
            transaction = await db.collection("transactions")
                .findOne({ transactionId: finalTransactionId });

            if (!transaction) fail("Transaction not found", 404);

            const account = await db.collection("accounts")
                .findOne({ accountId: transaction.sourceAccountId });

            if (account) {
                client = await db.collection("clients")
                    .findOne({ clientId: account.clientId });
            }
        }

        if (clientIdInput) {
            if (client && client.clientId !== clientIdInput) {
                fail("Client does not match the source account");
            }

            if (!client) {
                client = await db.collection("clients")
                    .findOne({ clientId: clientIdInput });

                if (!client) fail("Client not found", 404);
            }
        }

        if (assignedTo) {
            const actorRecord = await db.collection("workflow_actors")
                .findOne({ actorId: assignedTo });

            if (!actorRecord) {
                fail("Selected assignee does not exist", 404);
            }
        }

        const now = new Date();

        const item = {
            caseId: caseId(),
            subject,
            source,
            assessmentId: assessment?.assessmentId ?? null,
            triggeringRuleIds: uniqueRules,
            priority,
            riskLevel: priority,
            status,
            summary: description,
            description,
            initialNote,
            nextAction,
            clientId: client?.clientId ?? null,
            clientName: client?.companyName ??
                client?.clientName ??
                "Unassigned client",
            transactionId: finalTransactionId,
            assignedTo: assignedTo || null,
            dueDate,
            resolution: null,
            createdAt: now,
            updatedAt: now,
            resolvedAt: null,
            createdBy: actor(req)
        };

        await collection().insertOne(item);

        await recordEvent(
            item.caseId,
            "Case Created",
            `Case opened from ${source}`,
            actor(req)
        );

        if (assignedTo) {
            await recordEvent(
                item.caseId,
                "Case Assigned",
                `Assigned to ${assignedTo}`,
                actor(req)
            );
        }

        if (status === "In Investigation") {
            await recordEvent(
                item.caseId,
                "Investigation Started",
                "Case created with investigation in progress",
                actor(req)
            );
        }

        if (initialNote) {
            await recordEvent(
                item.caseId,
                "Note Added",
                initialNote,
                actor(req)
            );
        }

        res.status(201).json(item);
    } catch (error) {
        next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const item = await getCaseOrFail(req.params.id);
        res.json(item);
    } catch (error) {
        next(error);
    }
});

router.patch("/:id", async (req, res, next) => {
    try {
        const existing = await getCaseOrFail(req.params.id);

        if (existing.status === "Resolved") {
            fail("Resolved cases cannot be edited", 409);
        }

        const changes = {};

        for (const field of [
            "subject",
            "summary",
            "nextAction",
            "assignedTo"
        ]) {
            if (Object.hasOwn(req.body, field)) {
                changes[field] = clean(
                    req.body[field],
                    field === "summary" ? 2000 : 1000
                );
            }
        }

        if (!Object.keys(changes).length &&
            !Object.hasOwn(req.body, "status")) {
            fail("No changes supplied");
        }

        if (Object.hasOwn(req.body, "status")) {
            if (!["Open", "In Investigation"].includes(req.body.status)) {
                fail("Use the resolution action to resolve a case");
            }
            changes.status = req.body.status;
        }

        if (changes.subject === "") {
            fail("Case subject cannot be empty");
        }

        changes.updatedAt = new Date();

        const updated = await collection().findOneAndUpdate(
            {
                caseId: existing.caseId,
                status: { $ne: "Resolved" }
            },
            { $set: changes },
            { returnDocument: "after" }
        );

        if (!updated) fail("Case was modified concurrently", 409);

        await recordEvent(
            existing.caseId,
            "Case Updated",
            Object.keys(changes)
                .filter(key => key !== "updatedAt")
                .join(", "),
            actor(req)
        );

        res.json(updated);
    } catch (error) {
        next(error);
    }
});

router.post("/:id/resolve", async (req, res, next) => {
    try {
        const resolution = clean(req.body.resolution ?? "", 2000);

        if (!resolution) fail("Resolution note is required");

        const now = new Date();

        const updated = await collection().findOneAndUpdate(
            {
                caseId: req.params.id,
                status: { $ne: "Resolved" }
            },
            {
                $set: {
                    status: "Resolved",
                    resolution,
                    resolvedAt: now,
                    updatedAt: now
                }
            },
            { returnDocument: "after" }
        );

        if (!updated) {
            await getCaseOrFail(req.params.id);
            fail("Case is already resolved", 409);
        }

        await recordEvent(
            updated.caseId,
            "Case Resolved",
            resolution,
            actor(req)
        );

        res.json(updated);
    } catch (error) {
        next(error);
    }
});

router.get("/:id/events", async (req, res, next) => {
    try {
        await getCaseOrFail(req.params.id);

        const items = await events()
            .find({ caseId: req.params.id })
            .sort({ createdAt: 1 })
            .toArray();

        res.json(items);
    } catch (error) {
        next(error);
    }
});

router.post("/:id/notes", async (req, res, next) => {
    try {
        const item = await getCaseOrFail(req.params.id);

        if (item.status === "Resolved") {
            fail("Cannot add notes to a resolved case", 409);
        }

        const note = clean(req.body.note ?? "", 2000);

        if (!note) fail("Note cannot be empty");

        await recordEvent(item.caseId, "Note Added", note, actor(req));

        await collection().updateOne(
            { caseId: item.caseId },
            { $set: { updatedAt: new Date() } }
        );

        res.status(201).json({ message: "Note saved" });
    } catch (error) {
        next(error);
    }
});

router.get("/:id/triggers", async (req, res, next) => {
    try {
        const item = await getCaseOrFail(req.params.id);
        const db = getDatabase();

        let assessment = null;

        if (item.assessmentId) {
            assessment = await db.collection("risk_assessments")
                .findOne({ assessmentId: item.assessmentId });
        } else if (item.transactionId && !item.source) {
            assessment = await db.collection("risk_assessments")
                .find({ transactionId: item.transactionId })
                .sort({ assessedAt: -1 })
                .limit(1)
                .next();
        }

        const rules = assessment?.triggeredRules ?? [];

        const selectedRules = item.triggeringRuleIds?.length
            ? rules.filter(rule =>
                item.triggeringRuleIds.includes(rule.ruleId)
            )
            : rules;

        res.json({
            assessment: assessment
                ? {
                    assessmentId: assessment.assessmentId,
                    policyId: assessment.policyId,
                    policyVersion: assessment.policyVersion,
                    riskScore: assessment.riskScore,
                    riskLevel: assessment.riskLevel,
                    assessedAt: assessment.assessedAt
                }
                : null,
            triggeredRules: selectedRules,
            recordedRuleIds: item.triggeringRuleIds ?? []
        });
    } catch (error) {
        next(error);
    }
});

router.get("/:id/documents", async (req, res, next) => {
    try {
        await getCaseOrFail(req.params.id);

        const items = await documents()
            .find({ "metadata.caseId": req.params.id })
            .sort({ uploadDate: -1 })
            .toArray();

        res.json(items.map(file => ({
            documentId: String(file._id),
            filename: file.filename,
            size: file.length,
            contentType: file.metadata.contentType,
            uploadedAt: file.uploadDate,
            uploadedBy: file.metadata.uploadedBy
        })));
    } catch (error) {
        next(error);
    }
});

router.post(
    "/:id/documents",
    express.raw({
        type: [...MIME_TYPES],
        limit: "10mb"
    }),
    async (req, res, next) => {
        try {
            const item = await getCaseOrFail(req.params.id);

            if (item.status === "Resolved") {
                fail("Cannot upload to a resolved case", 409);
            }

            const type = req.get("Content-Type")?.split(";")[0];

            if (!MIME_TYPES.has(type)) {
                fail("Unsupported file format");
            }

            if (!Buffer.isBuffer(req.body) ||
                req.body.length === 0 ||
                req.body.length > 10 * 1024 * 1024 ||
                !validSignature(type, req.body)) {
                fail("Invalid or oversized document");
            }

            let suppliedName;

            try {
                suppliedName = decodeURIComponent(
                    req.get("X-Filename") ?? "document"
                );
            } catch {
                fail("Invalid file name encoding");
            }

            const filename = safeFileName(suppliedName);

            const stream = bucket().openUploadStream(filename, {
                metadata: {
                    caseId: item.caseId,
                    contentType: type,
                    uploadedBy: actor(req)
                }
            });

            await new Promise((resolve, reject) => {
                Readable.from([req.body])
                    .pipe(stream)
                    .on("finish", resolve)
                    .on("error", reject);
            });

            await recordEvent(
                item.caseId,
                "Document Uploaded",
                filename,
                actor(req)
            );

            res.status(201).json({
                documentId: String(stream.id),
                filename
            });
        } catch (error) {
            next(error);
        }
    }
);

router.get("/:id/documents/:documentId", async (req, res, next) => {
    try {
        await getCaseOrFail(req.params.id);

        if (!ObjectId.isValid(req.params.documentId)) {
            fail("Invalid document identifier");
        }

        const id = new ObjectId(req.params.documentId);

        const file = await documents().findOne({
            _id: id,
            "metadata.caseId": req.params.id
        });

        if (!file) fail("Document not found", 404);

        res.setHeader("Content-Type", file.metadata.contentType);
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${safeFileName(file.filename)
                .replace(/"/g, "")}"`
        );
        res.setHeader("X-Content-Type-Options", "nosniff");

        bucket().openDownloadStream(id).pipe(res);
    } catch (error) {
        next(error);
    }
});

router.delete("/:id/documents/:documentId", async (req, res, next) => {
    try {
        const item = await getCaseOrFail(req.params.id);

        if (item.status === "Resolved") {
            fail("Cannot delete documents from a resolved case", 409);
        }

        if (!ObjectId.isValid(req.params.documentId)) {
            fail("Invalid document identifier");
        }

        const id = new ObjectId(req.params.documentId);

        const file = await documents().findOne({
            _id: id,
            "metadata.caseId": item.caseId
        });

        if (!file) fail("Document not found", 404);

        await bucket().delete(id);

        await recordEvent(
            item.caseId,
            "Document Deleted",
            file.filename,
            actor(req)
        );

        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

export default router;