
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
  deleteWizardDraft,
  getWizardWorkflows,
  loadWizardDraft,
  saveWizardDraft,
  type AvailableWorkflow,
  type NotificationEvent,
  type PolicyMapping,
  type PolicyRule,
  type PolicyWizardConfig,
  type RiskLevel,
  type Role,
  type StageSla
} from "@/services/approval-policy-wizard";
import "./create-policy.css";

type Step = 1 | 2 | 3 | 4 | 5;

const LEVELS: RiskLevel[] = ["Low", "Medium", "High", "Critical"];
const ROLES: Role[] = [
  "OperationsReviewer",
  "SeniorReviewer",
  "ComplianceReviewer"
];

const SEQUENCES: Record<RiskLevel, Role[]> = {
  Low: [],
  Medium: ["OperationsReviewer"],
  High: ["OperationsReviewer", "SeniorReviewer"],
  Critical: ["SeniorReviewer", "ComplianceReviewer"]
};

const EVENTS: Array<[NotificationEvent, string, string[]]> = [
  ["ApprovalRequestCreated", "Approval Request Created", ["Reviewer(s)"]],
  ["ApprovalAssigned", "Approval Assigned", ["Reviewer(s)"]],
  ["ApprovalDecision", "Approval Decision (Approved/Rejected)", ["Requestor", "Stakeholders"]],
  ["SlaWarning", "SLA Breach Warning (80% of SLA)", ["Reviewer(s)", "Owner"]],
  ["SlaBreach", "SLA Breach (Escalation Triggered)", ["Escalation Reviewer(s)", "Owner"]],
  ["PolicyStatusChanged", "Policy Activated / Deactivated", ["Operations", "Compliance"]]
];

const TRANSACTION_TYPES = [
  "InternalTransfer",
  "ExternalTransfer",
  "CrossBorder",
  "LargeTransfer"
];

const STEP_NAMES = [
  "Policy Details",
  "Risk & Rules",
  "Workflows",
  "SLA & Escalation",
  "Notifications & Review"
];

function readable(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function initialConfig(): PolicyWizardConfig {
  const mappings: PolicyMapping[] = LEVELS.map(riskLevel => ({
    riskLevel,
    workflowId: "",
    workflowType: "Sequential",
    stages: [...SEQUENCES[riskLevel]]
  }));

  return {
    details: {
      name: "",
      version: "v1.0",
      description: "",
      policyType: "TransactionApproval",
      effectiveDate: "",
      owner: "Operations"
    },
    riskRanges: [
      { level: "Low", min: 0, max: 24, description: "Minimal risk. No approval required." },
      { level: "Medium", min: 25, max: 49, description: "Moderate risk. Operations review." },
      { level: "High", min: 50, max: 74, description: "Elevated risk. Operations and Senior review." },
      { level: "Critical", min: 75, max: 100, description: "Significant risk. Senior and Compliance review." }
    ],
    rules: [],
    ruleLogic: "AND",
    mappings,
    segregationOfDuties: true,
    stageSlas: mappings.flatMap(mapping =>
      mapping.stages.map((role, index) => ({
        riskLevel: mapping.riskLevel,
        stageNumber: index + 1,
        role,
        target: mapping.riskLevel === "Critical" ? 8 : 4,
        unit: "Hours",
        hoursMode: "Business"
      }))
    ),
    escalation: {
      trigger: "SlaNotMet",
      escalateTo: "NextLevel",
      delay: 2,
      unit: "Hours",
      notifyPrevious: true,
      autoAssignAlternate: false
    },
    monitoring: {
      trackKpis: true,
      includeReports: true,
      alertOnBreach: true
    },
    notifications: EVENTS.map(([event, , recipients]) => ({
      event,
      inApp: true,
      email: true,
      recipients
    })),
    review: {
      requireApproval: true,
      notifyOnChange: true,
      complianceReview: false
    }
  };
}

function Section({
  title,
  icon,
  description,
  children
}: {
  title: string;
  icon: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pcw-section">
      <header className="pcw-section-title">
        <Icon name={icon} size={25} />
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Guidance({
  title,
  lines
}: {
  title: string;
  lines: string[];
}) {
  return (
    <section className="pcw-guidance">
      <h3><Icon name="info" size={23} />{title}</h3>
      {lines.map(line => (
        <p key={line}>
          <Icon name="check" size={17} />
          {line}
        </p>
      ))}
    </section>
  );
}

function Level({ value }: { value: RiskLevel }) {
  return (
    <span className={`pcw-level pcw-${value.toLowerCase()}`}>
      <span className="pcw-dot" /> {value}
    </span>
  );
}

function PolicyWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");

  const [step, setStep] = useState<Step>(1);
  const [config, setConfig] = useState<PolicyWizardConfig>(initialConfig);
  const [workflows, setWorkflows] = useState<AvailableWorkflow[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<RiskLevel>("High");
  const [loading, setLoading] = useState(Boolean(draftId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let active = true;

    getWizardWorkflows()
      .then(items => {
        if (active) setWorkflows(items);
      })
      .catch(err => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load workflows");
        }
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!draftId) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    loadWizardDraft(draftId)
      .then(saved => {
        if (!active) return;
        setConfig(saved.wizardConfig);
        setCompleted(saved.wizardCompleted);
      })
      .catch(err => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to open draft");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [draftId]);

  const currentMapping = useMemo(
    () => config.mappings.find(item => item.riskLevel === selectedLevel),
    [config.mappings, selectedLevel]
  );

  function changeDetails(
    key: keyof PolicyWizardConfig["details"],
    value: string
  ) {
    setConfig(previous => ({
      ...previous,
      details: { ...previous.details, [key]: value }
    }));
  }

  function changeRange(
    level: RiskLevel,
    key: "min" | "max" | "description",
    value: number | string
  ) {
    setConfig(previous => ({
      ...previous,
      riskRanges: previous.riskRanges.map(range =>
        range.level === level ? { ...range, [key]: value } : range
      )
    }));
  }

  function updateRule(id: string, changes: Partial<PolicyRule>) {
    setConfig(previous => ({
      ...previous,
      rules: previous.rules.map(rule =>
        rule.ruleId === id ? { ...rule, ...changes } : rule
      )
    }));
  }

  function updateMapping(level: RiskLevel, changes: Partial<PolicyMapping>) {
    setConfig(previous => ({
      ...previous,
      mappings: previous.mappings.map(mapping =>
        mapping.riskLevel === level
          ? { ...mapping, ...changes }
          : mapping
      )
    }));
  }

  function changeStages(level: RiskLevel, stages: Role[]) {
    setConfig(previous => ({
      ...previous,
      mappings: previous.mappings.map(mapping =>
        mapping.riskLevel === level
          ? { ...mapping, stages }
          : mapping
      ),
      stageSlas: [
        ...previous.stageSlas.filter(sla => sla.riskLevel !== level),
        ...stages.map((role, index) => {
          const existing = previous.stageSlas.find(
            sla => sla.riskLevel === level &&
              sla.stageNumber === index + 1 &&
              sla.role === role
          );

          return existing ?? {
            riskLevel: level,
            stageNumber: index + 1,
            role,
            target: 4,
            unit: "Hours" as const,
            hoursMode: "Business" as const
          };
        })
      ]
    }));
  }

  function updateSla(
    level: RiskLevel,
    stageNumber: number,
    changes: Partial<StageSla>
  ) {
    setConfig(previous => ({
      ...previous,
      stageSlas: previous.stageSlas.map(sla =>
        sla.riskLevel === level && sla.stageNumber === stageNumber
          ? { ...sla, ...changes }
          : sla
      )
    }));
  }

  function validateStep(targetStep: Step): string {
    if (targetStep >= 2) {
      if (
        config.details.name.trim().length < 3 ||
        !config.details.description.trim() ||
        !config.details.effectiveDate
      ) return "Complete the required fields in Policy Details.";
    }

    if (targetStep >= 3) {
      const ranges = [...config.riskRanges].sort((a, b) => a.min - b.min);

      if (
        ranges.length !== 4 ||
        ranges[0].min !== 0 ||
        ranges[3].max !== 100 ||
        ranges.some((range, index) =>
          range.min > range.max ||
          (index > 0 && range.min !== ranges[index - 1].max + 1)
        )
      ) return "Risk score ranges must cover 0–100 without gaps or overlaps.";
    }

    if (targetStep >= 4) {
      if (
        LEVELS.some(level => !config.mappings.some(mapping =>
          mapping.riskLevel === level &&
          JSON.stringify(mapping.stages) === JSON.stringify(SEQUENCES[level])
        ))
      ) return "Reviewer stages must follow the Assignment 3 risk matrix.";
    }

    if (targetStep >= 5) {
      if (
        config.stageSlas.some(sla => !Number.isFinite(sla.target) || sla.target <= 0)
      ) return "All stage SLA targets must be greater than zero.";
    }

    return "";
  }

  function goTo(target: Step) {
    if (target > step) {
      const problem = validateStep(target);
      if (problem) {
        setError(problem);
        return;
      }
    }

    setError("");
    setMessage("");
    setStep(target);
  }

  async function persist(complete: boolean) {
    if (busy) return;

    if (complete) {
      const problem = validateStep(5);
      if (problem) {
        setError(problem);
        return;
      }
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const saved = await saveWizardDraft(
        config,
        draftId ?? undefined,
        complete
      );

      setCompleted(complete);

      if (complete) {
        router.push("/approvals/policies");
        router.refresh();
      } else {
        setMessage("Draft saved successfully.");
        if (!draftId) {
          router.replace(
            `/approvals/policies/new?draft=${encodeURIComponent(saved.policyId)}`
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save draft.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDraft() {
    if (!draftId || !window.confirm("Delete this policy draft permanently?")) {
      return;
    }

    setBusy(true);

    try {
      await deleteWizardDraft(draftId);
      router.push("/approvals/policies");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="pcw-page">Loading policy draft...</div>;
  }

  return (
    <main className="pcw-page">
      <div className="pcw-breadcrumb">
        <Link href="/approvals">Approval Management</Link>
        <Icon name="chevron_right" size={18} />
        <Link href="/approvals/policies">Approval Policies</Link>
        <Icon name="chevron_right" size={18} />
        <strong>{draftId ? "Edit Approval Policy Draft" : "New Approval Policy"}</strong>
      </div>

      <div className="pcw-heading">
        <h1>
          <Icon name="layers" size={34} />
          {draftId ? "Edit Approval Policy (Draft)" : "New Approval Policy (Draft)"}
        </h1>
        <p>
          Create a new approval policy using a step-by-step wizard.
          Define rules, workflows, SLAs, notifications, and review settings.
        </p>
      </div>

      <nav className="pcw-steps" aria-label="Approval policy creation steps">
        {STEP_NAMES.map((name, index) => {
          const number = (index + 1) as Step;

          return (
            <div className="pcw-step-wrap" key={name}>
              {index > 0 && <Icon name="arrow_forward" size={19} />}
              <button
                type="button"
                className={number === step ? "active" : number < step ? "done" : ""}
                aria-current={number === step ? "step" : undefined}
                onClick={() => goTo(number)}
              >
                <span className="pcw-step-number">
                  {number < step ? <Icon name="check" size={17} /> : number}
                </span>
                <span>{name}</span>
              </button>
            </div>
          );
        })}
      </nav>

      {error && <div className="pcw-error" role="alert">{error}</div>}
      {message && <div className="pcw-success" role="status">{message}</div>}
      {completed && <div className="pcw-success">This draft has passed full wizard validation.</div>}

      {step === 1 && (
        <div className="pcw-stack">
          <Section
            title="Step 1 of 5 – Policy Details"
            icon="description"
            description="Provide the basic information for the approval policy."
          >
            <div className="pcw-details-grid">
              <label className="pcw-wide">
                Policy Name <b>*</b>
                <input
                  maxLength={150}
                  value={config.details.name}
                  onChange={event => changeDetails("name", event.target.value)}
                  placeholder="Corporate Transaction Approval Policy"
                />
              </label>
              <label>
                Version <b>*</b>
                <input
                  value={config.details.version}
                  onChange={event => changeDetails("version", event.target.value)}
                />
              </label>
              <label className="pcw-full">
                Description <b>*</b>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={config.details.description}
                  onChange={event => changeDetails("description", event.target.value)}
                />
              </label>
              <label>
                Policy Type <b>*</b>
                <select
                  value={config.details.policyType}
                  onChange={event => changeDetails("policyType", event.target.value)}
                >
                  <option value="TransactionApproval">Transaction Approval</option>
                  <option value="AccountChange">Account Change</option>
                  <option value="Exception">Exception</option>
                </select>
              </label>
              <label>
                Effective Date <b>*</b>
                <input
                  type="date"
                  value={config.details.effectiveDate}
                  onChange={event => changeDetails("effectiveDate", event.target.value)}
                />
              </label>
              <label>
                Owner <b>*</b>
                <input
                  value={config.details.owner}
                  onChange={event => changeDetails("owner", event.target.value)}
                />
              </label>
              <label>
                Status
                <span className="pcw-draft-label">Draft</span>
              </label>
            </div>
          </Section>
          <Guidance title="Policy Guidelines" lines={[
            "Define a clear and unique policy name and version.",
            "Describe the business scope and purpose of the policy.",
            "Select the policy type, effective date, and responsible owner.",
            "This policy will remain Draft until a separate approval and activation process."
          ]} />
        </div>
      )}

      {step === 2 && (
        <div className="pcw-stack">
          <Section
            title="Step 2 of 5 – Risk & Rules"
            icon="description"
            description="Define risk levels, score ranges, and business conditions."
          >
            <div className="pcw-columns">
              <div className="pcw-inner">
                <h3><Icon name="verified_user" size={23} /> Risk Levels & Score Ranges</h3>
                <div className="pcw-table-scroll">
                  <table className="pcw-table">
                    <thead>
                      <tr><th>Risk Level</th><th>Score Range (0–100)</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      {config.riskRanges.map(range => (
                        <tr key={range.level}>
                          <td><Level value={range.level} /></td>
                          <td>
                            <div className="pcw-range">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={range.min}
                                onChange={event => changeRange(
                                  range.level, "min", Number(event.target.value)
                                )}
                              />
                              –
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={range.max}
                                onChange={event => changeRange(
                                  range.level, "max", Number(event.target.value)
                                )}
                              />
                            </div>
                          </td>
                          <td>
                            <input
                              value={range.description}
                              onChange={event => changeRange(
                                range.level, "description", event.target.value
                              )}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="pcw-hint">
                  Assignment 3 uses the four Low, Medium, High, and Critical levels.
                  Edit their ranges without overlap or gaps.
                </p>
              </div>

              <div className="pcw-inner">
                <h3><Icon name="filter_alt" size={23} /> Approval Rules (Conditions)</h3>
                <p>Define criteria contributing to policy risk evaluation.</p>
                <div className="pcw-rules">
                  {config.rules.map((rule, index) => (
                    <div className="pcw-rule" key={rule.ruleId}>
                      <span className="pcw-rule-index">{index + 1}</span>
                      <select
                        aria-label="Rule field"
                        value={rule.field}
                        onChange={event => {
                          const field = event.target.value as PolicyRule["field"];
                          updateRule(rule.ruleId, {
                            field,
                            operator: field === "transactionAmount" ? "gte" : "eq",
                            value: field === "transactionAmount"
                              ? 100000
                              : field === "transactionType"
                                ? "InternalTransfer" : "High"
                          });
                        }}
                      >
                        <option value="transactionAmount">Transaction Amount</option>
                        <option value="transactionType">Transaction Type</option>
                        <option value="clientRiskRating">Client Risk Rating</option>
                      </select>
                      <select
                        aria-label="Rule operator"
                        value={rule.operator}
                        onChange={event => {
                          const operator = event.target.value as PolicyRule["operator"];
                          const currentValue = Array.isArray(rule.value)
                            ? rule.value[0] : rule.value;
                          updateRule(rule.ruleId, {
                            operator,
                            value: operator === "in"
                              ? [String(currentValue)] : currentValue
                          });
                        }}
                      >
                        <option value="eq">Equals (=)</option>
                        <option value="ne">Not Equals (≠)</option>
                        {rule.field === "transactionAmount" ? (
                          <>
                            <option value="gte">≥</option>
                            <option value="gt">&gt;</option>
                            <option value="lte">≤</option>
                            <option value="lt">&lt;</option>
                          </>
                        ) : <option value="in">In</option>}
                      </select>
                      {rule.field === "transactionAmount" ? (
                        <input
                          aria-label="Rule amount"
                          type="number"
                          min={0}
                          value={Number(rule.value)}
                          onChange={event => updateRule(
                            rule.ruleId, { value: Number(event.target.value) }
                          )}
                        />
                      ) : rule.operator === "in" ? (
                        <div className="pcw-multi">
                          {(rule.field === "transactionType"
                            ? TRANSACTION_TYPES : LEVELS
                          ).map(option => {
                            const values = Array.isArray(rule.value)
                              ? rule.value : [String(rule.value)];

                            return (
                              <label key={option}>
                                <input
                                  type="checkbox"
                                  checked={values.includes(option)}
                                  onChange={event => updateRule(rule.ruleId, {
                                    value: event.target.checked
                                      ? [...new Set([...values, option])]
                                      : values.filter(value => value !== option)
                                  })}
                                />
                                {readable(option)}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <select
                          aria-label="Rule value"
                          value={String(rule.value)}
                          onChange={event => updateRule(
                            rule.ruleId, { value: event.target.value }
                          )}
                        >
                          {(rule.field === "transactionType"
                            ? TRANSACTION_TYPES : LEVELS
                          ).map(value => (
                            <option key={value} value={value}>{readable(value)}</option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        className="pcw-remove"
                        aria-label="Remove rule"
                        onClick={() => setConfig(previous => ({
                          ...previous,
                          rules: previous.rules.filter(item =>
                            item.ruleId !== rule.ruleId
                          )
                        }))}
                      >
                        <Icon name="close" size={18} />
                      </button>
                    </div>
                  ))}
                  {!config.rules.length && <p>No additional conditions configured.</p>}
                </div>

                <div className="pcw-rule-footer">
                  <button
                    type="button"
                    className="pcw-outline"
                    disabled={config.rules.length >= 30}
                    onClick={() => setConfig(previous => ({
                      ...previous,
                      rules: [
                        ...previous.rules,
                        {
                          ruleId: crypto.randomUUID(),
                          field: "transactionAmount",
                          operator: "gte",
                          value: 100000
                        }
                      ]
                    }))}
                  >
                    <Icon name="add" size={19} /> Add Rule
                  </button>
                  <div className="pcw-inline">
                    <strong>Rule Logic:</strong>
                    {(["AND", "OR"] as const).map(value => (
                      <label key={value}>
                        <input
                          type="radio"
                          name="pcw-rule-logic"
                          checked={config.ruleLogic === value}
                          onChange={() => setConfig(previous => ({
                            ...previous, ruleLogic: value
                          }))}
                        />
                        {value === "AND" ? "All (AND)" : "Any (OR)"}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Section>
          <Guidance title="Configuration Guidance" lines={[
            "Define clear risk levels with non-overlapping score ranges (0–100).",
            "Add business rules that describe the policy's risk criteria.",
            "Use AND to require all conditions or OR to match any condition.",
            "Rules are draft policy configuration and do not replace the active risk engine."
          ]} />
        </div>
      )}

      {step === 3 && (
        <div className="pcw-stack">
          <Section
            title="Step 3 of 5 – Workflows"
            icon="account_tree"
            description="Define approval workflows, reviewer roles, and stage sequence by risk level."
          >
            <div className="pcw-workflow-grid">
              <div className="pcw-stack">
                <div className="pcw-inner">
                  <h3><Icon name="verified" size={22} /> Workflow Assignment by Risk Level</h3>
                  <div className="pcw-table-scroll">
                    <table className="pcw-table">
                      <thead>
                        <tr><th>Risk Level</th><th>Approval Workflow</th><th>Approval Sequence</th></tr>
                      </thead>
                      <tbody>
                        {config.mappings.map(mapping => (
                          <tr
                            key={mapping.riskLevel}
                            className={selectedLevel === mapping.riskLevel ? "pcw-row-selected" : ""}
                            onClick={() => setSelectedLevel(mapping.riskLevel)}
                          >
                            <td><Level value={mapping.riskLevel} /></td>
                            <td>
                              <select
                                aria-label={`${mapping.riskLevel} workflow`}
                                value={mapping.workflowId}
                                onChange={event => {
                                  const workflow = workflows.find(item =>
                                    item.definitionId === event.target.value
                                  );
                                  updateMapping(mapping.riskLevel, {
                                    workflowId: event.target.value,
                                    stages: workflow?.stages as Role[] ??
                                      [...SEQUENCES[mapping.riskLevel]]
                                  });
                                  if (workflow) {
                                    changeStages(mapping.riskLevel,
                                      workflow.stages as Role[]);
                                  }
                                }}
                              >
                                <option value="">Use required risk sequence</option>
                                {workflows.filter(item =>
                                  item.riskLevels.includes(mapping.riskLevel) &&
                                  JSON.stringify(item.stages) ===
                                    JSON.stringify(SEQUENCES[mapping.riskLevel])
                                ).map(item => (
                                  <option key={item.definitionId} value={item.definitionId}>
                                    {item.name} ({item.definitionId})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <div className="pcw-role-list">
                                {mapping.stages.length
                                  ? mapping.stages.map((role, index) => (
                                    <span className="pcw-role" key={index}>
                                      {readable(role)}
                                    </span>
                                  ))
                                  : <span className="pcw-no-approval">No Approval Required</span>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <Guidance title="Workflow Guidelines" lines={[
                  "Select an existing workflow or use the required risk-level sequence.",
                  "Low requires no approval; Medium requires Operations Review.",
                  "High requires Operations then Senior; Critical requires Senior then Compliance.",
                  "Enable segregation of duties for multi-stage reviews."
                ]} />
              </div>
              <div className="pcw-inner">
                <h3><Icon name="settings" size={22} /> Workflow Configuration</h3>
                <label className="pcw-field">
                  Selected Workflow
                  <select
                    value={currentMapping?.workflowId ?? ""}
                    onChange={event => {
                      const workflow = workflows.find(item =>
                        item.definitionId === event.target.value
                      );
                      updateMapping(selectedLevel, {
                        workflowId: event.target.value
                      });
                      if (workflow) {
                        changeStages(selectedLevel, workflow.stages as Role[]);
                      }
                    }}
                  >
                    <option value="">Use required risk sequence</option>
                    {workflows.filter(item =>
                      item.riskLevels.includes(selectedLevel) &&
                      JSON.stringify(item.stages) ===
                        JSON.stringify(SEQUENCES[selectedLevel])
                    ).map(item => (
                      <option key={item.definitionId} value={item.definitionId}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pcw-field">
                  Workflow Type
                  <select
                    value={currentMapping?.workflowType ?? "Sequential"}
                    onChange={event => updateMapping(selectedLevel, {
                      workflowType: event.target.value as PolicyMapping["workflowType"]
                    })}
                  >
                    <option value="Sequential">Sequential (Multi-Stage)</option>
                    <option value="Parallel">Parallel (Configuration Only)</option>
                  </select>
                </label>
                <strong>Stages (in Order)</strong>
                {currentMapping?.stages.map((role, index) => (
                  <div className="pcw-stage-editor" key={`${index}-${role}`}>
                    <span>{index + 1}</span>
                    <select
                      aria-label={`Reviewer stage ${index + 1}`}
                      value={role}
                      onChange={event => {
                        const next = [...currentMapping.stages];
                        next[index] = event.target.value as Role;
                        changeStages(selectedLevel, next);
                      }}
                    >
                      {ROLES.map(option => (
                        <option value={option} key={option}>{readable(option)}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label="Remove stage"
                      onClick={() => changeStages(selectedLevel,
                        currentMapping.stages.filter((_, i) => i !== index)
                      )}
                    >
                      <Icon name="delete" size={18} />
                    </button>
                  </div>
                ))}
                <button
                  className="pcw-outline"
                  type="button"
                  disabled={selectedLevel === "Low" || (currentMapping?.stages.length ?? 0) >= 5}
                  onClick={() => changeStages(selectedLevel, [
                    ...(currentMapping?.stages ?? []),
                    "OperationsReviewer"
                  ])}
                >
                  <Icon name="add" size={17} /> Add Stage
                </button>
                <label className="pcw-checkline">
                  <input
                    type="checkbox"
                    checked={config.segregationOfDuties}
                    onChange={event => setConfig(previous => ({
                      ...previous,
                      segregationOfDuties: event.target.checked
                    }))}
                  />
                  Enforce Segregation of Duties (SOD)
                </label>
                <p className="pcw-hint">
                  Completed policies must preserve Assignment 3's reviewer matrix.
                  This draft cannot change active transaction approval routing.
                </p>
              </div>
            </div>
          </Section>
        </div>
      )}

      {step === 4 && (
        <div className="pcw-sla-grid">
          <div className="pcw-stack">
            <Section
              title="Step 4 of 5 – SLA & Escalation"
              icon="schedule"
              description="Define stage SLA targets and escalation configuration."
            >
              <div className="pcw-inner">
                <h3><Icon name="timer" size={22} /> Stage SLAs</h3>
                <div className="pcw-table-scroll">
                  <table className="pcw-table">
                    <thead>
                      <tr>
                        <th>Risk Level</th>
                        <th>Stage / Reviewer</th>
                        <th>SLA Target</th>
                        <th>Business Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {LEVELS.map(level => {
                        const entries = config.stageSlas
                          .filter(item => item.riskLevel === level)
                          .sort((a, b) => a.stageNumber - b.stageNumber);
                        return entries.length ? entries.map((sla, index) => (
                          <tr key={`${level}-${sla.stageNumber}`}>
                            {index === 0 && (
                              <td rowSpan={entries.length}>
                                <Level value={level} />
                              </td>
                            )}
                            <td><span className="pcw-role">{readable(sla.role)}</span></td>
                            <td>
                              <div className="pcw-sla-input">
                                <input
                                  type="number"
                                  min={0.25}
                                  max={720}
                                  step={0.25}
                                  value={sla.target}
                                  onChange={event => updateSla(
                                    level, sla.stageNumber,
                                    { target: Number(event.target.value) }
                                  )}
                                />
                                <select
                                  value={sla.unit}
                                  onChange={event => updateSla(
                                    level, sla.stageNumber,
                                    { unit: event.target.value as StageSla["unit"] }
                                  )}
                                >
                                  <option value="Hours">Hours</option>
                                  <option value="Days">Days</option>
                                </select>
                              </div>
                            </td>
                            <td>
                              <select
                                value={sla.hoursMode}
                                onChange={event => updateSla(
                                  level, sla.stageNumber,
                                  { hoursMode: event.target.value as StageSla["hoursMode"] }
                                )}
                              >
                                <option value="Business">Business Hours (8×5)</option>
                                <option value="Calendar">Calendar Hours (24×7)</option>
                              </select>
                            </td>
                          </tr>
                        )) : (
                          <tr key={level}>
                            <td><Level value={level} /></td>
                            <td colSpan={3}>— No approval required —</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
            <Guidance title="Configuration Guidance" lines={[
              "Set an approval SLA for each configured reviewer stage.",
              "Define escalation rules when targets are not met.",
              "Configure notifications for SLA breaches and escalation.",
              "Select business hours or calendar hours as required."
            ]} />
          </div>

          <div className="pcw-stack">
            <Section
              title="Escalation Rules"
              icon="trending_up"
              description="Define actions when an approval is not completed within its SLA."
            >
              <div className="pcw-field-grid">
                <label>Escalation Trigger
                  <select
                    value={config.escalation.trigger}
                    onChange={event => setConfig(previous => ({
                      ...previous,
                      escalation: {
                        ...previous.escalation,
                        trigger: event.target.value as "SlaNotMet" | "AtRisk"
                      }
                    }))}
                  >
                    <option value="SlaNotMet">SLA Not Met</option>
                    <option value="AtRisk">At Risk (80% of SLA)</option>
                  </select>
                </label>
                <label>Escalate To
                  <select
                    value={config.escalation.escalateTo}
                    onChange={event => setConfig(previous => ({
                      ...previous,
                      escalation: {
                        ...previous.escalation,
                        escalateTo: event.target.value as typeof previous.escalation.escalateTo
                      }
                    }))}
                  >
                    <option value="NextLevel">Next Level Reviewer</option>
                    {ROLES.map(role => (
                      <option key={role} value={role}>{readable(role)}</option>
                    ))}
                  </select>
                </label>
                <label>Escalation Delay
                  <div className="pcw-sla-input">
                    <input
                      type="number"
                      min={0}
                      max={720}
                      value={config.escalation.delay}
                      onChange={event => setConfig(previous => ({
                        ...previous,
                        escalation: {
                          ...previous.escalation,
                          delay: Number(event.target.value)
                        }
                      }))}
                    />
                    <select
                      value={config.escalation.unit}
                      onChange={event => setConfig(previous => ({
                        ...previous,
                        escalation: {
                          ...previous.escalation,
                          unit: event.target.value as "Hours" | "Days"
                        }
                      }))}
                    >
                      <option value="Hours">Hours</option>
                      <option value="Days">Days</option>
                    </select>
                  </div>
                </label>
              </div>
              <label className="pcw-checkline">
                <input
                  type="checkbox"
                  checked={config.escalation.notifyPrevious}
                  onChange={event => setConfig(previous => ({
                    ...previous,
                    escalation: {
                      ...previous.escalation,
                      notifyPrevious: event.target.checked
                    }
                  }))}
                />
                Notify Previous Reviewer
              </label>
              <label className="pcw-checkline">
                <input
                  type="checkbox"
                  checked={config.escalation.autoAssignAlternate}
                  onChange={event => setConfig(previous => ({
                    ...previous,
                    escalation: {
                      ...previous.escalation,
                      autoAssignAlternate: event.target.checked
                    }
                  }))}
                />
                Auto-Assign to Alternate Reviewer (if unavailable)
              </label>
            </Section>

            <Section title="SLA Monitoring" icon="bar_chart">
              {([
                ["trackKpis", "Track SLA Performance (KPIs)"],
                ["includeReports", "Include in Policy Reports"],
                ["alertOnBreach", "Alert on Breach (Email & In-App)"]
              ] as const).map(([key, label]) => (
                <label className="pcw-checkline" key={key}>
                  <input
                    type="checkbox"
                    checked={config.monitoring[key]}
                    onChange={event => setConfig(previous => ({
                      ...previous,
                      monitoring: {
                        ...previous.monitoring,
                        [key]: event.target.checked
                      }
                    }))}
                  />
                  {label}
                </label>
              ))}
            </Section>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="pcw-review-grid">
          <div className="pcw-stack">
            <Section
              title="Step 5 of 5 – Notifications & Review"
              icon="notifications"
              description="Configure notifications and review the policy before saving the draft."
            >
              <div className="pcw-inner">
                <h3><Icon name="mail" size={22} /> Notification Settings</h3>
                <div className="pcw-table-scroll">
                  <table className="pcw-table">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>In-App</th>
                        <th>Email</th>
                        <th>Role Recipients</th>
                      </tr>
                    </thead>
                    <tbody>
                      {config.notifications.map(item => {
                        const label = EVENTS.find(event =>
                          event[0] === item.event
                        )?.[1] ?? item.event;

                        return (
                          <tr key={item.event}>
                            <td>{label}</td>
                            <td>
                              <input
                                type="checkbox"
                                checked={item.inApp}
                                onChange={event => setConfig(previous => ({
                                  ...previous,
                                  notifications: previous.notifications.map(row =>
                                    row.event === item.event
                                      ? { ...row, inApp: event.target.checked }
                                      : row
                                  )
                                }))}
                              />
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                checked={item.email}
                                onChange={event => setConfig(previous => ({
                                  ...previous,
                                  notifications: previous.notifications.map(row =>
                                    row.event === item.event
                                      ? { ...row, email: event.target.checked }
                                      : row
                                  )
                                }))}
                              />
                            </td>
                            <td>
                              <input
                                value={item.recipients.join(", ")}
                                aria-label={`Recipients for ${label}`}
                                onChange={event => setConfig(previous => ({
                                  ...previous,
                                  notifications: previous.notifications.map(row =>
                                    row.event === item.event
                                      ? {
                                          ...row,
                                          recipients: event.target.value
                                            .split(",")
                                            .map(value => value.trim())
                                            .filter(Boolean)
                                        }
                                      : row
                                  )
                                }))}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>

            <Section title="Additional Review Settings" icon="settings">
              {([
                ["requireApproval", "Require Approval Policy Review before Activation"],
                ["notifyOnChange", "Enable Policy Change Notifications"],
                ["complianceReview", "Include Policy in Periodic Compliance Review"]
              ] as const).map(([key, label]) => (
                <label key={key} className="pcw-checkline">
                  <input
                    type="checkbox"
                    checked={config.review[key]}
                    onChange={event => setConfig(previous => ({
                      ...previous,
                      review: {
                        ...previous.review,
                        [key]: event.target.checked
                      }
                    }))}
                  />
                  {label}
                </label>
              ))}
            </Section>
          </div>

          <div className="pcw-stack">
            <Section title="Policy Review Summary" icon="description">
              <div className="pcw-summary">
                <div><strong>Policy Name:</strong><span>{config.details.name || "—"}</span></div>
                <div><strong>Version:</strong><span>{config.details.version} (Draft)</span></div>
                <div><strong>Policy Type:</strong><span>{readable(config.details.policyType)}</span></div>
                <div><strong>Effective Date:</strong><span>{config.details.effectiveDate || "—"}</span></div>
                <div><strong>Owner:</strong><span>{config.details.owner}</span></div>
                <div><strong>Rules:</strong><span>{config.rules.length} ({config.ruleLogic})</span></div>
              </div>
            </Section>
            <Section title="Risk & Approval Mapping" icon="verified_user">
              <div className="pcw-table-scroll">
                <table className="pcw-table">
                  <thead>
                    <tr><th>Risk Level</th><th>Score Range</th><th>Approval Workflow</th></tr>
                  </thead>
                  <tbody>
                    {config.mappings.map(mapping => {
                      const range = config.riskRanges.find(item =>
                        item.level === mapping.riskLevel
                      );

                      return (
                        <tr key={mapping.riskLevel}>
                          <td><Level value={mapping.riskLevel} /></td>
                          <td>{range ? `${range.min}–${range.max}` : "—"}</td>
                          <td>
                            {mapping.stages.length
                              ? mapping.stages.map(readable).join(" → ")
                              : "No approval required"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        </div>
      )}

      <footer className="pcw-footer">
        <div className="pcw-footer-left">
          <Link href="/approvals/policies" className="pcw-outline">
            <Icon name="close" size={18} /> Cancel
          </Link>
          {draftId && (
            <button
              type="button"
              className="pcw-delete"
              disabled={busy}
              onClick={() => void removeDraft()}
            >
              <Icon name="delete" size={18} /> Delete Draft
            </button>
          )}
        </div>
        <div className="pcw-footer-right">
          <button
            type="button"
            className="pcw-outline"
            disabled={step === 1 || busy}
            onClick={() => goTo((step - 1) as Step)}
          >
            <Icon name="arrow_back" size={18} /> Previous
          </button>
          <button
            type="button"
            className="pcw-outline"
            disabled={busy}
            onClick={() => void persist(false)}
          >
            <Icon name="save" size={18} />
            {draftId ? "Save Changes" : "Save as Draft"}
          </button>
          {step < 5 ? (
            <button
              className="pcw-primary"
              type="button"
              onClick={() => goTo((step + 1) as Step)}
            >
              Next: {STEP_NAMES[step]}
              <Icon name="arrow_forward" size={19} />
            </button>
          ) : (
            <button
              className="pcw-primary"
              type="button"
              disabled={busy}
              onClick={() => void persist(true)}
            >
              Review & Create Draft
              <Icon name="check" size={19} />
            </button>
          )}
        </div>
      </footer>
    </main>
  );
}

export default function NewApprovalPolicyPage() {
  return (
    <Suspense fallback={<p>Loading policy wizard...</p>}>
      <PolicyWizard />
    </Suspense>
  );
}
