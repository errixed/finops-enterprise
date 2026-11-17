"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import {
  createCase,
  getCreateCaseOptions,
  uploadCaseDocument,
  type CaseActorOption,
  type CaseAssessmentOption,
  type CaseRiskLevel,
  type CaseRuleOption,
  type CaseTransactionOption
} from "@/services/risk-cases";
import "../case-management.css";
import "./create-case.css";

type Source = "Risk Assessment" | "Manual" | "External Referral";

type FormData = {
  subject: string;
  source: Source;
  assessmentId: string;
  triggeringRuleIds: string[];
  priority: CaseRiskLevel;
  status: "Open" | "In Investigation";
  assignedTo: string;
  dueDate: string;
  description: string;
  initialNote: string;
  transactionId: string;
};

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png"
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const PRIORITIES: CaseRiskLevel[] = [
  "Low",
  "Medium",
  "High",
  "Critical"
];

function displayDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function priorityBadge(value: string) {
  return (
    <span className={`cc-priority cc-priority-${value.toLowerCase()}`}>
      <Icon
        name={value === "Low" ? "check_circle" : "warning"}
        size={16}
      />
      {value}
    </span>
  );
}

function Section({
  icon,
  title,
  children,
  className = ""
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`cc-section ${className}`}>
      <header className="cc-section-header">
        <Icon name={icon} size={25} />
        <h2>{title}</h2>
      </header>
      <div className="cc-section-body">{children}</div>
    </section>
  );
}

export default function CreateCasePage() {
  const router = useRouter();
  const uploadInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>({
    subject: "",
    source: "Risk Assessment",
    assessmentId: "",
    triggeringRuleIds: [],
    priority: "Medium",
    status: "Open",
    assignedTo: "",
    dueDate: "",
    description: "",
    initialNote: "",
    transactionId: ""
  });

  const [assessments, setAssessments] = useState<CaseAssessmentOption[]>([]);
  const [transactions, setTransactions] = useState<CaseTransactionOption[]>([]);
  const [actors, setActors] = useState<CaseActorOption[]>([]);
  const [rules, setRules] = useState<CaseRuleOption[]>([]);

  const [assessmentSearch, setAssessmentSearch] = useState("");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [ruleSearch, setRuleSearch] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [savedCaseId, setSavedCaseId] = useState<string | null>(null);

  const update = <K extends keyof FormData>(
    key: K,
    value: FormData[K]
  ) => setForm(previous => ({ ...previous, [key]: value }));

  const selectedAssessment = useMemo(
    () => assessments.find(
      item => item.assessmentId === form.assessmentId
    ) ?? null,
    [assessments, form.assessmentId]
  );

  const selectedTransaction = useMemo(
    () => transactions.find(
      item => item.transactionId === form.transactionId
    ) ?? null,
    [transactions, form.transactionId]
  );

  const availableRuleIds = useMemo(() => {
    if (form.source !== "Risk Assessment") return rules;

    return (selectedAssessment?.triggeredRules ?? []).map(rule => ({
      ruleId: rule.ruleId,
      name: rule.reason || rule.ruleId
    }));
  }, [form.source, rules, selectedAssessment]);

  const matchedRules = useMemo(
    () => availableRuleIds.filter(item =>
      `${item.ruleId} ${item.name}`
        .toLowerCase()
        .includes(ruleSearch.toLowerCase())
    ),
    [availableRuleIds, ruleSearch]
  );

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);

    try {
      const [assessmentRows, transactionRows, actorRows, ruleRows] =
        await Promise.all([
          getCreateCaseOptions("assessments"),
          getCreateCaseOptions("transactions"),
          getCreateCaseOptions("actors"),
          getCreateCaseOptions("rules")
        ]);

      setAssessments(assessmentRows);
      setTransactions(transactionRows);
      setActors(actorRows);
      setRules(ruleRows);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load case options."
      );
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (!assessmentSearch.trim()) return;

    let active = true;
    const timeout = setTimeout(() => {
      getCreateCaseOptions("assessments", assessmentSearch)
        .then(rows => {
          if (!active) return;

          setAssessments(previous => {
            const map = new Map(
              [...previous, ...rows].map(item => [
                item.assessmentId,
                item
              ])
            );
            return [...map.values()];
          });
        })
        .catch(() => { });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [assessmentSearch]);

  useEffect(() => {
    if (!transactionSearch.trim()) return;

    let active = true;
    const timeout = setTimeout(() => {
      getCreateCaseOptions("transactions", transactionSearch)
        .then(rows => {
          if (!active) return;

          setTransactions(previous => {
            const map = new Map(
              [...previous, ...rows].map(item => [
                item.transactionId,
                item
              ])
            );
            return [...map.values()];
          });
        })
        .catch(() => { });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [transactionSearch]);

  function selectAssessment(id: string) {
    const item = assessments.find(row => row.assessmentId === id);

    if (!item) {
      setForm(previous => ({
        ...previous,
        assessmentId: "",
        triggeringRuleIds: [],
        transactionId: ""
      }));
      return;
    }

    setForm(previous => ({
      ...previous,
      assessmentId: item.assessmentId,
      priority: item.riskLevel,
      triggeringRuleIds: item.triggeredRules.map(rule => rule.ruleId),
      transactionId: item.transactionId
    }));

    setTransactionSearch(item.transactionId);
    void getCreateCaseOptions("transactions", item.transactionId)
      .then(rows => {
        setTransactions(previous => {
          const map = new Map(
            [...previous, ...rows].map(row => [
              row.transactionId,
              row
            ])
          );

          return [...map.values()];
        });
      })
      .catch(() => {
        setError("Could not load the related transaction details.");
      });
  }

  function toggleRule(id: string) {
    setForm(previous => ({
      ...previous,
      triggeringRuleIds: previous.triggeringRuleIds.includes(id)
        ? previous.triggeringRuleIds.filter(value => value !== id)
        : [...previous.triggeringRuleIds, id]
    }));
  }

  function changeSource(source: Source) {
    setForm(previous => ({
      ...previous,
      source,
      assessmentId: "",
      triggeringRuleIds: [],
      transactionId: source === "Risk Assessment"
        ? ""
        : previous.transactionId
    }));
    setRuleSearch("");
  }

  function addFiles(incoming: FileList | File[]) {
    const candidates = Array.from(incoming);
    const valid: File[] = [];

    for (const file of candidates) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`Unsupported file type: ${file.name}`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} exceeds the 10 MB limit.`);
        continue;
      }

      valid.push(file);
    }

    setFiles(previous => {
      const unique = new Map(
        [...previous, ...valid].map(file => [
          `${file.name}:${file.size}:${file.lastModified}`,
          file
        ])
      );
      return [...unique.values()];
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || savedCaseId) return;

    setError("");

    if (!form.subject.trim()) {
      setError("Subject / Title is required.");
      return;
    }

    if (!form.description.trim()) {
      setError("Description is required.");
      return;
    }

    if (
      form.source === "Risk Assessment" &&
      !form.assessmentId
    ) {
      setError("Select a risk assessment.");
      return;
    }

    if (!form.triggeringRuleIds.length) {
      setError("Select at least one triggering rule.");
      return;
    }

    if (form.dueDate) {
      const today = new Date().toISOString().slice(0, 10);

      if (form.dueDate < today) {
        setError("Due date cannot be in the past.");
        return;
      }
    }

    setSaving(true);

    let createdId: string | null = null;

    try {
      const created = await createCase({
        subject: form.subject.trim(),
        source: form.source,
        assessmentId: form.assessmentId,
        triggeringRuleIds: form.triggeringRuleIds,
        priority: form.priority,
        riskLevel: form.priority,
        status: form.status,
        assignedTo: form.assignedTo,
        dueDate: form.dueDate,
        description: form.description.trim(),
        summary: form.description.trim(),
        initialNote: form.initialNote.trim(),
        nextAction: "",
        transactionId: form.transactionId,
        clientId: ""
      });

      createdId = created.caseId;
      setSavedCaseId(created.caseId);

      for (const file of files) {
        await uploadCaseDocument(created.caseId, file);
      }

      router.push("/risk/cases");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "Unable to create case.";

      setError(createdId
        ? `Case ${createdId} was created, but an attachment failed: ${message}. Do not resubmit. Open the case to finish uploading documents.`
        : message
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="cc-page">
      <div className="cc-breadcrumb">
        <Link href="/risk">Risk Management</Link>
        <Icon name="chevron_right" size={18} />
        <Link href="/risk/cases">Case Management</Link>
        <Icon name="chevron_right" size={18} />
        <strong>Create Case</strong>
      </div>

      <div className="cc-heading">
        <div className="cc-heading-title">
          <Icon name="create_new_folder" size={39} />
          <h1>Create Case</h1>
        </div>
        <p>
          Create a new investigation case to review a potential
          financial risk or compliance issue.
        </p>
      </div>

      {error && (
        <div className="cc-error" role="alert">{error}</div>
      )}

      {loadingOptions && (
        <p className="cc-loading">Loading case options...</p>
      )}

      <form onSubmit={submit}>
        <div className="cc-main-grid">
          <Section icon="info" title="Case Information">
            <div className="cc-form-grid">
              <label htmlFor="cc-subject" className="cc-field-label">
                Subject / Title <b>*</b>
              </label>
              <input
                id="cc-subject"
                required
                maxLength={150}
                placeholder="Enter the case title"
                value={form.subject}
                onChange={event =>
                  update("subject", event.target.value)
                }
              />

              <span className="cc-field-label">
                Source <b>*</b>
              </span>
              <div className="cc-radio-list">
                {(["Risk Assessment", "Manual", "External Referral"] as const)
                  .map(source => (
                    <label key={source}>
                      <input
                        type="radio"
                        name="case-source"
                        checked={form.source === source}
                        onChange={() => changeSource(source)}
                      />
                      {source}
                    </label>
                  ))}
              </div>

              <label className="cc-field-label" htmlFor="cc-rules">
                Triggering Rule(s) <b>*</b>
              </label>
              <div className="cc-rule-control">
                <button
                  type="button"
                  id="cc-rules"
                  className="cc-rule-button"
                  aria-expanded={showRules}
                  onClick={() => setShowRules(value => !value)}
                >
                  <span className="cc-rule-tags">
                    {form.triggeringRuleIds.length
                      ? form.triggeringRuleIds.map(id => (
                        <span key={id} className="cc-tag">
                          {id}
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={`Remove ${id}`}
                            onClick={event => {
                              event.stopPropagation();
                              toggleRule(id);
                            }}
                            onKeyDown={event => {
                              if (event.key === "Enter") {
                                event.stopPropagation();
                                toggleRule(id);
                              }
                            }}
                          >×</span>
                        </span>
                      ))
                      : <span className="cc-placeholder">
                        Select triggered rules
                      </span>}
                  </span>
                  <Icon name="arrow_drop_down" size={22} />
                </button>

                {showRules && (
                  <div className="cc-rule-popover">
                    <input
                      placeholder="Search rules..."
                      value={ruleSearch}
                      onChange={event => setRuleSearch(event.target.value)}
                    />
                    <div className="cc-rule-options">
                      {matchedRules.map(rule => (
                        <label key={rule.ruleId}>
                          <input
                            type="checkbox"
                            checked={form.triggeringRuleIds.includes(
                              rule.ruleId
                            )}
                            onChange={() => toggleRule(rule.ruleId)}
                          />
                          <span>
                            <strong>{rule.ruleId}</strong>
                            <small>{rule.name}</small>
                          </span>
                        </label>
                      ))}
                      {!matchedRules.length &&
                        <p>No matching rules available.</p>}
                    </div>
                  </div>
                )}
              </div>

              <label className="cc-field-label" htmlFor="cc-priority">
                Priority <b>*</b>
              </label>
              <div className="cc-select-wrap">
                {priorityBadge(form.priority)}
                <select
                  id="cc-priority"
                  value={form.priority}
                  disabled={form.source === "Risk Assessment" &&
                    !!selectedAssessment}
                  onChange={event =>
                    update("priority", event.target.value as CaseRiskLevel)
                  }
                  aria-label="Case priority"
                >
                  {PRIORITIES.map(value =>
                    <option key={value} value={value}>{value}</option>
                  )}
                </select>
              </div>

              <label className="cc-field-label" htmlFor="cc-status">
                Status <b>*</b>
              </label>
              <select
                id="cc-status"
                value={form.status}
                onChange={event =>
                  update("status", event.target.value as FormData["status"])
                }
              >
                <option value="Open">Open</option>
                <option value="In Investigation">In Investigation</option>
              </select>

              <label className="cc-field-label" htmlFor="cc-assigned">
                Assigned To
              </label>
              <select
                id="cc-assigned"
                value={form.assignedTo}
                onChange={event =>
                  update("assignedTo", event.target.value)
                }
              >
                <option value="">Unassigned</option>
                {actors.map(actor => (
                  <option key={actor.actorId} value={actor.actorId}>
                    {actor.name} — {actor.role}
                  </option>
                ))}
              </select>

              <label className="cc-field-label" htmlFor="cc-due">
                Due Date
              </label>
              <input
                type="date"
                id="cc-due"
                min={new Date().toISOString().slice(0, 10)}
                value={form.dueDate}
                onChange={event =>
                  update("dueDate", event.target.value)
                }
              />

              <label className="cc-field-label" htmlFor="cc-description">
                Description <b>*</b>
              </label>
              <div className="cc-textarea-wrap">
                <textarea
                  id="cc-description"
                  required
                  maxLength={1000}
                  rows={5}
                  placeholder="Describe why this case requires investigation..."
                  value={form.description}
                  onChange={event =>
                    update("description", event.target.value)
                  }
                />
                <span>{form.description.length} / 1000</span>
              </div>
            </div>
          </Section>

          <div className="cc-right-column">
            <Section icon="shield" title="Risk Assessment Context">
              {form.source === "Risk Assessment" ? (
                <>
                  <div className="cc-lookup-line">
                    <label htmlFor="cc-assessment-search">
                      Find Risk Assessment
                    </label>
                    <input
                      id="cc-assessment-search"
                      placeholder="Search assessment or transaction ID..."
                      value={assessmentSearch}
                      onChange={event =>
                        setAssessmentSearch(event.target.value)
                      }
                    />
                  </div>

                  <select
                    className="cc-assessment-picker"
                    value={form.assessmentId}
                    onChange={event =>
                      selectAssessment(event.target.value)
                    }
                  >
                    <option value="">Select a risk assessment...</option>
                    {assessments
                      .filter(item =>
                        !assessmentSearch ||
                        `${item.assessmentId} ${item.transactionId}`
                          .toLowerCase()
                          .includes(assessmentSearch.toLowerCase())
                      )
                      .map(item => (
                        <option
                          value={item.assessmentId}
                          key={item.assessmentId}
                        >
                          {item.assessmentId} — {item.transactionId}
                        </option>
                      ))}
                  </select>

                  {selectedAssessment ? (
                    <div className="cc-assessment-summary">
                      <div>
                        <span>Assessment ID</span>
                        <Link href={
                          `/risk/assessments/${encodeURIComponent(
                            selectedAssessment.assessmentId
                          )}`
                        }>
                          {selectedAssessment.assessmentId}
                        </Link>
                      </div>
                      <div>
                        <span>Risk Score</span>
                        <strong>{selectedAssessment.riskScore}</strong>
                      </div>
                      <div>
                        <span>Risk Level</span>
                        {priorityBadge(selectedAssessment.riskLevel)}
                      </div>
                      <div>
                        <span>Assessed On</span>
                        <strong>
                          {displayDate(selectedAssessment.assessedAt)}
                        </strong>
                      </div>
                      <Link
                        className="cc-view-assessment"
                        href={`/risk/assessments/${encodeURIComponent(
                          selectedAssessment.assessmentId
                        )}`}
                      >
                        <Icon name="open_in_new" size={17} />
                        View Assessment
                      </Link>
                    </div>
                  ) : (
                    <p className="cc-empty">
                      Choose a real risk assessment to populate its
                      score, risk level, triggered rules and transaction.
                    </p>
                  )}
                </>
              ) : (
                <p className="cc-empty">
                  This case is sourced from {form.source.toLowerCase()}.
                  A linked risk assessment is not required.
                </p>
              )}
            </Section>

            <Section
              icon="database"
              title="Related Transaction (Optional)"
            >
              <div className="cc-transaction-search">
                <Icon name="search" size={19} />
                <input
                  placeholder="Search by Transaction ID or Account..."
                  aria-label="Find transaction"
                  value={transactionSearch}
                  onChange={event =>
                    setTransactionSearch(event.target.value)
                  }
                  disabled={form.source === "Risk Assessment" &&
                    !!selectedAssessment}
                />
              </div>

              <div className="cc-transaction-list">
                {transactions
                  .filter(item => {
                    if (
                      form.source === "Risk Assessment" &&
                      selectedAssessment
                    ) {
                      return item.transactionId ===
                        selectedAssessment.transactionId;
                    }

                    return (
                      !transactionSearch ||
                      `${item.transactionId} ${item.sourceAccountId} ${item.referenceNumber}`
                        .toLowerCase()
                        .includes(transactionSearch.toLowerCase())
                    );
                  })
                  .slice(0, 6)
                  .map(item => (
                    <label
                      className={`cc-transaction-row ${form.transactionId === item.transactionId
                          ? "selected"
                          : ""
                        }`}
                      key={item.transactionId}
                    >
                      <input
                        type="radio"
                        checked={form.transactionId === item.transactionId}
                        disabled={form.source === "Risk Assessment" &&
                          !!selectedAssessment}
                        onChange={() =>
                          update("transactionId", item.transactionId)
                        }
                      />
                      <span className="cc-transaction-id">
                        {item.transactionId}
                      </span>
                      <span>
                        <strong>Account</strong>
                        {item.sourceAccountId}
                      </span>
                      <span>
                        <strong>Amount</strong>
                        {item.amountMinor !== null
                          ? (item.amountMinor / 100).toLocaleString(
                            "en-CA", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }
                          )
                          : item.amount !== null
                            ? item.amount.toLocaleString("en-CA")
                            : "—"}{" "}
                        {item.currency}
                      </span>
                      <span>
                        <strong>Date & Time</strong>
                        {displayDate(item.createdAt)}
                      </span>
                    </label>
                  ))}

                {!transactions.length && (
                  <p className="cc-empty">No transactions available.</p>
                )}
              </div>
              {form.transactionId &&
                form.source !== "Risk Assessment" && (
                  <button
                    type="button"
                    className="cc-clear"
                    onClick={() => update("transactionId", "")}
                  >
                    Clear transaction selection
                  </button>
                )}
            </Section>

            <Section icon="description" title="Supporting Documents">
              <div className="cc-documents-grid">
                <div
                  className={`cc-dropzone ${dragging ? "dragging" : ""}`}
                  onDragOver={event => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={event => {
                    event.preventDefault();
                    setDragging(false);
                  }}
                  onDrop={event => {
                    event.preventDefault();
                    setDragging(false);
                    addFiles(event.dataTransfer.files);
                  }}
                  onClick={() => uploadInput.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={event => {
                    if (event.key === "Enter" ||
                      event.key === " ") {
                      event.preventDefault();
                      uploadInput.current?.click();
                    }
                  }}
                >
                  <Icon name="upload_file" size={29} />
                  <strong>
                    Drag and drop files here, or click to browse
                  </strong>
                  <small>
                    Allowed: PDF, DOCX, XLSX, JPG, PNG (Max 10 MB each)
                  </small>
                </div>

                <input
                  ref={uploadInput}
                  hidden
                  type="file"
                  multiple
                  accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                  onChange={event => {
                    if (event.target.files) {
                      addFiles(event.target.files);
                    }
                    event.target.value = "";
                  }}
                />

                <div className="cc-file-list">
                  {files.map((file, index) => (
                    <div
                      className="cc-file-row"
                      key={`${file.name}-${file.lastModified}`}
                    >
                      <Icon name="description" size={19} />
                      <span title={file.name}>
                        {file.name}
                        <small>
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </small>
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setFiles(previous =>
                          previous.filter((_, i) => i !== index)
                        )}
                      >
                        <Icon name="delete" size={19} />
                      </button>
                    </div>
                  ))}

                  {!files.length && (
                    <p className="cc-empty">No documents selected.</p>
                  )}
                </div>
              </div>
            </Section>

            <Section icon="chat" title="Initial Notes">
              <div className="cc-notes-field">
                <textarea
                  maxLength={1000}
                  rows={3}
                  placeholder="Enter an initial investigation note..."
                  value={form.initialNote}
                  onChange={event =>
                    update("initialNote", event.target.value)
                  }
                />
                <span>{form.initialNote.length} / 1000</span>
              </div>
            </Section>
          </div>
        </div>

        <div className="cc-actions">
          <Link href="/risk/cases" className="cc-outline">
            <Icon name="arrow_back" size={21} />
            Back to Cases
          </Link>
          <div>
            <Link href="/risk/cases" className="cc-outline">
              Cancel
            </Link>
            <button
              type="submit"
              className="cc-submit"
              disabled={saving || loadingOptions || !!savedCaseId}
            >
              <Icon name="save" size={22} />
              {saving ? "Creating Case..." :
                savedCaseId ? "Case Created" : "Create Case"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
