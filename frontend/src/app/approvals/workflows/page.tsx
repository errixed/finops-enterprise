"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import {
  createWorkflowDefinition,
  deleteWorkflowDefinition,
  duplicateWorkflowDefinition,
  getWorkflowDefinitionAudit,
  getWorkflowDefinitionSummary,
  listWorkflowDefinitions,
  setWorkflowDefinitionStatus,
  updateWorkflowDefinition,
  type WorkflowDefinition,
  type WorkflowDefinitionEvent,
  type WorkflowDefinitionInput,
  type WorkflowDefinitionSummary
} from "@/services/approval-workflow-definitions";
import "./approval-workflows.css";
import { useRouter } from "next/navigation";

type Tab =
  | "summary"
  | "stages"
  | "conditions"
  | "assignments"
  | "sla"
  | "audit";

type DialogMode = "new" | "edit" | null;

const ROLES = [
  "OperationsReviewer",
  "SeniorReviewer",
  "ComplianceReviewer"
];

const LEVELS = ["Low", "Medium", "High", "Critical"];

function initialForm(): WorkflowDefinitionInput {
  return {
    name: "",
    description: "",
    riskLevels: ["Medium"],
    stages: ["OperationsReviewer"],
    slaHours: 24
  };
}
function readableRole(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function duration(hours: number) {
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function timestamp(value: string) {
  return new Date(value).toLocaleString("en-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function Stat({
  title,
  value,
  icon,
  color
}: {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  return (
    <article className={`awd-stat awd-stat-${color}`}>
      <span className="awd-stat-icon">
        <Icon name={icon} size={28} />
      </span>
      <div>
        <strong>{title}</strong>
        <b>{value}</b>
      </div>
    </article>
  );
}

function Panel({
  title,
  icon,
  action,
  children
}: {
  title: string;
  icon: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="awd-panel">
      <header className="awd-panel-header">
        <h2>
          <Icon name={icon} size={22} />
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function Detail({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="awd-detail">
      <strong>{title}</strong>
      <span>{children}</span>
    </div>
  );
}

export default function ApprovalWorkflowsPage() {
  const router = useRouter();
  const [items, setItems] = useState<WorkflowDefinition[]>([]);
  const [summary, setSummary] =
    useState<WorkflowDefinitionSummary | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState<Tab>("summary");
  const [audit, setAudit] = useState<WorkflowDefinitionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [form, setForm] = useState<WorkflowDefinitionInput>(
    initialForm()
  );

  const selected = useMemo(
    () => items.find(item => item.definitionId === selectedId) ?? null,
    [items, selectedId]
  );

  const filtered = useMemo(
    () => items.filter(item =>
      `${item.name} ${item.description} ${item.definitionId}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ),
    [items, search]
  );

  const refresh = useCallback(async () => {
    const [definitions, metrics] = await Promise.all([
      listWorkflowDefinitions(),
      getWorkflowDefinitionSummary()
    ]);

    setItems(definitions);
    setSummary(metrics);
    setSelectedId(current =>
      definitions.some(item => item.definitionId === current)
        ? current
        : definitions[0]?.definitionId ?? ""
    );
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      listWorkflowDefinitions(),
      getWorkflowDefinitionSummary()
    ])
      .then(([definitions, metrics]) => {
        if (!active) return;

        setItems(definitions);
        setSummary(metrics);
        setSelectedId(definitions[0]?.definitionId ?? "");
      })
      .catch(err => {
        if (active) setError(
          err instanceof Error
            ? err.message
            : "Unable to load workflows"
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setAudit([]);
      return;
    }

    let active = true;

    getWorkflowDefinitionAudit(selectedId)
      .then(rows => {
        if (active) setAudit(rows);
      })
      .catch(() => {
        if (active) setAudit([]);
      });

    return () => {
      active = false;
    };
  }, [selectedId, items]);

  async function run(
    task: () => Promise<unknown>,
    success: string
  ) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await task();
      await refresh();
      setDialog(null);
      setNotice(success);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Action failed"
      );
    } finally {
      setBusy(false);
    }
  }

  function editSelected() {
    if (!selected) return;

    setForm({
      name: selected.name,
      description: selected.description,
      riskLevels: [...selected.riskLevels],
      stages: [...selected.stages],
      slaHours: selected.slaHours
    });

    setDialog("edit");
  }

  function toggleLevel(level: string) {
    setForm(previous => ({
      ...previous,
      riskLevels: previous.riskLevels.includes(level)
        ? previous.riskLevels.filter(value => value !== level)
        : [...previous.riskLevels, level]
    }));
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Workflow name is required.");
      return;
    }

    if (!form.riskLevels.length || !form.stages.length) {
      setError("Select at least one risk level and stage.");
      return;
    }

    const mode = dialog;
    const editingId = selected?.definitionId;

    await run(
      async () => {
        if (mode === "edit" && editingId) {
          await updateWorkflowDefinition(editingId, form);
        } else {
          const created = await createWorkflowDefinition(form);
          setSelectedId(created.definitionId);
        }
      },
      mode === "edit"
        ? "Workflow definition updated."
        : "Custom workflow definition created as Inactive."
    );
  }

  return (
    <main className="awd-page">
      <div className="awd-breadcrumb">
        <Link href="/approvals">Approval Management</Link>
        <Icon name="chevron_right" size={18} />
        <strong>Approval Workflows</strong>
      </div>

      <div className="awd-heading">
        <div>
          <h1>
            <Icon name="account_tree" size={35} />
            Approval Workflows
          </h1>
          <p>
            Define and manage multi-stage approval workflows
            for transaction reviews and exceptions.
          </p>
        </div>
        <button
          type="button"
          className="awd-primary"
          onClick={() => router.push("/approvals/workflows/new")}
        >
          <Icon name="add" size={22} />
          New Workflow
        </button>
      </div>

      {error && <p className="awd-error" role="alert">{error}</p>}
      {notice && <p className="awd-notice" role="status">{notice}</p>}

      <div className="awd-metrics">
        <Stat
          title="Total Workflows"
          icon="database"
          value={summary?.total ?? "—"}
          color="blue"
        />
        <Stat
          title="Active"
          icon="check_circle"
          value={summary?.active ?? "—"}
          color="green"
        />
        <Stat
          title="Inactive"
          icon="pause_circle"
          value={summary?.inactive ?? "—"}
          color="yellow"
        />
        <Stat
          title="Multi-Stage"
          icon="account_tree"
          value={summary?.multiStage ?? "—"}
          color="purple"
        />
        <Stat
          title="Avg. Processing Time"
          icon="schedule"
          value={
            summary?.averageProcessingHours == null
              ? "—"
              : `${summary.averageProcessingHours} hours`
          }
          color="blue"
        />
        <Stat
          title="Approval Rate"
          icon="bar_chart"
          value={
            summary?.approvalRate == null
              ? "—"
              : `${summary.approvalRate}%`
          }
          color="blue"
        />
      </div>

      <p className="awd-context">
        Workflow definitions are a management catalog. Existing
        transaction approvals continue to follow the active
        Assignment 3 approval policies.
      </p>

      <div className="awd-columns">
        <Panel
          title={`Workflows (${filtered.length})`}
          icon="format_list_bulleted"
          action={
            <div className="awd-search">
              <Icon name="search" size={18} />
              <input
                aria-label="Search workflows"
                placeholder="Search workflows by name or description..."
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>
          }
        >
          <div className="awd-table-scroll">
            <table className="awd-table">
              <thead>
                <tr>
                  <th>Workflow Name</th>
                  <th>Risk Levels</th>
                  <th>Stages</th>
                  <th>SLA</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr
                    key={item.definitionId}
                    className={
                      selectedId === item.definitionId
                        ? "selected"
                        : ""
                    }
                    onClick={() => {
                      setSelectedId(item.definitionId);
                      setTab("summary");
                    }}
                  >
                    <td>
                      <span className="awd-name">
                        <input
                          type="radio"
                          aria-label={`Select ${item.name}`}
                          checked={selectedId === item.definitionId}
                          readOnly
                        />
                        <span>
                          <strong>
                            <Link
                              href={`/approvals/workflows/${encodeURIComponent(item.definitionId)}`}
                              onClick={event => event.stopPropagation()}
                              className="awd-workflow-detail-link"
                            >
                              {item.name || "Untitled Workflow"}
                            </Link>
                          </strong>
                          <small>{item.description}</small>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={`awd-risk awd-risk-${item.riskLevels.length === 1
                        ? item.riskLevels[0].toLowerCase()
                        : "all"
                        }`}>
                        {item.riskLevels.join(", ")}
                      </span>
                    </td>
                    <td>{item.stages.length}</td>
                    <td>{duration(item.slaHours)}</td>
                    <td>
                      <span className={`awd-status ${item.isDraft || item.status === "Draft"
                        ? "draft"
                        : item.status.toLowerCase()
                        }`}>
                        {item.isDraft || item.status === "Draft"
                          ? "Draft"
                          : item.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {!filtered.length && (
                  <tr>
                    <td colSpan={5} className="awd-empty">
                      {loading
                        ? "Loading workflows..."
                        : "No workflow definitions found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="awd-list-footer">
            Showing {filtered.length ? 1 : 0} – {filtered.length}
            {" "}of {filtered.length} workflows
          </div>
        </Panel>

        <Panel
          title={selected
            ? `Workflow Details — ${selected.name}`
            : "Workflow Details"}
          icon="settings"
          action={selected && (
            <span className={`awd-status ${selected.isDraft || selected.status === "Draft"
              ? "draft"
              : selected.status.toLowerCase()
              }`}>
              {selected.isDraft || selected.status === "Draft"
                ? "Draft"
                : selected.status}
            </span>
          )}
        >
          {selected ? (
            <div className="awd-details-content">
              <nav className="awd-tabs">
                {([
                  ["summary", "Summary"],
                  ["stages", "Stages"],
                  ["conditions", "Conditions"],
                  ["assignments", "Assignments"],
                  ["sla", "SLA & Escalation"],
                  ["audit", "Audit Trail"]
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    className={tab === key ? "active" : ""}
                    onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </nav>

              {tab === "summary" && (
                <>
                  <div className="awd-summary-grid">
                    <section className="awd-info">
                      <Detail title="Workflow Name:">
                        {selected.name}
                      </Detail>
                      <Detail title="Description:">
                        {selected.description || "—"}
                      </Detail>
                      <Detail title="Applicable Risk Levels:">
                        {selected.riskLevels.join(", ")}
                      </Detail>
                      <Detail title="Total Stages:">
                        {selected.stages.length}
                      </Detail>
                      <Detail title="SLA:">
                        {duration(selected.slaHours)}
                      </Detail>
                      <Detail title="Created By:">
                        {selected.createdBy}
                      </Detail>
                      <Detail title="Created On:">
                        {timestamp(selected.createdAt)}
                      </Detail>
                      <Detail title="Last Updated:">
                        {timestamp(selected.updatedAt)}
                      </Detail>
                    </section>
                    <section className="awd-purpose">
                      <h3>
                        <Icon name="track_changes" size={20} />
                        Workflow Purpose
                      </h3>
                      <p>
                        <Icon name="check" size={18} />
                        Review selected risk categories
                      </p>
                      <p>
                        <Icon name="check" size={18} />
                        Require ordered reviewer stages
                      </p>
                      <p>
                        <Icon name="check" size={18} />
                        Maintain a reviewable definition history
                      </p>
                      <p>
                        <Icon name="check" size={18} />
                        Record a target review duration
                      </p>
                    </section>
                  </div>
                  <ApprovalFlow stages={selected.stages} />
                </>
              )}

              {tab === "stages" && (
                <div className="awd-tab-content">
                  <h3>Sequential Reviewer Stages</h3>
                  <ApprovalFlow stages={selected.stages} />
                  <p>
                    Each stage must be completed before the next
                    reviewer can act.
                  </p>
                </div>
              )}

              {tab === "conditions" && (
                <div className="awd-tab-content">
                  <h3>Applicable Risk Levels</h3>
                  <div className="awd-tags">
                    {selected.riskLevels.map(level => (
                      <span key={level}>{level}</span>
                    ))}
                  </div>
                  <p>
                    These are catalog conditions. The existing
                    approval policy still controls transaction routing.
                  </p>
                </div>
              )}

              {tab === "assignments" && (
                <div className="awd-tab-content">
                  <h3>Required Reviewer Roles</h3>
                  {selected.stages.map((role, index) => (
                    <Detail key={index} title={`Stage ${index + 1}:`}>
                      {readableRole(role)}
                    </Detail>
                  ))}
                  <p>
                    Individual actors are selected during a
                    transaction's approval decision, subject
                    to role and separation-of-duties checks.
                  </p>
                </div>
              )}

              {tab === "sla" && (
                <div className="awd-tab-content">
                  <Detail title="Target SLA:">
                    {duration(selected.slaHours)}
                  </Detail>
                  <Detail title="Definition Status:">
                    {selected.status}
                  </Detail>
                  <p>
                    The SLA is a catalog target. Automated deadline
                    enforcement and timed escalation are not enabled.
                    Escalation of real workflows remains governed
                    by the existing workflow API.
                  </p>
                </div>
              )}

              {tab === "audit" && (
                <div className="awd-tab-content">
                  <h3>Definition Audit Trail</h3>
                  {audit.map(event => (
                    <article
                      className="awd-audit-entry"
                      key={event.eventId}
                    >
                      <strong>{event.action}</strong>
                      <span>{timestamp(event.createdAt)}</span>
                      <small>{event.actorId}</small>
                    </article>
                  ))}
                  {!audit.length && (
                    <p>
                      No management changes recorded for this
                      workflow definition.
                    </p>
                  )}
                </div>
              )}

              <footer className="awd-actions">
                {selected.isDraft || selected.status === "Draft" ? (
                  <button
                    type="button"
                    className="awd-outline"
                    disabled={busy}
                    onClick={() => router.push(
                      `/approvals/workflows/new?draft=${encodeURIComponent(
                        selected.definitionId
                      )}`
                    )}
                  >
                    <Icon name="edit" size={18} />
                    Edit Draft
                  </button>
                ) : (
                  <button
                    type="button"
                    className="awd-outline"
                    disabled={
                      busy ||
                      selected.protected ||
                      selected.status === "Active"
                    }
                    onClick={editSelected}
                  >
                    <Icon name="edit" size={18} />
                    Edit Workflow
                  </button>
                )}
                <button
                  type="button"
                  className="awd-outline"
                  disabled={
                    busy ||
                    selected.isDraft === true ||
                    selected.status === "Draft"
                  }
                  onClick={() => void run(
                    async () => {
                      const duplicate = await duplicateWorkflowDefinition(
                        selected.definitionId
                      );

                      router.push(
                        `/approvals/workflows/${encodeURIComponent(
                          duplicate.definitionId
                        )}?tab=conditions`
                      );
                    },
                    "Workflow duplicated successfully."
                  )}
                >
                  <Icon name="content_copy" size={18} />
                  Duplicate
                </button>
                <button
                  type="button"
                  className="awd-outline"
                  disabled={
                    busy ||
                    selected.protected ||
                    selected.isDraft === true ||
                    selected.status === "Draft"
                  }
                  onClick={() => void run(
                    () => setWorkflowDefinitionStatus(
                      selected.definitionId,
                      selected.status === "Active"
                        ? "Inactive"
                        : "Active"
                    ),
                    `Definition ${selected.status === "Active"
                      ? "deactivated"
                      : "activated"
                    }.`
                  )}
                >
                  <Icon
                    name={
                      selected.status === "Active"
                        ? "pause_circle"
                        : "play_circle"
                    }
                    size={18}
                  />
                  {selected.status === "Active"
                    ? "Deactivate"
                    : "Activate"}
                </button>
                <button
                  type="button"
                  className="awd-delete"
                  disabled={
                    busy ||
                    selected.protected ||
                    (
                      selected.status === "Active" &&
                      !selected.isDraft
                    )
                  }
                  onClick={() => {
                    const isDraft = selected.isDraft ||
                      selected.status === "Draft";

                    if (!window.confirm(
                      isDraft
                        ? `Permanently delete draft "${selected.name || "Untitled Workflow"}"?`
                        : `Delete custom definition "${selected.name}"?`
                    )) return;

                    void run(
                      async () => {
                        if (isDraft) {
                          const { deleteWorkflowDraft } = await import(
                            "@/services/approval-workflow-builder"
                          );

                          await deleteWorkflowDraft(selected.definitionId);
                        } else {
                          await deleteWorkflowDefinition(selected.definitionId);
                        }
                      },
                      isDraft
                        ? "Workflow draft deleted."
                        : "Custom workflow definition deleted."
                    );
                  }}
                >
                  <Icon name="delete" size={18} />
                  {selected.isDraft || selected.status === "Draft"
                    ? "Delete Draft"
                    : "Delete"}
                </button>
              </footer>
            </div>
          ) : (
            <p className="awd-empty">
              Select a workflow to view its definition.
            </p>
          )}
        </Panel>
      </div>

      {dialog && (
        <div className="awd-modal-backdrop">
          <div
            className="awd-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              dialog === "new"
                ? "New Workflow"
                : "Edit Workflow"
            }
          >
            <h2>
              {dialog === "new"
                ? "New Workflow Definition"
                : "Edit Workflow Definition"}
            </h2>

            <p>
              Custom definitions are initially inactive.
              They do not change the Assignment 3 approval matrix.
            </p>

            <div className="awd-form">
              <label>
                Workflow Name
                <input
                  maxLength={150}
                  value={form.name}
                  onChange={event => setForm(previous => ({
                    ...previous,
                    name: event.target.value
                  }))}
                />
              </label>

              <label>
                Description
                <textarea
                  maxLength={1000}
                  rows={3}
                  value={form.description}
                  onChange={event => setForm(previous => ({
                    ...previous,
                    description: event.target.value
                  }))}
                />
              </label>

              <fieldset>
                <legend>Applicable Risk Levels</legend>
                {LEVELS.map(level => (
                  <label key={level}>
                    <input
                      type="checkbox"
                      checked={form.riskLevels.includes(level)}
                      onChange={() => toggleLevel(level)}
                    />
                    {level}
                  </label>
                ))}
              </fieldset>

              <label>
                Target SLA (hours)
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={form.slaHours}
                  onChange={event => setForm(previous => ({
                    ...previous,
                    slaHours: Number(event.target.value)
                  }))}
                />
              </label>

              <fieldset>
                <legend>Sequential Stages</legend>
                {form.stages.map((role, index) => (
                  <div className="awd-stage-edit" key={index}>
                    <span>Stage {index + 1}</span>
                    <select
                      value={role}
                      onChange={event => setForm(previous => ({
                        ...previous,
                        stages: previous.stages.map((value, i) =>
                          i === index
                            ? event.target.value
                            : value
                        )
                      }))}
                    >
                      {ROLES.map(value => (
                        <option key={value} value={value}>
                          {readableRole(value)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={form.stages.length === 1}
                      onClick={() => setForm(previous => ({
                        ...previous,
                        stages: previous.stages.filter(
                          (_, i) => i !== index
                        )
                      }))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="awd-outline"
                  disabled={form.stages.length >= 5}
                  onClick={() => setForm(previous => ({
                    ...previous,
                    stages: [
                      ...previous.stages,
                      "OperationsReviewer"
                    ]
                  }))}
                >
                  Add Stage
                </button>
              </fieldset>
            </div>

            <div className="awd-modal-actions">
              <button
                type="button"
                className="awd-outline"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="awd-primary"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy ? "Saving..." : "Save Workflow"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ApprovalFlow({ stages }: { stages: string[] }) {
  return (
    <section className="awd-flow">
      <h3>
        <Icon name="account_tree" size={21} />
        Workflow Definition (Approval Flow)
      </h3>

      <div className="awd-flow-steps">
        <div className="awd-flow-terminal">
          <Icon name="play_circle" size={22} />
          <strong>Start</strong>
        </div>

        {stages.map((role, index) => (
          <div className="awd-flow-segment" key={`${role}-${index}`}>
            <div className="awd-flow-connector">
              <span />
              <Icon name="arrow_forward" size={20} />
            </div>

            <div className={`awd-flow-card ${index % 2 === 0
              ? "awd-flow-card-blue"
              : "awd-flow-card-purple"
              }`}>
              <Icon
                name={
                  role === "OperationsReviewer"
                    ? "person_outline"
                    : "verified_user"
                }
                size={27}
              />

              <div>
                <strong>Stage {index + 1}</strong>
                <span>{readableRole(role)}</span>
              </div>
            </div>
          </div>
        ))}

        <div className="awd-flow-connector">
          <span />
          <Icon name="arrow_forward" size={20} />
        </div>

        <div className="awd-flow-terminal">
          <Icon name="check_circle" size={22} />
          <strong>End</strong>
        </div>
      </div>
    </section>
  );
}
