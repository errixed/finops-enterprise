"use client";

import { useEffect, useRef, useState } from "react";
import {
  type TransactionDocument,
  getTransactionDocuments,
  uploadTransactionDocument,
  openTransactionDocument
} from "@/services/transaction-documents";
import { Icon } from "@/components/ui";

interface Props {
  transactionId: string;
  allowUpload?: boolean;
}

const allowedExtensions = [
  "pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"
];

function formattedSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}

export default function TransactionDocumentsPanel({
  transactionId,
  allowUpload = false
}: Props) {
  const [documents, setDocuments] = useState<TransactionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    getTransactionDocuments(transactionId)
      .then(data => {
        if (active) setDocuments(data);
      })
      .catch(err => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load supporting documents."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [transactionId, refreshKey]);

  async function openDocument(documentId: string, preview: boolean) {
    setError("");
    setOpening(documentId);

    try {
      await openTransactionDocument(
        transactionId,
        documentId,
        preview
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to open the document."
      );
    } finally {
      setOpening(null);
    }
  }

  async function uploadFiles(selected: FileList | null) {
    if (!selected || !selected.length || uploading) return;

    setError("");
    setMessage("");

    const incoming = Array.from(selected);

    if (incoming.length + documents.length > 5) {
      setError("A transaction can have a maximum of five documents.");
      return;
    }

    for (const file of incoming) {
      const extension = file.name.split(".").pop()?.toLowerCase();

      if (!extension || !allowedExtensions.includes(extension)) {
        setError(`Unsupported file type: ${file.name}`);
        return;
      }

      if (file.size === 0 || file.size > 10 * 1024 * 1024) {
        setError(`${file.name} must be between 1 byte and 10 MB.`);
        return;
      }
    }

    setUploading(true);

    try {
      const existing = await getTransactionDocuments(transactionId);
      const remaining = 5 - existing.length;

      if (incoming.length > remaining) {
        setDocuments(existing);
        setError(`Only ${remaining} additional document(s) can be uploaded.`);
        return;
      }

      const successful: TransactionDocument[] = [];
      const failures: string[] = [];

      for (const file of incoming) {
        try {
          const uploaded = await uploadTransactionDocument(
            transactionId,
            file
          );
          successful.push(uploaded);
        } catch (err) {
          failures.push(
            `${file.name}: ${
              err instanceof Error ? err.message : "Upload failed"
            }`
          );
        }
      }

      const updated = await getTransactionDocuments(transactionId);
      setDocuments(updated);

      if (successful.length) {
        setMessage(
          `${successful.length} supporting document(s) uploaded successfully.`
        );
      }

      if (failures.length) {
        setError(failures.join(" | "));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload documents."
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <section className="approval-documents">
      <header className="approval-documents-header">
        <h2>
          <Icon name="description" size={22} />
          Supporting Documents ({documents.length})
        </h2>

        <div className="approval-document-actions">
          {allowUpload && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                multiple
                hidden
                onChange={event =>
                  void uploadFiles(event.target.files)
                }
              />

              <button
                type="button"
                disabled={loading || uploading || documents.length >= 5}
                onClick={() => fileInput.current?.click()}
              >
                <Icon name="upload" size={19} />
                {uploading ? "Uploading..." : "Upload Documents"}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setRefreshKey(value => value + 1)}
            disabled={loading || uploading}
            aria-label="Refresh supporting documents"
            title="Refresh supporting documents"
          >
            <Icon name="refresh" size={20} />
          </button>
        </div>
      </header>

      <div className="approval-documents-body">
        {message && (
          <p role="status" className="tc-context-note">
            {message}
          </p>
        )}

        {error && (
          <p role="alert" className="approval-documents-error">
            {error}
          </p>
        )}

        {loading ? (
          <p>Loading supporting documents...</p>
        ) : documents.length === 0 ? (
          <div className="approval-documents-empty">
            <Icon name="folder_open" size={34} />
            <p>No supporting documents are attached to this transaction.</p>
          </div>
        ) : (
          <div className="approval-documents-table-wrap">
            <table className="approval-documents-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(document => {
                  const previewable = [
                    "application/pdf",
                    "image/jpeg",
                    "image/png"
                  ].includes(document.contentType);

                  return (
                    <tr key={document.documentId}>
                      <td>
                        <div className="approval-document-name">
                          <Icon name="draft" size={21} />
                          <span>{document.filename}</span>
                        </div>
                      </td>

                      <td>{formattedSize(document.size)}</td>

                      <td>
                        {new Date(document.uploadedAt).toLocaleString("en-CA")}
                      </td>

                      <td>
                        <div className="approval-document-actions">
                          {previewable && (
                            <button
                              type="button"
                              disabled={opening === document.documentId}
                              onClick={() => void openDocument(
                                document.documentId,
                                true
                              )}
                            >
                              <Icon name="visibility" size={18} />
                              View
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={opening === document.documentId}
                            onClick={() => void openDocument(
                              document.documentId,
                              false
                            )}
                          >
                            <Icon name="download" size={18} />
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {allowUpload && (
          <p className="tc-context-note">
            Supported: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG.
            Maximum five files, 10 MB each.
            Attachments are stored with this transaction.
          </p>
        )}
      </div>
    </section>
  );
}
