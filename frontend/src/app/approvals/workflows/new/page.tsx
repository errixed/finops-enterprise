"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui";
import {
  createApprovalWorkflow,
  saveWorkflowDraft,
  getWorkflowDraft,
  updateWorkflowDraft,
  completeWorkflowDraft,
  deleteWorkflowDraft,
  type DecisionType,
  type ReviewerRole,
  type RiskLevel,
  type WorkflowBuilderInput,
  type WorkflowStageInput
} from "@/services/approval-workflow-builder";
import "./create-workflow.css";

const ROLES: { value: ReviewerRole; label: string }[] = [
  { value: "OperationsReviewer", label: "Operations Reviewer" },
  { value: "SeniorReviewer", label: "Senior Reviewer" },
  { value: "ComplianceReviewer", label: "Compliance Reviewer" }
];

const RISK_LEVELS: { value: RiskLevel; label: string }[] = [
  { value: "Low", label: "Low (0–24)" },
  { value: "Medium", label: "Medium (25–49)" },
  { value: "High", label: "High (50–74)" },
  { value: "Critical", label: "Critical (75–100)" }
];

function emptyForm(): WorkflowBuilderInput {
  return {
    name: "",
    workflowCode: "",
    description: "",
    riskLevels: [],
    transactionType: "All",
    stageDefinitions: [
      {
        name: "",
        reviewerRole: "OperationsReviewer",
        decisionType: "ApproveReject",
        slaBusinessDays: 1
      }
    ],
    slaCalculation: "PerStage",
    autoEscalate: false,
    escalationRole: "ComplianceReviewer",
    allowParallel: false,
    requireReapproval: false,
    active: false
  };
}

function roleLabel(role: ReviewerRole) {
  return ROLES.find(item => item.value === role)?.label ?? role;
}

function Section({
  title,
  icon,
  children
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="acw-section">
      <header className="acw-section-heading">
        <Icon name={icon} size={23} />
        <h2>{title}</h2>
      </header>
      <div className="acw-section-body">{children}</div>
    </section>
  );
}

function WorkflowPreview({
  stages
}: {
  stages: WorkflowStageInput[];
}) {
  return (
    <div className="acw-preview-scroll">
      <div className="acw-preview-flow">
        <span className="acw-terminal">
          <Icon name="play_circle" size={22} />
          Start
        </span>

        {stages.map((stage, index) => (
          <div className="acw-preview-segment" key={index}>
            <Icon name="arrow_forward" size={19} />
            <div className={`acw-preview-stage ${
              index % 2 ? "purple" : "blue"
            }`}>
              <Icon
                name={index % 2 ? "verified_user" : "person_outline"}
                size={25}
              />
              <div>
                <strong>Stage {index + 1}</strong>
                <span>{roleLabel(stage.reviewerRole)}</span>
              </div>
            </div>
          </div>
        ))}

        <Icon name="arrow_forward" size={19} />
        <span className="acw-terminal">
          <Icon name="check_circle" size={22} />
          End
        </span>
      </div>
    </div>
  );
}

function WorkflowBuilder() {
  const router = useRouter();
  const params = useSearchParams();
  const draftId = params.get("draft");

  const [form, setForm] = useState<WorkflowBuilderInput>(emptyForm);
  const [loading, setLoading] = useState(Boolean(draftId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!draftId) {
      setForm(emptyForm());
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    getWorkflowDraft(draftId)
      .then(draft => {
        if (!active) return;

        setForm({
          name: draft.name ?? "",
          workflowCode: draft.workflowCode ?? "",
          description: draft.description ?? "",
          riskLevels: draft.riskLevels ?? [],
          transactionType: draft.transactionType ?? "All",
          stageDefinitions: draft.stageDefinitions?.length
            ? draft.stageDefinitions.map(stage => ({ ...stage }))
            : [],
          slaCalculation: draft.slaCalculation ?? "PerStage",
          autoEscalate: draft.autoEscalate ?? false,
          escalationRole: draft.escalationRole ?? "ComplianceReviewer",
          allowParallel: draft.allowParallel ?? false,
          requireReapproval: draft.requireReapproval ?? false,
          active: false
        });
      })
      .catch(err => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Unable to open draft."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [draftId]);

  const totalBusinessDays = useMemo(
    () => form.stageDefinitions.reduce(
      (sum, stage) => sum + stage.slaBusinessDays,
      0
    ),
    [form.stageDefinitions]
  );

  function change<K extends keyof WorkflowBuilderInput>(
    field: K,
    value: WorkflowBuilderInput[K]
  ) {
    setForm(previous => ({ ...previous, [field]: value }));
  }

  function toggleRisk(level: RiskLevel) {
    setForm(previous => ({
      ...previous,
      riskLevels: previous.riskLevels.includes(level)
        ? previous.riskLevels.filter(item => item !== level)
        : [...previous.riskLevels, level]
    }));
  }

  function updateStage<K extends keyof WorkflowStageInput>(
    index: number,
    field: K,
    value: WorkflowStageInput[K]
  ) {
    setForm(previous => ({
      ...previous,
      stageDefinitions: previous.stageDefinitions.map(
        (stage, current) =>
          current === index ? { ...stage, [field]: value } : stage
      )
    }));
  }

  function moveStage(index: number, direction: -1 | 1) {
    setForm(previous => {
      const next = [...previous.stageDefinitions];
      const target = index + direction;

      if (target < 0 || target >= next.length) {
        return previous;
      }

      [next[index], next[target]] = [next[target], next[index]];

      return { ...previous, stageDefinitions: next };
    });
  }

  function addStage() {
    setForm(previous => {
      if (previous.stageDefinitions.length >= 5) return previous;

      return {
        ...previous,
        stageDefinitions: [
          ...previous.stageDefinitions,
          {
            name: "",
            reviewerRole: "OperationsReviewer",
            decisionType: "ApproveReject",
            slaBusinessDays: 1
          }
        ]
      };
    });
  }

  async function saveDraft() {
    if (busy || loading) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const saved = draftId
        ? await updateWorkflowDraft(draftId, form)
        : await saveWorkflowDraft(form);

      setNotice("Draft saved successfully.");
      router.replace(
        `/approvals/workflows/new?draft=${encodeURIComponent(saved.definitionId)}`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save draft."
      );
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (busy || loading) return;

    setError("");
    setNotice("");

    if (
      !form.name.trim() ||
      !form.workflowCode.trim() ||
      !form.description.trim()
    ) {
      setError("Workflow name, code and description are required.");
      return;
    }

    if (!form.riskLevels.length) {
      setError("Select at least one applicable risk level.");
      return;
    }

    if (
      !form.stageDefinitions.length ||
      form.stageDefinitions.some(stage => !stage.name.trim())
    ) {
      setError("Every stage needs a name.");
      return;
    }

    setBusy(true);

    try {
      if (draftId) {
        await completeWorkflowDraft(draftId, form);
      } else {
        await createApprovalWorkflow(form);
      }

      router.push("/approvals/workflows");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create workflow."
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft() {
    if (!draftId || busy || loading) return;

    const confirmed = window.confirm(
      "Delete this workflow draft permanently? This cannot be undone."
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");

    try {
      await deleteWorkflowDraft(draftId);
      router.push("/approvals/workflows");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete draft."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="acw-page">
      <div className="acw-breadcrumb">
        <Link href="/approvals">Approval Management</Link>
        <Icon name="chevron_right" size={17} />
        <Link href="/approvals/workflows">Approval Workflows</Link>
        <Icon name="chevron_right" size={17} />
        <strong>{draftId ? "Edit Draft" : "New Workflow"}</strong>
      </div>

      <div className="acw-title">
        <h1>
          <Icon name="settings" size={36} />
          {draftId ? "Edit Workflow Draft" : "Create Approval Workflow"}
        </h1>
        <p>
          Define a multi-stage approval workflow for transaction reviews
          and exceptions.
        </p>
      </div>

      {error && <div className="acw-error" role="alert">{error}</div>}
      {notice && <div className="acw-success" role="status">{notice}</div>}
      {loading && <p>Loading saved workflow draft...</p>}

      {!loading && (
        <>
          <div className="acw-grid">
            <div className="acw-column">
              <Section title="Workflow Information" icon="description">
                <div className="acw-two-fields">
                  <label>
                    Workflow Name <b>*</b>
                    <input
                      maxLength={150}
                      value={form.name}
                      placeholder="e.g. High-Risk Transaction Approval"
                      onChange={event => change("name", event.target.value)}
                    />
                  </label>

                  <label>
                    Workflow Code <b>*</b>
                    <input
                      maxLength={40}
                      value={form.workflowCode}
                      placeholder="e.g. WF-HR-001"
                      onChange={event =>
                        change(
                          "workflowCode",
                          event.target.value.toUpperCase()
                        )
                      }
                    />
                  </label>
                </div>

                <label className="acw-block-label">
                  Description <b>*</b>
                  <textarea
                    maxLength={250}
                    rows={3}
                    value={form.description}
                    onChange={event =>
                      change("description", event.target.value)
                    }
                  />
                  <small>{form.description.length} / 250</small>
                </label>
              </Section>

              <Section title="Applicability" icon="track_changes">
                <div className="acw-applicability">
                  <strong>Applicable Risk Levels <b>*</b></strong>
                  <div className="acw-risk-options">
                    {RISK_LEVELS.map(level => (
                      <label key={level.value}>
                        <input
                          type="checkbox"
                          checked={form.riskLevels.includes(level.value)}
                          onChange={() => toggleRisk(level.value)}
                        />
                        {level.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="acw-transaction-type">
                  <label htmlFor="acw-transaction-type">
                    Transaction Types <b>*</b>
                  </label>
                  <select
                    id="acw-transaction-type"
                    value={form.transactionType}
                    onChange={event => change(
                      "transactionType",
                      event.target.value as WorkflowBuilderInput["transactionType"]
                    )}
                  >
                    <option value="All">All Transaction Types</option>
                    <option value="InternalTransfer">Internal Transfer</option>
                    <option value="ExternalTransfer">External Transfer</option>
                  </select>
                </div>
              </Section>

              <Section title="Workflow Stages" icon="layers">
                <div className="acw-stage-table-scroll">
                  <table className="acw-stage-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Stage Name</th>
                        <th>Reviewer Role</th>
                        <th>Decision Type</th>
                        <th>SLA</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.stageDefinitions.map((stage, index) => (
                        <tr key={index}>
                          <td>
                            <span className="acw-stage-number">
                              {index + 1}
                            </span>
                          </td>
                          <td>
                            <input
                              aria-label={`Stage ${index + 1} name`}
                              maxLength={80}
                              value={stage.name}
                              onChange={event =>
                                updateStage(index, "name", event.target.value)
                              }
                            />
                          </td>
                          <td>
                            <select
                              aria-label={`Stage ${index + 1} role`}
                              value={stage.reviewerRole}
                              onChange={event => updateStage(
                                index,
                                "reviewerRole",
                                event.target.value as ReviewerRole
                              )}
                            >
                              {ROLES.map(role => (
                                <option key={role.value} value={role.value}>
                                  {role.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              aria-label={`Stage ${index + 1} decision`}
                              value={stage.decisionType}
                              onChange={event => updateStage(
                                index,
                                "decisionType",
                                event.target.value as DecisionType
                              )}
                            >
                              <option value="ApproveReject">
                                Approve / Reject
                              </option>
                              <option value="ReviewRecommend">
                                Review / Recommend
                              </option>
                            </select>
                          </td>
                          <td>
                            <select
                              aria-label={`Stage ${index + 1} SLA`}
                              value={stage.slaBusinessDays}
                              onChange={event => updateStage(
                                index,
                                "slaBusinessDays",
                                Number(event.target.value)
                              )}
                            >
                              {[1, 2, 3, 5, 10, 15, 30].map(days => (
                                <option key={days} value={days}>
                                  {days} Business {days === 1 ? "Day" : "Days"}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="acw-stage-actions">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => moveStage(index, -1)}
                                aria-label="Move stage up"
                              >
                                <Icon name="arrow_upward" size={18} />
                              </button>
                              <button
                                type="button"
                                disabled={
                                  index === form.stageDefinitions.length - 1
                                }
                                onClick={() => moveStage(index, 1)}
                                aria-label="Move stage down"
                              >
                                <Icon name="arrow_downward" size={18} />
                              </button>
                              <button
                                type="button"
                                className="acw-remove"
                                disabled={form.stageDefinitions.length <= 1}
                                onClick={() => change(
                                  "stageDefinitions",
                                  form.stageDefinitions.filter(
                                    (_, current) => current !== index
                                  )
                                )}
                                aria-label="Remove stage"
                              >
                                <Icon name="delete" size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!form.stageDefinitions.length && (
                        <tr>
                          <td colSpan={6}>No stages added yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  className="acw-outline acw-add"
                  disabled={form.stageDefinitions.length >= 5}
                  onClick={addStage}
                >
                  <Icon name="add" size={19} />
                  Add Stage
                </button>
              </Section>
            </div>

            <div className="acw-column">
              <Section title="Workflow Preview" icon="account_tree">
                <WorkflowPreview stages={form.stageDefinitions} />
              </Section>

              <Section title="Workflow Settings" icon="settings">
                <div className="acw-settings">
                  <div className="acw-setting">
                    <strong>SLA Calculation</strong>
                    <div className="acw-setting-controls">
                      {(["PerStage", "EndToEnd"] as const).map(value => (
                        <label key={value}>
                          <input
                            type="radio"
                            checked={form.slaCalculation === value}
                            onChange={() => change("slaCalculation", value)}
                          />
                          {value === "PerStage" ? "Per Stage" : "End-to-End"}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="acw-setting">
                    <strong>Escalation Rule</strong>
                    <div className="acw-setting-controls acw-escalation">
                      <label>
                        <input
                          type="checkbox"
                          checked={form.autoEscalate}
                          onChange={event =>
                            change("autoEscalate", event.target.checked)
                          }
                        />
                        Auto-escalate on SLA breach
                      </label>
                      <label className="acw-escalate-to">
                        Escalate to
                        <select
                          disabled={!form.autoEscalate}
                          value={form.escalationRole}
                          onChange={event => change(
                            "escalationRole",
                            event.target.value as ReviewerRole
                          )}
                        >
                          {ROLES.map(role => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="acw-setting">
                    <strong>Parallel Review</strong>
                    <div className="acw-setting-controls">
                      <label>
                        <input
                          type="checkbox"
                          checked={form.allowParallel}
                          onChange={event =>
                            change("allowParallel", event.target.checked)
                          }
                        />
                        Allow parallel approvers
                      </label>
                    </div>
                  </div>

                  <div className="acw-setting">
                    <strong>Reapproval Required</strong>
                    <div className="acw-setting-controls">
                      <label>
                        <input
                          type="checkbox"
                          checked={form.requireReapproval}
                          onChange={event =>
                            change("requireReapproval", event.target.checked)
                          }
                        />
                        Require reapproval if transaction is modified
                      </label>
                    </div>
                  </div>

                  <div className="acw-setting">
                    <strong>Active</strong>
                    <div className="acw-setting-controls">
                      <label>
                        <input
                          type="checkbox"
                          className="acw-switch"
                          checked={form.active}
                          onChange={event =>
                            change("active", event.target.checked)
                          }
                        />
                        Activate after creation
                      </label>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Notes" icon="info">
                <div className="acw-notes">
                  <p>Workflow definitions are governed by Approval Policies.</p>
                  <p>Drafts may contain incomplete information.</p>
                  <p>Creating a workflow requires valid stages and risk levels.</p>
                  <p>
                    Current stages: {form.stageDefinitions.length}.
                    Combined target: {totalBusinessDays} business day(s).
                  </p>
                  <p>
                    Catalog activation does not change the Assignment 3
                    transaction approval engine.
                  </p>
                </div>
              </Section>
            </div>
          </div>

          <footer className="acw-footer">
            <Link href="/approvals/workflows" className="acw-outline">
              <Icon name="arrow_back" size={19} />
              Back to Workflows
            </Link>

            <div>
              <Link href="/approvals/workflows" className="acw-outline">
                Cancel
              </Link>

              {draftId && (
                <button
                  type="button"
                  className="acw-delete-draft"
                  disabled={busy}
                  onClick={() => void deleteDraft()}
                >
                  <Icon name="delete" size={18} />
                  Delete Draft
                </button>
              )}

              <button
                type="button"
                className="acw-outline"
                disabled={busy}
                onClick={() => void saveDraft()}
              >
                <Icon name="save" size={19} />
                {busy ? "Saving..." :
                  draftId ? "Save Changes" : "Save Draft"}
              </button>

              <button
                type="button"
                className="acw-create"
                disabled={busy}
                onClick={() => void create()}
              >
                <Icon name="check" size={20} />
                {busy ? "Saving..." : "Create Workflow"}
              </button>
            </div>
          </footer>
        </>
      )}
    </main>
  );
}

export default function CreateApprovalWorkflowPage() {
  return (
    <Suspense fallback={<p>Loading workflow builder...</p>}>
      <WorkflowBuilder />
    </Suspense>
  );
}