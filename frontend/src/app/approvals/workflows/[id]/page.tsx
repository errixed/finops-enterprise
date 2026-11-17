"use client";

import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import {
  fetchWorkflowDetails,
  saveWorkflowStages,
  saveWorkflowConditions,
  saveWorkflowAssignments,
  saveWorkflowSla,
  type WorkflowDetailsResult,
  type WorkflowCondition,
  type WorkflowStageDefinition
} from "@/services/approval-workflow-details";
import "./workflow-details.css";
import WorkflowSlaTab from "./WorkflowSlaTab";
import WorkflowAuditTab from "./WorkflowAuditTab";

type Tab = "summary" | "stages" | "conditions" | "assignments" | "sla" | "audit";

const tabs: { id: Tab; title: string }[] = [
  { id: "summary", title: "Summary" },
  { id: "stages", title: "Stages" },
  { id: "conditions", title: "Conditions" },
  { id: "assignments", title: "Assignments" },
  { id: "sla", title: "SLA & Escalation" },
  { id: "audit", title: "Audit Trail" }
];

const roles = [
  "OperationsReviewer",
  "SeniorReviewer",
  "ComplianceReviewer"
];

const riskLevels = ["Low", "Medium", "High", "Critical"];

function readable(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function dateTime(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-CA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
}

function Card({
  title,
  icon,
  children
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="wfd-card">
      <h2 className="wfd-card-heading">
        <Icon name={icon} size={24} />
        {title}
      </h2>
      <div className="wfd-card-content">{children}</div>
    </section>
  );
}

function Item({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="wfd-detail-row">
      <strong>{label}</strong>
      <div>{children}</div>
    </div>
  );
}

function Flow({
  stages
}: {
  stages: WorkflowStageDefinition[];
}) {
  return (
    <div className="wfd-flow-scroll">
      <div className="wfd-flow">
        <span className="wfd-flow-end">
          <Icon name="play_circle" size={23} />
          Start
        </span>

        {stages.map((stage, index) => (
          <div className="wfd-flow-segment" key={stage.stageId || index}>
            <Icon name="arrow_forward" size={22} />
            <div className={`wfd-flow-stage ${index % 2 ? "purple" : "blue"}`}>
              <Icon
                name={index % 2 ? "verified_user" : "person_outline"}
                size={29}
              />
              <span>
                <strong>Stage {index + 1}</strong>
                <small>{stage.name || readable(stage.reviewerRole)}</small>
              </span>
            </div>
          </div>
        ))}

        <Icon name="arrow_forward" size={22} />
        <span className="wfd-flow-end">
          <Icon name="check_circle" size={23} />
          End
        </span>
      </div>
    </div>
  );
}

function evaluateCondition(
  condition: WorkflowCondition,
  values: {
    riskLevel: string;
    transactionType: string;
    amount: number;
  }
) {
  const actual = values[condition.field];
  const expected = condition.value;

  if (condition.operator === "in") {
    return Array.isArray(expected) && expected.includes(String(actual));
  }

  if (condition.operator === "eq") return actual === expected;
  if (condition.operator === "ne") return actual !== expected;

  if (typeof actual !== "number" || typeof expected !== "number") {
    return false;
  }

  if (condition.operator === "gt") return actual > expected;
  if (condition.operator === "gte") return actual >= expected;
  if (condition.operator === "lt") return actual < expected;
  if (condition.operator === "lte") return actual <= expected;

  return false;
}

function newCondition(): WorkflowCondition {
  return {
    conditionId: crypto.randomUUID(),
    field: "riskLevel",
    operator: "eq",
    value: "High"
  };
}

function normalizeConditions(
  definition: WorkflowDetailsResult["definition"]
): WorkflowCondition[] {
  if (Array.isArray(definition.conditions)) {
    return definition.conditions.map(condition => ({
      ...condition,
      value: Array.isArray(condition.value)
        ? [...condition.value]
        : condition.value
    }));
  }

  if (!definition.riskLevels.length) {
    return [];
  }

  if (definition.riskLevels.length === 1) {
    return [{
      conditionId: "inferred-risk-level",
      field: "riskLevel",
      operator: "eq",
      value: definition.riskLevels[0]
    }];
  }

  return [{
    conditionId: "inferred-risk-levels",
    field: "riskLevel",
    operator: "in",
    value: [...definition.riskLevels]
  }];
}

function normalizeStages(
  definition: WorkflowDetailsResult["definition"]
): WorkflowStageDefinition[] {
  if (definition.stageDefinitions?.length) {
    return definition.stageDefinitions.map(item => ({ ...item }));
  }

  return definition.stages.map((role, index) => ({
    stageId: `legacy-${index + 1}`,
    stageNumber: index + 1,
    name: readable(role).replace(" Reviewer", " Review"),
    reviewerRole: role,
    decisionType: "ApproveReject",
    slaBusinessDays: Math.max(
      1,
      Math.round(definition.slaHours / Math.max(1, definition.stages.length) / 24)
    )
  }));
}

export default function WorkflowDetailsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [result, setResult] = useState<WorkflowDetailsResult | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  useEffect(() => {
    const requestedTab = new URLSearchParams(
      window.location.search
    ).get("tab");

    if (
      requestedTab === "summary" ||
      requestedTab === "stages" ||
      requestedTab === "conditions" ||
      requestedTab === "assignments" ||
      requestedTab === "sla" ||
      requestedTab === "audit"
    ) {
      setTab(requestedTab);
    }
  }, []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [stages, setStages] = useState<WorkflowStageDefinition[]>([]);
  const [conditions, setConditions] = useState<WorkflowCondition[]>([]);
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [currencies, setCurrencies] = useState<string[]>(["CAD", "USD"]);
  const [assignmentMode, setAssignmentMode] = useState<"RoleBased" | "PoolBased">("RoleBased");
  const [strategy, setStrategy] = useState<"RoundRobin" | "Manual">("Manual");
  const [separation, setSeparation] = useState(true);

  const [settings, setSettings] = useState({
    slaCalculation: "PerStage" as "PerStage" | "EndToEnd",
    autoEscalate: false,
    escalationRole: "ComplianceReviewer",
    allowParallel: false,
    requireReapproval: false,
    notifications: {
      onAssignment: false,
      beforeDue: false,
      onEscalation: false
    }
  });

  const [example, setExample] = useState({
    riskLevel: "High",
    transactionType: "ExternalTransfer",
    amount: 250000
  });

  const load = useCallback(async () => {
    const data = await fetchWorkflowDetails(id);
    const definition = data.definition;

    setResult(data);
    setStages(normalizeStages(definition));
    setConditions(normalizeConditions(definition));
    setLogic(definition.conditionLogic ?? "AND");
    setCurrencies(
      (definition.scope?.currencies ?? ["CAD", "USD"])
        .filter(currency => currency === "CAD" || currency === "USD")
    );
    setAssignmentMode(definition.assignmentMode ?? "RoleBased");
    setStrategy(definition.selectionStrategy ?? "Manual");
    setSeparation(definition.segregationOfDuties ?? true);
    setSettings({
      slaCalculation: definition.slaCalculation ?? "PerStage",
      autoEscalate: definition.autoEscalate ?? false,
      escalationRole: definition.escalationRole ?? "ComplianceReviewer",
      allowParallel: definition.allowParallel ?? false,
      requireReapproval: definition.requireReapproval ?? false,
      notifications: {
        onAssignment: definition.notifications?.onAssignment ?? false,
        beforeDue: definition.notifications?.beforeDue ?? false,
        onEscalation: definition.notifications?.onEscalation ?? false
      }
    });
  }, [id]);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    fetchWorkflowDetails(id)
      .then(data => {
        if (!active) return;

        const definition = data.definition;
        setResult(data);
        setStages(normalizeStages(definition));
        setConditions(normalizeConditions(definition));
        setLogic(definition.conditionLogic ?? "AND");
        setCurrencies(definition.scope?.currencies ?? ["CAD", "USD"]);
        setAssignmentMode(definition.assignmentMode ?? "RoleBased");
        setStrategy(definition.selectionStrategy ?? "Manual");
        setSeparation(definition.segregationOfDuties ?? true);
        setSettings({
          slaCalculation: definition.slaCalculation ?? "PerStage",
          autoEscalate: definition.autoEscalate ?? false,
          escalationRole: definition.escalationRole ?? "ComplianceReviewer",
          allowParallel: definition.allowParallel ?? false,
          requireReapproval: definition.requireReapproval ?? false,
          notifications: {
            onAssignment: definition.notifications?.onAssignment ?? false,
            beforeDue: definition.notifications?.beforeDue ?? false,
            onEscalation: definition.notifications?.onEscalation ?? false
          }
        });
      })
      .catch(err => {
        if (active) setError(
          err instanceof Error ? err.message : "Cannot load workflow."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [id]);

  const definition = result?.definition;
  const canEdit = Boolean(
    definition &&
    !definition.protected &&
    definition.status === "Inactive" &&
    !definition.isDraft
  );

  const evaluation = useMemo(() => {
    if (!definition) return false;

    const effective = conditions.length
      ? conditions.map(item => evaluateCondition(item, example))
      : [definition.riskLevels.includes(example.riskLevel)];

    return logic === "AND"
      ? effective.every(Boolean)
      : effective.some(Boolean);
  }, [conditions, definition, logic, example]);

  const pools = useMemo(() => {
    const actors = result?.actors ?? [];

    return roles.map(role => ({
      role,
      actors: actors.filter(item =>
        item.role === role &&
        item.isActive !== false &&
        !["Inactive", "Disabled"].includes(item.status ?? "")
      )
    }));
  }, [result]);

  function updateStage(index: number, field: keyof WorkflowStageDefinition, value: unknown) {
    setStages(previous => previous.map((stage, current) =>
      current === index ? { ...stage, [field]: value } : stage
    ));
  }

  function moveStage(index: number, direction: -1 | 1) {
    setStages(previous => {
      const next = [...previous];
      const target = index + direction;

      if (target < 0 || target >= next.length) return previous;

      [next[index], next[target]] = [next[target], next[index]];

      return next.map((stage, current) => ({
        ...stage,
        stageNumber: current + 1
      }));
    });
  }

  function updateCondition(
    index: number,
    updates: Partial<WorkflowCondition>
  ) {
    setConditions(previous => previous.map((item, current) =>
      current === index ? { ...item, ...updates } : item
    ));
  }

  async function save(
    action: () => Promise<unknown>,
    success: string
  ) {
    if (busy || !canEdit) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await action();
      await load();
      setMessage(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="wfd-loading">Loading workflow details...</p>;

  if (!definition) {
    return <div className="wfd-error">{error || "Workflow not found."}</div>;
  }

  return (
    <main className="wfd-page">
      <div className="wfd-breadcrumb">
        <Link href="/approvals">Approval Management</Link>
        <Icon name="chevron_right" size={18} />
        <Link href="/approvals/workflows">Approval Workflows</Link>
        <Icon name="chevron_right" size={18} />
        <strong>Workflow Details</strong>
      </div>

      <div className="wfd-title-row">
        <div>
          <h1>
            <Icon name="settings" size={39} />
            Workflow Details — {definition.name || "Untitled Workflow"}
          </h1>
          <p>
            {tab === "audit"
              ? "Recorded definition changes and management activity."
              : definition.description || "Workflow configuration and approval stages."}
          </p>
        </div>
        <span className={`wfd-status ${definition.status.toLowerCase()}`}>
          {definition.status}
        </span>
      </div>

      <nav className="wfd-tabs" aria-label="Workflow detail sections">
        {tabs.map(item => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "active" : ""}
            onClick={() => {
              setTab(item.id);
              setMessage("");
              setError("");
            }}
          >
            {item.title}
          </button>
        ))}
      </nav>

      {error && <div role="alert" className="wfd-error">{error}</div>}
      {message && <div role="status" className="wfd-message">{message}</div>}

      {!canEdit && tab !== "summary" && tab !== "audit" && (
        <p className="wfd-info-note">
          This workflow is read-only. Only completed, inactive custom
          definitions can be modified.
        </p>
      )}

      {tab === "summary" && (
        <div className="wfd-stack">
          <div className="wfd-two-columns">
            <Card title="Workflow Information" icon="description">
              <Item label="Workflow ID:">{definition.definitionId}</Item>
              <Item label="Workflow Code:">{definition.workflowCode || "—"}</Item>
              <Item label="Description:">{definition.description || "—"}</Item>
              <Item label="Risk Levels:">{definition.riskLevels.join(", ") || "—"}</Item>
              <Item label="Transaction Type:">{definition.transactionType || "All"}</Item>
              <Item label="Created By:">{definition.createdBy}</Item>
              <Item label="Created On:">{dateTime(definition.createdAt)}</Item>
              <Item label="Updated On:">{dateTime(definition.updatedAt)}</Item>
            </Card>
            <Card title="Workflow Configuration" icon="shield">
              <Item label="Stages:">{stages.length}</Item>
              <Item label="Total SLA Target:">
                {stages.reduce((sum, item) => sum + item.slaBusinessDays, 0)}
                {" "}business days
              </Item>
              <Item label="SLA Calculation:">{settings.slaCalculation}</Item>
              <Item label="Escalation:">
                {settings.autoEscalate
                  ? readable(settings.escalationRole)
                  : "Not configured"}
              </Item>
              <Item label="Assignment Mode:">{assignmentMode}</Item>
              <Item label="Separation of Duties:">
                {separation ? "Configured" : "Not configured"}
              </Item>
              <Item label="Definition Status:">{definition.status}</Item>
            </Card>
          </div>
          <Card title="Approval Flow" icon="account_tree">
            <Flow stages={stages} />
          </Card>
          <Card title="Notes" icon="info">
            <p>
              These stages describe the workflow definition. Transaction
              approvals continue to follow the active Assignment 3
              approval policy and its enforced reviewer sequence.
            </p>
          </Card>
        </div>
      )}

      {tab === "stages" && (
        <div className="wfd-stack">
          <Card title={`Approval Stages (${stages.length})`} icon="format_list_bulleted">
            <div className="wfd-table-scroll">
              <table className="wfd-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Stage Name</th>
                    <th>Reviewer Role</th>
                    <th>Decision Options</th>
                    <th>SLA</th>
                    <th>Sequence</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((stage, index) => (
                    <tr key={stage.stageId}>
                      <td><span className="wfd-number">{index + 1}</span></td>
                      <td>
                        <input
                          aria-label="Stage name"
                          disabled={!canEdit}
                          value={stage.name}
                          onChange={event =>
                            updateStage(index, "name", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <select
                          aria-label="Reviewer role"
                          disabled={!canEdit}
                          value={stage.reviewerRole}
                          onChange={event =>
                            updateStage(index, "reviewerRole", event.target.value)
                          }
                        >
                          {roles.map(role =>
                            <option key={role} value={role}>{readable(role)}</option>
                          )}
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label="Decision options"
                          disabled={!canEdit}
                          value={stage.decisionType}
                          onChange={event =>
                            updateStage(index, "decisionType", event.target.value)
                          }
                        >
                          <option value="ApproveReject">Approve / Reject</option>
                          <option value="ReviewRecommend">Review / Recommend</option>
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label="Stage SLA"
                          disabled={!canEdit}
                          value={stage.slaBusinessDays}
                          onChange={event =>
                            updateStage(index, "slaBusinessDays", Number(event.target.value))
                          }
                        >
                          {[1, 2, 3, 5, 10, 15, 30].map(days =>
                            <option key={days} value={days}>
                              {days} Business {days === 1 ? "Day" : "Days"}
                            </option>
                          )}
                        </select>
                      </td>
                      <td>
                        <div className="wfd-row-actions">
                          <button
                            type="button"
                            disabled={!canEdit || index === 0}
                            onClick={() => moveStage(index, -1)}
                          >
                            <Icon name="arrow_upward" size={18} />
                          </button>
                          <button
                            type="button"
                            disabled={!canEdit || index === stages.length - 1}
                            onClick={() => moveStage(index, 1)}
                          >
                            <Icon name="arrow_downward" size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canEdit && (
              <div className="wfd-save-row">
                <button
                  className="wfd-primary"
                  disabled={busy}
                  onClick={() => void save(
                    () => saveWorkflowStages(id, stages),
                    "Workflow stages saved."
                  )}
                >
                  Save Stage Changes
                </button>
              </div>
            )}
          </Card>
          <Card title="Approval Flow" icon="account_tree">
            <Flow stages={stages} />
          </Card>
          <Card title="Notes" icon="info">
            <p>
              Stages are processed sequentially in the catalog. Changes to
              a definition do not modify existing transaction approval instances.
            </p>
          </Card>
        </div>
      )}

      {tab === "conditions" && (
        <div className="wfd-stack">
          <div className="wfd-main-aside">
            <div className="wfd-stack">
              <Card title="Activation Conditions" icon="filter_alt">
                <p>
                  The following conditions define the intended applicability
                  of this workflow.
                </p>
                <div className="wfd-table-scroll">
                  <table className="wfd-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Field</th>
                        <th>Operator</th>
                        <th>Value</th>
                        {canEdit && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {conditions.map((condition, index) => (
                        <tr key={condition.conditionId}>
                          <td><span className="wfd-number">{index + 1}</span></td>
                          <td>
                            <select
                              disabled={!canEdit}
                              value={condition.field}
                              onChange={event => {
                                const field = event.target.value as WorkflowCondition["field"];
                                updateCondition(index, {
                                  field,
                                  operator: field === "amount" ? "gte" : "eq",
                                  value: field === "amount" ? 100000 :
                                    field === "riskLevel" ? "High" : "All"
                                });
                              }}
                            >
                              <option value="riskLevel">Risk Level</option>
                              <option value="transactionType">Transaction Type</option>
                              <option value="amount">Transaction Amount</option>
                            </select>
                          </td>
                          <td>
                            <select
                              disabled={!canEdit}
                              value={condition.operator}
                              onChange={event => updateCondition(index, {
                                operator: event.target.value as WorkflowCondition["operator"],
                                value: event.target.value === "in"
                                  ? [String(Array.isArray(condition.value)
                                    ? condition.value[0] : condition.value)]
                                  : Array.isArray(condition.value)
                                    ? condition.value[0] ?? ""
                                    : condition.value
                              })}
                            >
                              <option value="eq">Equals</option>
                              <option value="ne">Not Equals</option>
                              {condition.field === "amount" ? (
                                <>
                                  <option value="gte">Greater Than or Equal</option>
                                  <option value="gt">Greater Than</option>
                                  <option value="lte">Less Than or Equal</option>
                                  <option value="lt">Less Than</option>
                                </>
                              ) : (
                                <option value="in">In</option>
                              )}
                            </select>
                          </td>

                          <td>
                            {condition.field === "amount" ? (
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                disabled={!canEdit}
                                value={Number(condition.value)}
                                onChange={event =>
                                  updateCondition(index, {
                                    value: Number(event.target.value)
                                  })
                                }
                              />
                            ) : condition.operator === "in" ? (
                              <div className="wfd-multi-value">
                                {(condition.field === "riskLevel"
                                  ? riskLevels
                                  : ["InternalTransfer", "ExternalTransfer"]
                                ).map(option => {
                                  const values = Array.isArray(condition.value)
                                    ? condition.value
                                    : [String(condition.value)];

                                  return (
                                    <label key={option}>
                                      <input
                                        type="checkbox"
                                        disabled={!canEdit}
                                        checked={values.includes(option)}
                                        onChange={event => {
                                          const updatedValues = event.target.checked
                                            ? [...new Set([...values, option])]
                                            : values.filter(value => value !== option);

                                          updateCondition(index, {
                                            value: updatedValues
                                          });
                                        }}
                                      />
                                      {readable(option)}
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <select
                                disabled={!canEdit}
                                value={String(condition.value)}
                                onChange={event =>
                                  updateCondition(index, {
                                    value: event.target.value
                                  })
                                }
                              >
                                {(condition.field === "riskLevel"
                                  ? riskLevels
                                  : ["All", "InternalTransfer", "ExternalTransfer"]
                                ).map(value => (
                                  <option key={value} value={value}>
                                    {readable(value)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>

                          {canEdit && (
                            <td>
                              <button
                                className="wfd-trash"
                                onClick={() => setConditions(previous =>
                                  previous.filter((_, i) => i !== index)
                                )}
                              >
                                <Icon name="delete" size={19} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {!conditions.length && (
                        <tr>
                          <td colSpan={canEdit ? 5 : 4}>
                            No explicit activation conditions configured.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {canEdit && (
                  <div className="wfd-save-row">
                    <button
                      className="wfd-outline"
                      onClick={() => {
                        if (conditions.length >= 20) return;

                        if (
                          conditions.length === 1 &&
                          conditions[0].field === "riskLevel"
                        ) {
                          setLogic("OR");
                        }

                        setConditions(previous => [
                          ...previous,
                          newCondition()
                        ]);
                      }}
                      disabled={conditions.length >= 20}
                    >
                      <Icon name="add" size={18} /> Add Condition
                    </button>
                    <button
                      className="wfd-primary"
                      disabled={busy}
                      onClick={() => void save(
                        () => saveWorkflowConditions(id, conditions, logic, currencies),
                        "Conditions saved."
                      )}
                    >
                      Save Conditions
                    </button>
                  </div>
                )}
              </Card>
              <Card title="Evaluation Preview" icon="track_changes">
                <div className="wfd-example">
                  <label>Risk Level
                    <select
                      value={example.riskLevel}
                      onChange={event => setExample(previous => ({
                        ...previous, riskLevel: event.target.value
                      }))}
                    >
                      {riskLevels.map(level => <option key={level}>{level}</option>)}
                    </select>
                  </label>
                  <label>Transaction Type
                    <select
                      value={example.transactionType}
                      onChange={event => setExample(previous => ({
                        ...previous, transactionType: event.target.value
                      }))}
                    >
                      <option value="InternalTransfer">Internal Transfer</option>
                      <option value="ExternalTransfer">External Transfer</option>
                    </select>
                  </label>
                  <label>Amount (CAD)
                    <input
                      type="number"
                      min={0}
                      value={example.amount}
                      onChange={event => setExample(previous => ({
                        ...previous, amount: Number(event.target.value)
                      }))}
                    />
                  </label>
                </div>
                <div className={`wfd-evaluation ${evaluation ? "pass" : "fail"}`}>
                  <Icon
                    name={evaluation ? "check_circle" : "cancel"}
                    size={24}
                  />
                  <div>
                    <strong>
                      {evaluation
                        ? "Preview: Conditions satisfied"
                        : "Preview: Conditions not satisfied"}
                    </strong>
                    <p>
                      Local configuration preview only. This does not create
                      or approve a transaction.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
            <div className="wfd-stack">
              <Card title="Condition Logic" icon="code">
                {(["AND", "OR"] as const).map(value => (
                  <label className="wfd-radio-line" key={value}>
                    <input
                      type="radio"
                      name="workflow-condition-logic"
                      value={value}
                      disabled={!canEdit}
                      checked={logic === value}
                      onChange={() => setLogic(value)}
                    />
                    {value === "AND"
                      ? "All conditions must be met (AND)"
                      : "Any condition can be met (OR)"}
                  </label>
                ))}
              </Card>
              <Card title="Applicable Scope" icon="layers">
                <Item label="Transaction Types:">
                  {readable(definition.transactionType ?? "All")}
                </Item>
                <Item label="Risk Levels:">
                  {definition.riskLevels.join(", ")}
                </Item>
                <Item label="Currencies:">
                  <div className="wfd-checks">
                    {["CAD", "USD"].map(value => (
                      <label key={value}>
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={currencies.includes(value)}
                          onChange={event => setCurrencies(previous =>
                            event.target.checked
                              ? [...previous, value]
                              : previous.filter(item => item !== value)
                          )}
                        />
                        {value}
                      </label>
                    ))}
                  </div>
                </Item>
                <p className="wfd-muted">
                  Additional client/account scope restrictions are not
                  configured in the current catalog.
                </p>
              </Card>
            </div>
          </div>
        </div>
      )}

      {tab === "assignments" && (
        <div className="wfd-main-aside">
          <div className="wfd-stack">
            <Card title="Reviewer Assignments" icon="groups">
              <p>Reviewer roles determine who is eligible to review each stage.</p>
              <div className="wfd-table-scroll">
                <table className="wfd-table">
                  <thead>
                    <tr>
                      <th>Stage</th>
                      <th>Reviewer Role</th>
                      <th>Assignment Type</th>
                      <th>Reviewer Pool</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stages.map((stage, index) => (
                      <tr key={stage.stageId}>
                        <td>{index + 1}. {stage.name}</td>
                        <td>{readable(stage.reviewerRole)}</td>
                        <td>{assignmentMode === "PoolBased" ? "Pool-based" : "Role-based"}</td>
                        <td>
                          {pools.find(pool => pool.role === stage.reviewerRole)?.actors.length ?? 0}
                          {" "}eligible actors
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card title="Assignment Flow" icon="account_tree">
              <Flow stages={stages} />
            </Card>

            <Card title="Configuration Details" icon="info">
              <div className="wfd-assignment-config">
                <div className="wfd-assignment-config-item">
                  <strong>Assignment Mode</strong>
                  {canEdit ? (
                    <select
                      value={assignmentMode}
                      onChange={event =>
                        setAssignmentMode(
                          event.target.value as typeof assignmentMode
                        )
                      }
                    >
                      <option value="RoleBased">Role-based</option>
                      <option value="PoolBased">Pool-based</option>
                    </select>
                  ) : (
                    <span>
                      {assignmentMode === "PoolBased" ? "Pool-based" : "Role-based"}
                    </span>
                  )}
                </div>

                <div className="wfd-assignment-config-item">
                  <strong>Selection Strategy</strong>
                  {canEdit ? (
                    <select
                      value={strategy}
                      onChange={event =>
                        setStrategy(event.target.value as typeof strategy)
                      }
                    >
                      <option value="Manual">Manual</option>
                      <option value="RoundRobin">Round-Robin</option>
                    </select>
                  ) : (
                    <span>
                      {strategy === "RoundRobin" ? "Round-Robin" : "Manual"}
                    </span>
                  )}
                </div>

                <div className="wfd-assignment-config-item">
                  <strong>Segregation of Duties</strong>
                  <label className={`wfd-config-pill ${separation ? "enabled" : "disabled"}`}>
                    {canEdit ? (
                      <input
                        type="checkbox"
                        checked={separation}
                        onChange={event => setSeparation(event.target.checked)}
                      />
                    ) : null}
                    {separation ? "Enabled" : "Disabled"}
                  </label>
                </div>

                <div className="wfd-assignment-config-item">
                  <strong>Auto Reassignment</strong>
                  <span className="wfd-config-pill neutral">
                    Not configured
                  </span>
                </div>

                <div className="wfd-assignment-config-item">
                  <strong>Allowed Actions</strong>
                  <span>Approve / Reject</span>
                </div>
              </div>

              {canEdit && (
                <div className="wfd-save-row">
                  <button
                    type="button"
                    className="wfd-primary"
                    disabled={busy}
                    onClick={() =>
                      void save(
                        () =>
                          saveWorkflowAssignments(
                            id,
                            assignmentMode,
                            strategy,
                            separation
                          ),
                        "Assignment configuration saved."
                      )
                    }
                  >
                    Save Assignments
                  </button>
                </div>
              )}
            </Card>

          </div>
          <div className="wfd-stack">
            <Card title="Reviewer Pools" icon="groups">
              <table className="wfd-table">
                <thead>
                  <tr><th>Role / Pool</th><th>Members</th><th>View</th></tr>
                </thead>
                <tbody>
                  {pools.map(pool => (
                    <tr key={pool.role}>
                      <td>{readable(pool.role)}</td>
                      <td>{pool.actors.length}</td>
                      <td>
                        <details>
                          <summary>View</summary>
                          {pool.actors.length
                            ? pool.actors.map(actor =>
                              <p key={actor.actorId}>
                                {actor.name} ({actor.actorId})
                              </p>
                            )
                            : <p>No eligible actors</p>}
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title="Assignment Rules" icon="settings">
              <div className="wfd-rules">
                <p><Icon name="check" size={18} /> Reviewer roles determine eligibility.</p>
                <p><Icon name="check" size={18} /> Sequential stages are preserved.</p>
                <p><Icon name="check" size={18} /> Separation of duties is enforced by the existing approval engine.</p>
                <p><Icon name="info" size={18} /> Round-robin selection is catalog configuration, not an active automatic scheduler.</p>
              </div>
            </Card>
          </div>
        </div>
      )}
      {tab === "sla" && (
        <WorkflowSlaTab
          definition={definition}
          stages={stages}
          canEdit={canEdit}
          onSaved={load}
        />
      )}
      {tab === "audit" && result && (
        <WorkflowAuditTab
          definition={definition}
          events={result.audit}
        />
      )}
    </main>
  );
}