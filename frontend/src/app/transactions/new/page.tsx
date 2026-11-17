"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    type Account,
    getAccounts,
    formatMoney,
    parseMoney
} from "@/services/accounts";
import { type Client, getClients } from "@/services/clients";
import {
    type TransactionInput,
    type TransactionRiskPreview,
    initiateTransaction,
    previewTransaction
} from "@/services/transactions";
import { ROUTES } from "../../../../config";
import { Icon } from "@/components/ui";
import "../../accounts/new/create-account.css";
import "./create-transaction.css";
import {
    uploadTransactionDocument
} from "@/services/transaction-documents";

type Step = 1 | 2 | 3 | 4;

type FormData = {
    sourceAccountId: string;
    destinationAccountId: string;
    purpose: string;
    amount: string;
    date: string;
    reference: string;
    description: string;
};

const STEPS = [
    "Transaction Details",
    "Risk & Approval",
    "Documents",
    "Review & Submit"
] as const;

const PURPOSES = [
    "Supplier Payment",
    "Client Payment",
    "Invoice Payment",
    "Payroll",
    "Operating Expense",
    "Intercompany Transfer",
    "Other"
];

const ALLOWED_EXTENSIONS = [
    "pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"
];

function today() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function moneyInput(value: string) {
    try {
        return (parseMoney(value.replaceAll(",", "")) / 100).toLocaleString(
            "en-CA",
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        );
    } catch {
        return value;
    }
}

function Panel({
    title,
    icon,
    children
}: {
    title: string;
    icon: string;
    children: React.ReactNode;
}) {
    return (
        <section className="acw-panel">
            <header className="acw-panel-header">
                <Icon name={icon} size={23} />
                <h2>{title}</h2>
            </header>
            <div className="acw-panel-body">{children}</div>
        </section>
    );
}

function Row({
    label,
    children
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="acw-summary-row">
            <span>{label}</span>
            <strong>{children}</strong>
        </div>
    );
}

function Info({
    title,
    children,
    success = false
}: {
    title: string;
    children: React.ReactNode;
    success?: boolean;
}) {
    return (
        <div className={`tc-info ${success ? "tc-info-success" : ""}`}>
            <Icon name={success ? "check_circle" : "info"} size={26} />
            <div>
                <strong>{title}</strong>
                <div>{children}</div>
            </div>
        </div>
    );
}

function fileSize(size: number) {
    return size >= 1048576
        ? `${(size / 1048576).toFixed(2)} MB`
        : `${Math.ceil(size / 1024)} KB`;
}

export default function CreateTransactionPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>(1);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [riskLoading, setRiskLoading] = useState(false);
    const [risk, setRisk] = useState<TransactionRiskPreview | null>(null);
    const [error, setError] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);
    const [form, setForm] = useState<FormData>({
        sourceAccountId: "",
        destinationAccountId: "",
        purpose: "",
        amount: "",
        date: today(),
        reference: "",
        description: ""
    });

    const fileInput = useRef<HTMLInputElement>(null);
    const idempotencyKey = useRef<string | null>(null);
    const submitting = useRef(false);

    useEffect(() => {
        let active = true;

        async function load() {
            try {
                const [accountResult, clientFirst] = await Promise.all([
                    getAccounts(),
                    getClients({ page: 1, pageSize: 100 })
                ]);

                const allClients = [...clientFirst.data];

                for (
                    let page = 2;
                    page <= clientFirst.pagination.totalPages;
                    page++
                ) {
                    const result = await getClients({ page, pageSize: 100 });
                    allClients.push(...result.data);
                }

                if (active) {
                    setAccounts(accountResult);
                    setClients(allClients);
                }
            } catch (err) {
                if (active) {
                    setError(err instanceof Error ? err.message : "Unable to load data.");
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        void load();
        return () => { active = false; };
    }, []);

    const source = useMemo(
        () => accounts.find(a => a.accountId === form.sourceAccountId),
        [accounts, form.sourceAccountId]
    );

    const destination = useMemo(
        () => accounts.find(a => a.accountId === form.destinationAccountId),
        [accounts, form.destinationAccountId]
    );

    const sourceClient = useMemo(
        () => clients.find(c => c.clientId === source?.clientId),
        [clients, source]
    );

    const destinationClient = useMemo(
        () => clients.find(c => c.clientId === destination?.clientId),
        [clients, destination]
    );

    const amountMinor = useMemo(() => {
        try {
            return parseMoney(form.amount.replaceAll(",", ""));
        } catch {
            return null;
        }
    }, [form.amount]);

    const formError = useMemo(() => {
        if (!source) return "Select a source account.";
        if (!destination) return "Select a destination account.";
        if (source.accountId === destination.accountId) {
            return "Source and destination accounts must be different.";
        }
        if (source.status !== "Active" || destination.status !== "Active") {
            return "Both accounts must be active.";
        }
        if (source.currency !== destination.currency) {
            return "Both accounts must use the same currency.";
        }
        if (amountMinor === null || amountMinor <= 0) {
            return "Enter a positive, valid amount.";
        }
        if (amountMinor > source.balanceMinor) {
            return "Amount exceeds the available account balance.";
        }
        if (!form.purpose) return "Select a transaction purpose.";
        if (!form.date) return "Select a transaction date.";
        if (!form.description.trim()) return "Enter a description.";
        if (form.description.length > 250) {
            return "Description cannot exceed 250 characters.";
        }
        return "";
    }, [source, destination, amountMinor, form]);

    function update<K extends keyof FormData>(key: K, value: FormData[K]) {
        setForm(previous => {
            const next = { ...previous, [key]: value };

            if (key === "sourceAccountId") {
                const account = accounts.find(a => a.accountId === value);
                const target = accounts.find(
                    a => a.accountId === previous.destinationAccountId
                );

                if (account && target && account.currency !== target.currency) {
                    next.destinationAccountId = "";
                }
            }

            return next;
        });
        setRisk(null);
        setError("");
        idempotencyKey.current = null;
    }

    function buildInput(): TransactionInput | null {
        if (formError || !source || !destination || amountMinor === null) {
            return null;
        }

        return {
            sourceAccountId: source.accountId,
            destinationAccountId: destination.accountId,
            amountMinor,
            currency: source.currency,
            description: form.description.trim()
        };
    }

    async function next() {
        setError("");

        if (step === 1) {
            const input = buildInput();

            if (!input) {
                setError(formError || "Complete the transaction details.");
                return;
            }

            setRiskLoading(true);

            try {
                const preview = await previewTransaction(input);
                setRisk(preview);
                setStep(2);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to evaluate transaction risk."
                );
            } finally {
                setRiskLoading(false);
            }
            return;
        }

        if (step === 2 && !risk) {
            setError("A risk assessment preview is required.");
            return;
        }

        if (step < 4) setStep((step + 1) as Step);
    }

    function addFiles(input: FileList | File[]) {
        const additions = Array.from(input);
        const current = [...files];

        for (const file of additions) {
            const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

            if (!ALLOWED_EXTENSIONS.includes(extension)) {
                setError(`Unsupported file type: ${file.name}`);
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                setError(`${file.name} exceeds the 10 MB limit.`);
                return;
            }

            if (current.length >= 5) {
                setError("A maximum of five supporting files is allowed.");
                return;
            }

            if (!current.some(
                existing =>
                    existing.name === file.name &&
                    existing.size === file.size &&
                    existing.lastModified === file.lastModified
            )) {
                current.push(file);
            }
        }

        setFiles(current);
        setError("");
    }

    function downloadLocal(file: File) {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    async function submit() {
        if (submitting.current || saving) return;

        const input = buildInput();

        if (!input || !risk) {
            setError("Transaction details and risk preview are required.");
            return;
        }

        submitting.current = true;
        setSaving(true);
        setError("");

        try {
            if (!idempotencyKey.current) {
                idempotencyKey.current = crypto.randomUUID();
            }

            const transaction = await initiateTransaction(
                input,
                idempotencyKey.current
            );

            const failed: string[] = [];

            for (const file of files) {
                try {
                    await uploadTransactionDocument(
                        transaction.transactionId,
                        file
                    );
                } catch (err) {
                    failed.push(
                        `${file.name}: ${err instanceof Error ? err.message : "Unknown upload error"
                        }`
                    );
                }
            }

            if (failed.length) {
                setError(
                    `Transaction ${transaction.referenceNumber} was created, but ${failed.length} document(s) could not be uploaded: ${failed.join(", ")}. Do not create another transaction. Open its details and complete the attachment process when document access is available.`
                );
                return;
            }

            router.push(
                ROUTES.transactionDetails(transaction.transactionId)
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Transaction submission failed."
            );
        } finally {
            submitting.current = false;
            setSaving(false);
        }
    }

    const accountDisplay = (account?: Account) =>
        account
            ? `${account.accountNumber}${account.accountName ? ` — ${account.accountName}` : ""}`
            : "Not selected";

    const totalAmount =
        amountMinor !== null && source
            ? formatMoney(amountMinor, source.currency)
            : "—";

    const fileRows = (
        <div className="tc-file-table-wrap">
            <table className="tc-file-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>File Name</th>
                        <th>Type</th>
                        <th>Size</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {files.map((file, index) => (
                        <tr key={`${file.name}-${file.lastModified}`}>
                            <td>{index + 1}</td>
                            <td>{file.name}</td>
                            <td>{file.name.split(".").pop()?.toUpperCase()}</td>
                            <td>{fileSize(file.size)}</td>
                            <td className="tc-file-actions">
                                <button
                                    type="button"
                                    title="Download staged file"
                                    onClick={() => downloadLocal(file)}
                                >
                                    <Icon name="download" size={19} />
                                </button>
                                <button
                                    type="button"
                                    title="Remove file"
                                    onClick={() => setFiles(current =>
                                        current.filter((_, item) => item !== index)
                                    )}
                                >
                                    <Icon name="delete" size={19} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="acw-page tc-create-page">
            <div className="tc-breadcrumb">
                <Link href={ROUTES.transactions}>Transactions</Link>
                <Icon name="chevron_right" size={18} />
                <span>Create Transaction</span>
            </div>

            <div className="acw-title">
                <Icon name="swap_horiz" size={35} />
                <div>
                    <h1>Create Transaction</h1>
                    <p>Initiate a funds transfer with risk assessment and approval workflow.</p>
                </div>
            </div>

            <nav className="acw-steps" aria-label="Transaction creation steps">
                {STEPS.map((label, index) => {
                    const number = (index + 1) as Step;

                    return (
                        <div className="acw-step-wrap" key={label}>
                            {index > 0 && <Icon name="arrow_forward" size={20} />}
                            <button
                                type="button"
                                className={step === number ? "active" : ""}
                                aria-current={step === number ? "step" : undefined}
                                onClick={() => {
                                    if (number <= step) {
                                        setError("");
                                        setStep(number);
                                    }
                                }}
                            >
                                <span className="acw-step-number">
                                    {number < step ? <Icon name="check" size={16} /> : number}
                                </span>
                                <span>{label}</span>
                            </button>
                        </div>
                    );
                })}
            </nav>

            {error && (
                <div className="tc-error" role="alert">
                    <Icon name="error" size={20} />
                    {error}
                </div>
            )}

            {step === 1 && (
                <div className="tc-two-columns">
                    <Panel title="Transaction Details" icon="description">
                        <div className="tc-field-grid">
                            <label className="tc-field">
                                <span>Transaction Type <em>*</em></span>
                                <select value="Transfer" disabled>
                                    <option>Transfer</option>
                                </select>
                            </label>

                            <label className="tc-field">
                                <span>Transaction Purpose <em>*</em></span>
                                <select
                                    value={form.purpose}
                                    onChange={e => update("purpose", e.target.value)}
                                >
                                    <option value="">Select purpose</option>
                                    {PURPOSES.map(purpose => (
                                        <option key={purpose}>{purpose}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="tc-field">
                                <span>From Account (Source) <em>*</em></span>
                                <select
                                    disabled={loading}
                                    value={form.sourceAccountId}
                                    onChange={e => update("sourceAccountId", e.target.value)}
                                >
                                    <option value="">Select source account</option>
                                    {accounts.filter(a => a.status === "Active").map(account => (
                                        <option key={account.accountId} value={account.accountId}>
                                            {accountDisplay(account)} ({account.currency})
                                        </option>
                                    ))}
                                </select>
                                {source && (
                                    <small className="tc-context-note">
                                        Available Balance: {formatMoney(
                                            source.balanceMinor, source.currency
                                        )}
                                    </small>
                                )}
                            </label>

                            <label className="tc-field">
                                <span>To Account (Destination) <em>*</em></span>
                                <select
                                    disabled={loading}
                                    value={form.destinationAccountId}
                                    onChange={e => update("destinationAccountId", e.target.value)}
                                >
                                    <option value="">Select destination account</option>
                                    {accounts.filter(a =>
                                        a.status === "Active" &&
                                        a.accountId !== source?.accountId &&
                                        (!source || a.currency === source.currency)
                                    ).map(account => (
                                        <option key={account.accountId} value={account.accountId}>
                                            {accountDisplay(account)} ({account.currency})
                                        </option>
                                    ))}
                                </select>
                                {destination && (
                                    <small className="tc-context-note">
                                        Account Holder: {destinationClient?.companyName ?? "—"}
                                    </small>
                                )}
                            </label>

                            <label className="tc-field">
                                <span>Amount <em>*</em></span>
                                <input
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={form.amount}
                                    onChange={e => update("amount", e.target.value)}
                                    onBlur={() => {
                                        if (amountMinor !== null) {
                                            setForm(current => ({
                                                ...current,
                                                amount: moneyInput(current.amount)
                                            }));
                                        }
                                    }}
                                />
                            </label>

                            <label className="tc-field">
                                <span>Currency <em>*</em></span>
                                <select disabled value={source?.currency ?? ""}>
                                    <option value="">Select source account</option>
                                    {source && (
                                        <option value={source.currency}>{source.currency}</option>
                                    )}
                                </select>
                            </label>

                            <label className="tc-field">
                                <span>Transaction Date <em>*</em></span>
                                <input
                                    type="date"
                                    value={form.date}
                                    max={today()}
                                    onChange={e => update("date", e.target.value)}
                                />
                            </label>

                            <label className="tc-field">
                                <span>Reference Number</span>
                                <input
                                    value={form.reference}
                                    maxLength={80}
                                    placeholder="Invoice or business reference"
                                    onChange={e => update("reference", e.target.value)}
                                />
                            </label>

                            <label className="tc-field tc-full">
                                <span>Description <em>*</em></span>
                                <textarea
                                    value={form.description}
                                    maxLength={250}
                                    rows={4}
                                    onChange={e => update("description", e.target.value)}
                                />
                                <small className="tc-count">
                                    {form.description.length} / 250
                                </small>
                            </label>
                        </div>
                    </Panel>

                    <aside className="tc-side">
                        <Panel title="Client & Account Context" icon="groups">
                            {sourceClient ? (
                                <div className="tc-client-context">
                                    <strong>{sourceClient.companyName}</strong>
                                    <Row label="Industry">{sourceClient.industry || "—"}</Row>
                                    <Row label="Country">{sourceClient.country || "—"}</Row>
                                </div>
                            ) : (
                                <p>Select a source account to view its client.</p>
                            )}
                        </Panel>

                        <Panel title="Transaction Summary" icon="monitoring">
                            <Row label="Transfer Amount">{totalAmount}</Row>
                            <Row label="From Account">{accountDisplay(source)}</Row>
                            <Row label="To Account">{accountDisplay(destination)}</Row>
                            <Row label="Purpose">{form.purpose || "—"}</Row>
                        </Panel>

                        <Info title="Important">
                            Risk evaluation and approval requirements are determined
                            automatically using active backend policies.
                        </Info>
                    </aside>
                </div>
            )}

            {step === 2 && (
                <div className="tc-two-columns tc-equal-columns">
                    <Panel title="Risk Assessment" icon="shield">
                        {risk ? (
                            <>
                                <div className="tc-risk-overview">
                                    <div>
                                        <span>Risk Level</span>
                                        <strong className={`tc-risk-${risk.riskLevel.toLowerCase()}`}>
                                            {risk.riskLevel}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Risk Score</span>
                                        <strong>{risk.riskScore} / 100</strong>
                                    </div>
                                    <div>
                                        <span>Risk Category</span>
                                        <strong>{risk.approvalRequired
                                            ? "Approval Required"
                                            : "No Approval Required"}</strong>
                                    </div>
                                </div>

                                <h3>Risk Factors (Triggered Rules)</h3>
                                <table className="tc-file-table">
                                    <thead>
                                        <tr>
                                            <th>Rule</th>
                                            <th>Reason</th>
                                            <th>Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {risk.triggeredRules.length ? (
                                            risk.triggeredRules.map((rule, index) => (
                                                <tr key={`${rule.ruleId}-${index}`}>
                                                    <td>{rule.ruleId}</td>
                                                    <td>{rule.reason}</td>
                                                    <td>+{rule.points}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={3}>No rules triggered.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                <Info title="Provisional Risk Assessment">
                                    This is a preview based on current policy and activity.
                                    Risk will be calculated again upon submission.
                                </Info>
                            </>
                        ) : (
                            <p>Complete transaction details to request a risk preview.</p>
                        )}
                    </Panel>

                    <div className="tc-side">
                        <Panel title="Approval Workflow" icon="account_tree">
                            {risk && (
                                <>
                                    <div className="tc-approval-stages">
                                        <div>Submitted</div>
                                        {risk.requiredRoles.map((role, index) => (
                                            <div key={`${role}-${index}`}>{role}</div>
                                        ))}
                                        <div>Final Approval</div>
                                    </div>

                                    <h3>Workflow Details</h3>
                                    <Row label="Approval Route">
                                        {risk.requiredRoles.length
                                            ? risk.requiredRoles.join(" → ")
                                            : "No manual approvals"}
                                    </Row>
                                    <Row label="Required Approvals">
                                        {risk.requiredRoles.length}
                                    </Row>
                                    <Row label="Current Status">
                                        Not submitted
                                    </Row>
                                </>
                            )}
                        </Panel>

                        <Info title="Next Step">
                            The approval workflow is created when you submit the
                            transaction. Required reviewers will act according to
                            the active approval policy.
                        </Info>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="tc-two-columns">
                    <Panel title="Documents (Supporting Files)" icon="description">
                        <p className="tc-intro">
                            Select supporting documents for this transaction.
                        </p>

                        <input
                            ref={fileInput}
                            type="file"
                            multiple
                            hidden
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                            onChange={e => {
                                if (e.target.files) addFiles(e.target.files);
                                e.target.value = "";
                            }}
                        />

                        <div
                            className={`tc-dropzone ${dragging ? "dragging" : ""}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => fileInput.current?.click()}
                            onKeyDown={e => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    fileInput.current?.click();
                                }
                            }}
                            onDragOver={e => {
                                e.preventDefault();
                                setDragging(true);
                            }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={e => {
                                e.preventDefault();
                                setDragging(false);
                                addFiles(e.dataTransfer.files);
                            }}
                        >
                            <Icon name="cloud_upload" size={46} />
                            <strong>Drag and drop files here, or click to browse</strong>
                            <span>PDF, DOC, DOCX, XLS, XLSX, JPG, PNG</span>
                            <span>Maximum 10 MB per file | Up to 5 files</span>
                        </div>

                        <h3>Selected Documents ({files.length} of 5)</h3>
                        {files.length ? fileRows : (
                            <p className="tc-empty">No documents selected.</p>
                        )}

                        {files.length > 0 && (
                            <Info title="Files Selected">
                                {files.length} local file(s), totaling{" "}
                                {fileSize(files.reduce((sum, file) => sum + file.size, 0))}.
                                These files have not been uploaded to the server.
                            </Info>
                        )}
                    </Panel>

                    <aside className="tc-side">
                        <Panel title="Transaction Summary" icon="layers">
                            <Row label="Type">Transfer</Row>
                            <Row label="From Account">{accountDisplay(source)}</Row>
                            <Row label="To Account">{accountDisplay(destination)}</Row>
                            <Row label="Amount">{totalAmount}</Row>
                            <Row label="Purpose">{form.purpose}</Row>
                            <Row label="Reference">{form.reference || "—"}</Row>
                        </Panel>

                        <Panel title="Document Guidelines" icon="info">
                            <div className="tc-guidelines">
                                <p>Include relevant invoices, contracts, or payment details.</p>
                                <p>Supported types: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG.</p>
                                <p>Maximum file size: 10 MB.</p>
                                <p>Maximum file count: 5.</p>
                                <p>
                                    Permanent storage and retrieval require a protected
                                    transaction-document backend.
                                </p>
                            </div>
                        </Panel>
                    </aside>
                </div>
            )}

            {step === 4 && (
                <>
                    <Panel title="Review & Submit" icon="fact_check">
                        <p className="tc-intro">
                            Review the transaction details and risk assessment before submitting.
                        </p>
                    </Panel>

                    <div className="tc-two-columns tc-equal-columns">
                        <div className="tc-side">
                            <Panel title="Transaction Summary" icon="layers">
                                <Row label="Transaction Type">Transfer</Row>
                                <Row label="Purpose">{form.purpose}</Row>
                                <Row label="From Account">{accountDisplay(source)}</Row>
                                <Row label="To Account">{accountDisplay(destination)}</Row>
                                <Row label="Amount">{totalAmount}</Row>
                                <Row label="Currency">{source?.currency ?? "—"}</Row>
                                <Row label="Transaction Date">{form.date}</Row>
                                <Row label="Reference">{form.reference || "—"}</Row>
                                <Row label="Description">{form.description}</Row>
                            </Panel>


                            <Info title="Ready to Submit" success>
                                {files.length > 0
                                    ? `${files.length} supporting document(s) will be uploaded and linked to the transaction during submission.`
                                    : "The transaction is ready for validation, risk assessment, and approval routing. No supporting documents were selected."}
                            </Info>

                        </div>

                        <div className="tc-side">
                            <Panel title="Client & Account Context" icon="groups">
                                <strong>{sourceClient?.companyName ?? "—"}</strong>
                                <Row label="Source Account">{accountDisplay(source)}</Row>
                                <Row label="Destination Account">
                                    {accountDisplay(destination)}
                                </Row>
                                <Row label="Destination Client">
                                    {destinationClient?.companyName ?? "—"}
                                </Row>
                            </Panel>

                            <Panel title={`Selected Documents (${files.length})`} icon="description">
                                {files.length ? fileRows : (
                                    <p>No supporting documents selected.</p>
                                )}
                            </Panel>

                            <Panel title="What Happens Next?" icon="info">
                                <div className="tc-guidelines">
                                    <p>The transaction is created as Pending.</p>
                                    <p>The backend performs the authoritative risk assessment.</p>
                                    <p>The approval policy determines required reviewers.</p>
                                    <p>Financial processing follows the existing backend workflow.</p>
                                </div>
                            </Panel>
                        </div>
                    </div>
                </>
            )}

            <footer className="tc-footer">
                <div className="tc-footer-left">
                    {step > 1 && (
                        <button
                            type="button"
                            className="tc-secondary"
                            disabled={saving}
                            onClick={() => {
                                setError("");
                                setStep((step - 1) as Step);
                            }}
                        >
                            <Icon name="chevron_left" size={20} />
                            Back: {STEPS[step - 2]}
                        </button>
                    )}

                    <Link className="tc-secondary" href={ROUTES.transactions}>
                        <Icon name="close" size={20} />
                        Cancel
                    </Link>
                </div>

                {step < 4 ? (
                    <button
                        type="button"
                        className="tc-primary"
                        disabled={loading || riskLoading}
                        onClick={() => void next()}
                    >
                        {riskLoading
                            ? "Evaluating Risk..."
                            : step === 1
                                ? "Next: Risk & Approval"
                                : step === 2
                                    ? "Next: Documents"
                                    : "Next: Review & Submit"}
                        <Icon name="arrow_forward" size={21} />
                    </button>
                ) : (
                    <button
                        type="button"
                        className="tc-primary"
                        disabled={saving}
                        onClick={() => void submit()}
                    >
                        {saving ? "Submitting..." : "Submit Transaction"}
                        <Icon name="send" size={21} />
                    </button>
                )}
            </footer>
        </div>
    );
}