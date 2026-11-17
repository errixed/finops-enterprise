"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CustomRuleDefinition,
  CustomRuleField,
  CustomRuleOperator,
  RiskRule
} from "@/services/risk-policies";
import {
  type CustomRuleInput,
  listCustomRules,
  createCustomRule,
  updateCustomRule,
  deleteCustomRule
} from "@/services/custom-risk-rules";
import "./custom-rules-manager.css";

const fields: {
  value: CustomRuleField;
  label: string;
  kind: "number" | "percentage" | "client" | "account";
}[] = [
  { value: "amount", label: "Transaction Amount", kind: "number" },
  { value: "recentCount", label: "24-hour Transaction Count", kind: "number" },
  { value: "recentVolume", label: "24-hour Transfer Volume", kind: "number" },
  { value: "balancePercent", label: "Source Balance Utilization (%)", kind: "percentage" },
  { value: "sourceClientStatus", label: "Source Client Status", kind: "client" },
  { value: "destinationClientStatus", label: "Destination Client Status", kind: "client" },
  { value: "sourceAccountStatus", label: "Source Account Status", kind: "account" },
  { value: "destinationAccountStatus", label: "Destination Account Status", kind: "account" }
];

const emptyRule: CustomRuleInput = {
  name: "",
  points: 10,
  field: "amount",
  operator: "gte",
  value: 10000
};

function isStatus(field: CustomRuleField) {
  return field.toLowerCase().includes("status");
}

function defaultValue(field: CustomRuleField): number | string {
  if (field.toLowerCase().includes("clientstatus")) return "Inactive";
  if (field.toLowerCase().includes("accountstatus")) return "Frozen";
  return field === "balancePercent" ? 50 : 1;
}

interface Props {
  selected: RiskRule[];
  onChange: (rules: RiskRule[]) => void;
}

export default function CustomRulesManager({
  selected,
  onChange
}: Props) {
  const [catalog, setCatalog] = useState<CustomRuleDefinition[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomRuleInput>(emptyRule);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const result = await listCustomRules();
    setCatalog(result);
  }, []);

  useEffect(() => {
    let active = true;

    listCustomRules()
      .then(result => {
        if (active) setCatalog(result);
      })
      .catch(err => {
        if (active) {
          setError(err instanceof Error ? err.message : "Cannot load rules.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function selectedRule(id: string) {
    return selected.some(rule => rule.ruleId === id);
  }

  function toggle(rule: CustomRuleDefinition, checked: boolean) {
    if (checked) {
      onChange([
        ...selected.filter(item => item.ruleId !== rule.ruleId),
        {
          ruleId: rule.ruleId,
          name: rule.name,
          points: rule.points,
          field: rule.field,
          operator: rule.operator,
          value: rule.value
        }
      ]);
    } else {
      onChange(selected.filter(item => item.ruleId !== rule.ruleId));
    }
  }

  function startCreate() {
    setEditingId("new");
    setForm({ ...emptyRule });
    setError("");
  }

  function startEdit(rule: CustomRuleDefinition) {
    setEditingId(rule.ruleId);
    setForm({
      name: rule.name,
      points: rule.points,
      field: rule.field,
      operator: rule.operator,
      value: rule.value
    });
    setError("");
  }

  function changeField(field: CustomRuleField) {
    setForm(previous => ({
      ...previous,
      field,
      operator: isStatus(field) ? "eq" : "gte",
      value: defaultValue(field)
    }));
  }

  async function save() {
    if (busy) return;

    if (!form.name.trim()) {
      setError("Enter a custom rule name.");
      return;
    }

    if (
      !Number.isInteger(form.points) ||
      form.points < 0 ||
      form.points > 100
    ) {
      setError("Points must be between 0 and 100.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const input: CustomRuleInput = {
        ...form,
        name: form.name.trim()
      };

      const saved = editingId === "new"
        ? await createCustomRule(input)
        : await updateCustomRule(editingId!, input);

      if (selectedRule(saved.ruleId)) {
        onChange(selected.map(rule =>
          rule.ruleId === saved.ruleId
            ? {
                ruleId: saved.ruleId,
                name: saved.name,
                points: saved.points,
                field: saved.field,
                operator: saved.operator,
                value: saved.value
              }
            : rule
        ));
      }

      await refresh();
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(rule: CustomRuleDefinition) {
    if (busy) return;

    if (!window.confirm(
      `Delete "${rule.name}" from the custom rule library? Existing saved policy versions will retain their snapshots.`
    )) return;

    setBusy(true);
    setError("");

    try {
      await deleteCustomRule(rule.ruleId);
      onChange(selected.filter(item => item.ruleId !== rule.ruleId));
      await refresh();
      if (editingId === rule.ruleId) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  const config = fields.find(item => item.value === form.field)!;
  const numeric = config.kind === "number" || config.kind === "percentage";

  const options = config.kind === "client"
    ? ["Active", "Inactive", "Suspended"]
    : ["Active", "Frozen", "Closed"];

  return (
    <section className="crm-panel">
      <header className="crm-header">
        <div>
          <h2>Custom Risk Rules</h2>
          <p>Create rules and select which ones belong to this draft policy.</p>
        </div>
        <button type="button" onClick={startCreate}>
          + Add Custom Rule
        </button>
      </header>

      {error && <p role="alert" className="crm-error">{error}</p>}

      <div className="crm-table-scroll">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Include</th>
              <th>Rule ID</th>
              <th>Rule Name</th>
              <th>Points</th>
              <th>Condition</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>Loading custom rules...</td></tr>
            ) : catalog.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  No custom rules yet. Select Add Custom Rule to create one.
                </td>
              </tr>
            ) : catalog.map(rule => (
              <tr key={rule.ruleId}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedRule(rule.ruleId)}
                    onChange={event => toggle(rule, event.target.checked)}
                    aria-label={`Include ${rule.name}`}
                  />
                </td>
                <td>{rule.ruleId}</td>
                <td>{rule.name}</td>
                <td>+{rule.points}</td>
                <td>
                  {rule.field} {rule.operator} {String(rule.value)}
                </td>
                <td>
                  <span className={selectedRule(rule.ruleId)
                    ? "crm-included"
                    : "crm-excluded"}>
                    {selectedRule(rule.ruleId) ? "Included" : "Not Included"}
                  </span>
                </td>
                <td>
                  <div className="crm-actions">
                    <button type="button" onClick={() => startEdit(rule)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="crm-delete"
                      onClick={() => void remove(rule)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId !== null && (
        <div className="crm-editor">
          <h3>{editingId === "new" ? "Create Custom Rule" : "Edit Custom Rule"}</h3>

          <div className="crm-fields">
            <label>
              Rule Name
              <input
                value={form.name}
                maxLength={120}
                onChange={event => setForm(previous => ({
                  ...previous,
                  name: event.target.value
                }))}
              />
            </label>

            <label>
              Condition Field
              <select
                value={form.field}
                onChange={event => changeField(
                  event.target.value as CustomRuleField
                )}
              >
                {fields.map(field => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Comparison
              <select
                value={form.operator}
                onChange={event => setForm(previous => ({
                  ...previous,
                  operator: event.target.value as CustomRuleOperator
                }))}
              >
                {numeric ? (
                  <>
                    <option value="gte">Greater than or equal</option>
                    <option value="gt">Greater than</option>
                  </>
                ) : (
                  <>
                    <option value="eq">Equals</option>
                    <option value="ne">Not equals</option>
                  </>
                )}
              </select>
            </label>

            <label>
              {numeric ? "Threshold Value" : "Target Status"}
              {numeric ? (
                <input
                  type="number"
                  min={0}
                  max={config.kind === "percentage" ? 100 : undefined}
                  step={1}
                  value={form.value}
                  onChange={event => setForm(previous => ({
                    ...previous,
                    value: Number(event.target.value)
                  }))}
                />
              ) : (
                <select
                  value={String(form.value)}
                  onChange={event => setForm(previous => ({
                    ...previous,
                    value: event.target.value
                  }))}
                >
                  {options.map(value => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              )}
            </label>

            <label>
              Risk Points
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={form.points}
                onChange={event => setForm(previous => ({
                  ...previous,
                  points: Number(event.target.value)
                }))}
              />
            </label>
          </div>

          <div className="crm-editor-actions">
            <button type="button" onClick={() => setEditingId(null)}>
              Cancel
            </button>
            <button type="button" onClick={() => void save()} disabled={busy}>
              {busy ? "Saving..." : "Save Custom Rule"}
            </button>
          </div>
        </div>
      )}

      <p className="crm-note">
        Selected rules are copied into the policy at creation or draft save.
        Library edits do not change previously activated policy versions.
      </p>
    </section>
  );
}