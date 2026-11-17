import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { GridFSBucket } from "mongodb";
import { getDatabase } from "../config/mongodb.js";
import { findTransactionById } from "../repositories/transaction.repository.js";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

const MIME_TYPES = new Map([
    ["application/pdf", "pdf"],
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "docx"
    ],
    [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx"
    ],
    ["application/msword", "doc"],
    ["application/vnd.ms-excel", "xls"]
]);

function bucket() {
    return new GridFSBucket(getDatabase(), {
        bucketName: "transaction_attachments"
    });
}

function files() {
    return getDatabase().collection("transaction_attachments.files");
}

function fail(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
}

async function transactionOrFail(transactionId) {
    const transaction = await findTransactionById(transactionId);

    if (!transaction) {
        fail("Transaction not found", 404);
    }

    return transaction;
}

function formatFile(file) {
    return {
        documentId: file.metadata.documentId,
        transactionId: file.metadata.transactionId,
        filename: file.filename,
        contentType: file.metadata.contentType,
        size: file.length,
        uploadedAt: file.uploadDate.toISOString(),
        uploadedBy: file.metadata.uploadedBy
    };
}
async function recordDocumentEvent({
    transactionId,
    documentId,
    eventType,
    userId
}) {
    await getDatabase()
        .collection("transaction_document_events")
        .insertOne({
            eventId: randomUUID(),
            transactionId,
            documentId,
            eventType,
            actorId: userId,
            occurredAt: new Date()
        });
}
function safeName(value) {
    const filename = decodeURIComponent(value)
        .split(/[\\/]/)
        .pop()
        ?.replace(/[\x00-\x1f\x7f]/g, "")
        .slice(0, 150)
        .trim();

    if (!filename || filename === "." || filename === "..") {
        fail("Invalid filename");
    }

    return filename;
}

function matchesSignature(contentType, data) {
    if (contentType === "application/pdf") {
        return data.subarray(0, 5).toString("ascii") === "%PDF-";
    }

    if (contentType === "image/png") {
        return data.subarray(0, 8).equals(
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
        );
    }

    if (contentType === "image/jpeg") {
        return data[0] === 0xff &&
            data[1] === 0xd8 &&
            data[2] === 0xff;
    }

    if (
        contentType.includes("openxmlformats-officedocument")
    ) {
        return data.subarray(0, 4).equals(
            Buffer.from([0x50, 0x4b, 0x03, 0x04])
        );
    }

    return data.subarray(0, 8).equals(
        Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    );
}

export async function listTransactionDocuments(req, res, next) {
    try {
        await transactionOrFail(req.params.id);

        const records = await files()
            .find({
                "metadata.transactionId": req.params.id
            })
            .sort({ uploadDate: 1 })
            .toArray();

        res.json({
            data: records.map(formatFile)
        });
    } catch (error) {
        next(error);
    }
}

export async function uploadTransactionDocument(req, res, next) {
    try {
        const transaction = await transactionOrFail(req.params.id);

        if (
            !["Pending"].includes(transaction.status) ||
            ["Approved", "Rejected", "Cancelled"].includes(
                transaction.approvalStatus
            )
        ) {
            fail("Documents can only be added before approval is finalized", 409);
        }

        const contentType = req.get("Content-Type")?.split(";")[0]?.toLowerCase();
        const extension = MIME_TYPES.get(contentType);

        if (!extension) {
            fail("Unsupported file type", 415);
        }

        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
            fail("Upload body is empty");
        }

        if (req.body.length > MAX_BYTES) {
            fail("File exceeds the 10 MB limit", 413);
        }

        if (!matchesSignature(contentType, req.body)) {
            fail("File contents do not match the declared format", 415);
        }

        const filename = safeName(req.get("X-File-Name") || "");
        const suppliedExtension = filename.split(".").pop()?.toLowerCase();

        const acceptedExtensions = extension === "jpg"
            ? ["jpg", "jpeg"]
            : [extension];

        if (!acceptedExtensions.includes(suppliedExtension)) {
            fail("Filename extension does not match its file format", 415);
        }

        const count = await files().countDocuments({
            "metadata.transactionId": req.params.id
        });

        if (count >= MAX_FILES) {
            fail("Maximum five documents per transaction", 409);
        }

        const documentId = randomUUID();

        const upload = bucket().openUploadStream(filename, {
            contentType: "application/octet-stream",
            metadata: {
                documentId,
                transactionId: req.params.id,
                contentType,
                uploadedBy: req.user.userId
            }
        });

        await new Promise((resolve, reject) => {
            const input = Readable.from(req.body);
            input.on("error", reject);
            upload.on("error", reject);
            upload.on("finish", resolve);
            input.pipe(upload);
        });

        const saved = await files().findOne({
            "metadata.documentId": documentId,
            "metadata.transactionId": req.params.id
        });
        await recordDocumentEvent({
            transactionId: req.params.id,
            documentId,
            eventType: "DOCUMENT_UPLOADED",
            userId: req.user.userId
        });

        res.status(201).json({
            data: formatFile(saved)
        });
    } catch (error) {
        next(error);
    }
}

export async function downloadTransactionDocument(req, res, next) {
    try {
        await transactionOrFail(req.params.id);

        const record = await files().findOne({
            "metadata.transactionId": req.params.id,
            "metadata.documentId": req.params.documentId
        });

        if (!record) {
            fail("Document not found", 404);
        }

        const contentType = record.metadata.contentType;
        const preview = req.query.preview === "true";
        await recordDocumentEvent({
            transactionId: req.params.id,
            documentId: req.params.documentId,
            eventType: preview
                ? "DOCUMENT_PREVIEWED"
                : "DOCUMENT_DOWNLOADED",
            userId: req.user.userId
        });
        const inline = preview && [
            "application/pdf",
            "image/png",
            "image/jpeg"
        ].includes(contentType);

        res.set({
            "Content-Type": contentType,
            "Content-Length": String(record.length),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
            "Content-Security-Policy": "sandbox",
            "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="document"`
        });

        const stream = bucket().openDownloadStream(record._id);

        stream.on("error", error => {
            if (!res.headersSent) next(error);
            else res.destroy(error);
        });

        stream.pipe(res);
    } catch (error) {
        next(error);
    }
}

export async function deleteTransactionDocument(req, res, next) {
    try {
        const transaction = await transactionOrFail(req.params.id);

        if (
            transaction.status !== "Pending" ||
            ["Approved", "Rejected", "Cancelled"].includes(
                transaction.approvalStatus
            )
        ) {
            fail("Documents are locked after approval is finalized", 409);
        }

        const record = await files().findOne({
            "metadata.transactionId": req.params.id,
            "metadata.documentId": req.params.documentId
        });

        if (!record) {
            fail("Document not found", 404);
        }

        if (
            record.metadata.uploadedBy !== req.user.userId &&
            !req.user.roles.includes("Administrator")
        ) {
            fail("Only the uploader or administrator may remove this document", 403);
        }

        await bucket().delete(record._id);

        await recordDocumentEvent({
            transactionId: req.params.id,
            documentId: req.params.documentId,
            eventType: "DOCUMENT_DELETED",
            userId: req.user.userId
        });

        res.status(204).end();
    } catch (error) {
        next(error);
    }
}