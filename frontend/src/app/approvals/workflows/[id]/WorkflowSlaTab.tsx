
"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";
import { API_BASE_URL } from "../../../../../config";
import type {
  DetailedWorkflowDefinition,
  WorkflowStageDefinition
} from "@/services/approval-workflow-details";
import "./workflow-sla.css";

type EscalationRule = {
  ruleId: string;
  trigger: "SlaBreach" | "SecondBreach" | "AgeThreshold";
  action: "Escalate" | "ComplianceReview" | "PriorityEscalation";
  escalateTo: string;
  notification: "None" | "InApp" | "EmailInApp";
  ageBusinessDays: number;
};

type Notifications = {
  onAssignment: boolean;
  beforeDue: boolean;
  onEscalation: boolean;
};

type SlaConfig = {
  slaCalculation: "PerStage" | "EndToEnd";
  autoEscalate: boolean;
  escalationRole: string;
  allowParallel: boolean;
  requireReapproval: boolean;
  businessHours: {
    timeZone: string;
    start: string;
    end: string;
    weekdays: number[];
  };
  notifications: Notifications;
  escalationRules: EscalationRule[];
};

type Metrics = {
  onTime: number | null;
  atRisk: number | null;
  breached: number | null;
  sampleSize: number;
};

const roles = [
  "OperationsReviewer",
  "SeniorReviewer",
  "ComplianceReviewer"
];

function readable(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function defaultConfig(
  definition: DetailedWorkflowDefinition
): SlaConfig {
  return {
    slaCalculation: definition.slaCalculation ?? "PerStage",
    autoEscalate: definition.autoEscalate ?? false,
    escalationRole: definition.escalationRole ?? "ComplianceReviewer",
    allowParallel: definition.allowParallel ?? false,
    requireReapproval: definition.requireReapproval ?? false,
    businessHours: definition.businessHours ?? {
      timeZone: "America/Toronto",
      start: "09:00",
      end: "17:00",
      weekdays: [1, 2, 3, 4, 5]
    },
    notifications: {
      onAssignment: definition.notifications?.onAssignment ?? false,
      beforeDue: definition.notifications?.beforeDue ?? false,
      onEscalation: definition.notifications?.onEscalation ?? false
    },
    escalationRules: definition.escalationRules?.map(rule => ({
      ...rule
    })) ?? []
  };
}

function Panel({
  title,
  icon,
  subtitle,
  children
}: {
  title: string;
  icon: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="wsla-panel">
      <header className="wsla-panel-heading">
        <Icon name={icon} size={26} />
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      <div className="wsla-panel-body">{children}</div>
    </section>
  );
}

function MetricsPanel({ metrics }: { metrics: Metrics }) {
  const cards = [
    {
      label: "On Time",
      value: metrics.onTime,
      icon: "check_circle",
      type: "success"
    },
    {
      label: "At Risk",
      value: metrics.atRisk,
      icon: "schedule",
      type: "warning"
    },
    {
      label: "Breached",
      value: metrics.breached,
      icon: "warning",
      type: "danger"
    }
  ];

  return (
    <Panel title="SLA Metrics (Last 30 Days)" icon="timer">
      <div className="wsla-metrics">
        {cards.map(card => (
          <div
            className={`wsla-metric wsla-metric-${card.type}`}
            key={card.label}
          >
            <Icon name={card.icon} size={34} />
            <strong>{card.label}</strong>
            <b>
              {card.value === null
                ? "N/A"
                : `${card.value.toFixed(1)}%`}
            </b>
          </div>
        ))}
      </div>
      <p className="wsla-metric-caption">
        {metrics.sampleSize > 0
          ? `Based on ${metrics.sampleSize} eligible stage records.`
          : "No verified stage-level SLA measurements are available for this definition."}
      </p>
    </Panel>
  );
}

function Timeline({
  stages
}: {
  stages: WorkflowStageDefinition[];
}) {
  const totalDays = stages.reduce(
    (total, stage) => total + stage.slaBusinessDays,
    0
  );

  return (
    <div className="wsla-timeline-scroll">
      <div className="wsla-timeline">
        <div className="wsla-timeline-node wsla-green">
          <Icon name="play_circle" size={27} />
          <span>
            <strong>Submitted</strong>
            <small>Day 0</small>
          </span>
        </div>

        {stages.map((stage, index) => (
          <div className="wsla-timeline-step" key={stage.stageId}>
            <Icon name="arrow_forward" size={20} />
            <div className={`wsla-timeline-node ${
              index % 2 ? "wsla-purple" : "wsla-blue"
            }`}>
              <Icon
                name={index % 2 ? "verified_user" : "person_outline"}
                size={26}
              />
              <span>
                <strong>{stage.name}</strong>
                <small>
                  ≤ {stage.slaBusinessDays} Business
                  {stage.slaBusinessDays === 1 ? " Day" : " Days"}
                </small>
              </span>
            </div>
          </div>
        ))}

        <div className="wsla-timeline-step">
          <Icon name="arrow_forward" size={20} />
          <div className="wsla-timeline-node wsla-green">
            <Icon name="check_circle" size={27} />
            <span>
              <strong>Decision</strong>
              <small>≤ {totalDays} Business Days</small>
            </span>
          </div>
        </div>
      </div>

      <div className="wsla-timeline-total">
        Total Workflow SLA: {totalDays} Business
        {totalDays === 1 ? " Day" : " Days"}
      </div>
    </div>
  );
}

export default function WorkflowSlaTab({
  definition,
  stages,
  canEdit,
  onSaved
}: {
  definition: DetailedWorkflowDefinition;
  stages: WorkflowStageDefinition[];
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const [config, setConfig] = useState<SlaConfig>(
    () => defaultConfig(definition)
  );
  const [metrics, setMetrics] = useState<Metrics>({
    onTime: null,
    atRisk: null,
    breached: null,
    sampleSize: 0
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setConfig(defaultConfig(definition));
  }, [definition.definitionId, definition.updatedAt]);

  useEffect(() => {
    let active = true;

    const url =
      `${API_BASE_URL}/api/v1/approval-workflow-sla/${encodeURIComponent(
        definition.definitionId
      )}/metrics`;

    fetch(url, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Metrics unavailable");
        return response.json() as Promise<Metrics>;
      })
      .then(data => {
        if (active) setMetrics(data);
      })
      .catch(() => {
        if (active) {
          setMetrics({
            onTime: null,
            atRisk: null,
            breached: null,
            sampleSize: 0
          });
        }
      });

    return () => {
      active = false;
    };
  }, [definition.definitionId]);

  const change = <K extends keyof SlaConfig>(
    key: K,
    value: SlaConfig[K]
  ) => setConfig(previous => ({ ...previous, [key]: value }));

  const updateRule = (
    id: string,
    updates: Partial<EscalationRule>
  ) => {
    change(
      "escalationRules",
      config.escalationRules.map(rule =>
        rule.ruleId === id ? { ...rule, ...updates } : rule
      )
    );
  };

  async function save() {
    if (busy || !canEdit) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/approval-workflow-sla/${encodeURIComponent(
          definition.definitionId
        )}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Actor-Id": "DEMO-POLICY-ADMIN"
          },
          body: JSON.stringify(config)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message ??
          data.message ??
          "Unable to save SLA settings."
        );
      }

      await onSaved();
      setMessage("SLA and escalation configuration saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const formatHours = `${config.businessHours.start}–${config.businessHours.end}`;

  return (
    <div className="wsla-root">
      {error && <p className="wsla-error" role="alert">{error}</p>}
      {message && <p className="wsla-success" role="status">{message}</p>}

      <div className="wsla-top-grid">
        <Panel
          title="Service Level Agreements (SLA)"
          icon="schedule"
          subtitle="Define the target review time for each approval stage."
        >
          <div className="wsla-table-scroll">
            <table className="wsla-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Stage</th>
                  <th>SLA Target</th>
                  <th>Business Hours</th>
                  <th>On Breach</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage, index) => (
                  <tr key={stage.stageId}>
                    <td><span className="wsla-index">{index + 1}</span></td>
                    <td><strong>{stage.name}</strong></td>
                    <td>
                      {stage.slaBusinessDays} Business
                      {stage.slaBusinessDays === 1 ? " Day" : " Days"}
                    </td>
                    <td>
                      Mon–Fri, {formatHours}
                      <small>America/Toronto</small>
                    </td>
                    <td>
                      {config.autoEscalate
                        ? <span className="wsla-breach-pill">
                            Escalate to {readable(config.escalationRole)}
                          </span>
                        : <span className="wsla-muted">Not configured</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <MetricsPanel metrics={metrics} />
      </div>

      <div className="wsla-bottom-grid">
        <Panel
          title="Escalation Rules"
          icon="account_tree"
          subtitle="Configure actions when an approval is not completed within the SLA."
        >
          <div className="wsla-table-scroll">
            <table className="wsla-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Trigger (Condition)</th>
                  <th>Escalation Action</th>
                  <th>Escalate To</th>
                  <th>Notification</th>
                  {canEdit && <th />}
                </tr>
              </thead>
              <tbody>
                {config.escalationRules.map((rule, index) => (
                  <tr key={rule.ruleId}>
                    <td><span className="wsla-index">{index + 1}</span></td>
                    <td>
                      <select
                        disabled={!canEdit}
                        value={rule.trigger}
                        onChange={event => updateRule(rule.ruleId, {
                          trigger: event.target.value as EscalationRule["trigger"]
                        })}
                      >
                        <option value="SlaBreach">No decision within SLA</option>
                        <option value="SecondBreach">Second SLA breach</option>
                        <option value="AgeThreshold">Transaction age threshold</option>
                      </select>
                      {rule.trigger === "AgeThreshold" && (
                        <label className="wsla-age">
                          Days
                          <input
                            type="number"
                            min={1}
                            max={30}
                            disabled={!canEdit}
                            value={rule.ageBusinessDays}
                            onChange={event => updateRule(rule.ruleId, {
                              ageBusinessDays: Number(event.target.value)
                            })}
                          />
                        </label>
                      )}
                    </td>
                    <td>
                      <select
                        disabled={!canEdit}
                        value={rule.action}
                        onChange={event => updateRule(rule.ruleId, {
                          action: event.target.value as EscalationRule["action"]
                        })}
                      >
                        <option value="Escalate">Automatic Escalation</option>
                        <option value="ComplianceReview">Escalate for Compliance</option>
                        <option value="PriorityEscalation">Priority Escalation</option>
                      </select>
                    </td>
                    <td>
                      <select
                        disabled={!canEdit}
                        value={rule.escalateTo}
                        onChange={event => updateRule(rule.ruleId, {
                          escalateTo: event.target.value
                        })}
                      >
                        {roles.map(role => (
                          <option value={role} key={role}>
                            {readable(role)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        disabled={!canEdit}
                        value={rule.notification}
                        onChange={event => updateRule(rule.ruleId, {
                          notification: event.target.value as EscalationRule["notification"]
                        })}
                      >
                        <option value="None">None</option>
                        <option value="InApp">In-App</option>
                        <option value="EmailInApp">Email + In-App</option>
                      </select>
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          type="button"
                          className="wsla-delete"
                          aria-label="Remove escalation rule"
                          onClick={() => change(
                            "escalationRules",
                            config.escalationRules.filter(
                              item => item.ruleId !== rule.ruleId
                            )
                          )}
                        >
                          <Icon name="delete" size={19} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!config.escalationRules.length && (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="wsla-empty">
                      No custom escalation rules configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {canEdit && (
            <div className="wsla-add-row">
              <button
                type="button"
                className="wsla-outline"
                disabled={config.escalationRules.length >= 10}
                onClick={() => change("escalationRules", [
                  ...config.escalationRules,
                  {
                    ruleId: crypto.randomUUID(),
                    trigger: "SlaBreach",
                    action: "Escalate",
                    escalateTo: "SeniorReviewer",
                    notification: "InApp",
                    ageBusinessDays: 3
                  }
                ])}
              >
                <Icon name="add" size={19} />
                Add Escalation Rule
              </button>
            </div>
          )}
          <p className="wsla-muted">
            Escalation rules are stored as definition settings. Automatic
            breach detection and notification delivery are not yet enabled.
          </p>
        </Panel>

        <div className="wsla-right-stack">
          <Panel title="Notification Settings" icon="notifications">
            <div className="wsla-notifications">
              {([
                ["onAssignment", "Notify reviewer when a transaction is assigned."],
                ["beforeDue", "Send SLA reminder 4 hours before due time."],
                ["onEscalation", "Notify on escalation and breach."]
              ] as const).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={config.notifications[key]}
                    onChange={event => change("notifications", {
                      ...config.notifications,
                      [key]: event.target.checked
                    })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </Panel>

          <Panel title="SLA Timeline (Configured)" icon="calendar_month">
            <Timeline stages={stages} />
          </Panel>
        </div>
      </div>

      {canEdit && (
        <div className="wsla-footer">
          <label>
            <input
              type="checkbox"
              checked={config.autoEscalate}
              onChange={event =>
                change("autoEscalate", event.target.checked)
              }
            />
            Enable automatic escalation configuration
          </label>

          <button
            type="button"
            className="wsla-primary"
            disabled={busy}
            onClick={() => void save()}
          >
            <Icon name="save" size={19} />
            {busy ? "Saving..." : "Save SLA & Escalation"}
          </button>
        </div>
      )}
    </div>
  );
}
