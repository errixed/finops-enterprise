import { API_BASE_URL, API_ROUTES } from "../../config";

export interface TransactionDocument {
    documentId: string;
    transactionId: string;
    filename: string;
    contentType: string;
    size: number;
    uploadedAt: string;
    uploadedBy: string;
}

function endpoint(transactionId: string) {
    return `${API_BASE_URL}${API_ROUTES.transactions}/${encodeURIComponent(transactionId)}/documents`;
}

async function assertResponse(response: Response) {
    if (response.ok) return;

    const body = await response.json().catch(() => null);

    throw new Error(
        body?.error?.message ??
        `Document request failed (HTTP ${response.status})`
    );
}

export async function getTransactionDocuments(
    transactionId: string
): Promise<TransactionDocument[]> {
    const response = await fetch(endpoint(transactionId), {
        credentials: "include",
        cache: "no-store"
    });

    await assertResponse(response);

    const result = await response.json();
    return result.data as TransactionDocument[];
}

export async function uploadTransactionDocument(
    transactionId: string,
    file: File
): Promise<TransactionDocument> {
    const response = await fetch(endpoint(transactionId), {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": file.type,
            "X-File-Name": encodeURIComponent(file.name)
        },
        body: file
    });

    await assertResponse(response);

    const result = await response.json();
    return result.data as TransactionDocument;
}

export async function deleteTransactionDocument(
    transactionId: string,
    documentId: string
): Promise<void> {
    const response = await fetch(
        `${endpoint(transactionId)}/${encodeURIComponent(documentId)}`,
        {
            method: "DELETE",
            credentials: "include"
        }
    );

    await assertResponse(response);
}

export async function openTransactionDocument(
    transactionId: string,
    documentId: string,
    preview = false
): Promise<void> {
    const previewWindow = preview
        ? window.open("about:blank", "_blank")
        : null;

    try {
        const documents = await getTransactionDocuments(transactionId);
        const selectedDocument = documents.find(
            item => item.documentId === documentId
        );

        if (!selectedDocument) {
            throw new Error("Document not found.");
        }

        const url = `${endpoint(transactionId)}/${encodeURIComponent(documentId)}${preview ? "?preview=true" : ""}`;

        const response = await fetch(url, {
            credentials: "include",
            cache: "no-store"
        });

        await assertResponse(response);

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        if (preview) {
            if (previewWindow) {
                previewWindow.opener = null;
                previewWindow.location.href = objectUrl;
            } else {
                const anchor = document.createElement("a");
                anchor.href = objectUrl;
                anchor.target = "_blank";
                anchor.rel = "noopener noreferrer";
                anchor.click();
            }
        } else {
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = selectedDocument.filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        }

        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
        previewWindow?.close();
        throw error;
    }
}
