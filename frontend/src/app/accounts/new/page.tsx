"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { type Client, getClients } from "@/services/clients";
import {
  type AccountInput,
  formatMoney,
  parseMoney,
  registerAccount
} from "@/services/accounts";
import { ENUMS, ROUTES } from "../../../../config";
import { Icon, StatusBadge } from "@/components/ui";
import "../account-profile.css";
import "./create-account.css";

type Step = 1 | 2 | 3;

type FormData = {
  clientId: string;
  accountType: string;
  accountName: string;
  currency: string;
  purpose: string;
  status: string;
  openDate: string;
  openingBalance: string;
  creditLimit: string;
  allowTransactions: boolean;
  allowInternationalTransactions: boolean;
  requireDualApproval: boolean;
  temporaryAccount: boolean;
  notes: string;
};

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initialForm(): FormData {
  return {
    clientId: "",
    accountType: "",
    accountName: "",
    currency: "CAD",
    purpose: "",
    status: "Active",
    openDate: localDate(),
    openingBalance: "0.00",
    creditLimit: "",
    allowTransactions: true,
    allowInternationalTransactions: true,
    requireDualApproval: false,
    temporaryAccount: false,
    notes: ""
  };
}

function prettyDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-CA", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
}

function money(value: string, currency: string) {
  if (!value.trim()) return "Not configured";

  try {
    return formatMoney(parseMoney(value), currency || "CAD");
  } catch {
    return "Invalid amount";
  }
}

function Section({
  title,
  icon,
  children,
  action
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="acw-panel">
      <header className="acw-panel-header">
        <Icon name={icon} size={23} />
        <h2>{title}</h2>
        {action && <div className="acw-panel-action">{action}</div>}
      </header>
      <div className="acw-panel-body">{children}</div>
    </section>
  );
}

function SummaryRow({
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

export default function AccountRegistrationPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [clientLoading, setClientLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const selectedClient = useMemo(
    () => clients.find(client => client.clientId === form.clientId),
    [clients, form.clientId]
  );

  const clientOptions = useMemo(
    () => clients.filter(client =>
      client.status === "Active" &&
      client.clientType !== "Individual" &&
      `${client.companyName} ${client.clientId} ${client.registrationNumber}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ),
    [clients, search]
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const first = await getClients({ page: 1, pageSize: 100 });
        const results = [...first.data];

        for (let page = 2; page <= first.pagination.totalPages; page++) {
          const response = await getClients({ page, pageSize: 100 });
          results.push(...response.data);
        }

        if (active) setClients(results);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Unable to load clients."
          );
        }
      } finally {
        if (active) setClientLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  function update<K extends keyof FormData>(
    key: K,
    value: FormData[K]
  ) {
    setForm(current => ({ ...current, [key]: value }));
    setError("");
  }

  function validateClient() {
    if (!selectedClient) return "Select a client to continue.";
    if (selectedClient.status !== "Active") {
      return "Only active clients can create accounts.";
    }
    if (selectedClient.clientType === "Individual") {
      return "This workflow requires a corporate client.";
    }
    return "";
  }

  function validateDetails() {
    if (!ENUMS.ACCOUNT_TYPES.includes(form.accountType)) {
      return "Select a valid account type.";
    }

    if (!form.accountName.trim()) return "Account name is required.";
    if (form.accountName.trim().length > 120) {
      return "Account name cannot exceed 120 characters.";
    }

    if (!ENUMS.CURRENCIES.includes(form.currency)) {
      return "Select a valid currency.";
    }

    if (!form.purpose.trim()) return "Account purpose is required.";
    if (form.purpose.trim().length > 250) {
      return "Account purpose cannot exceed 250 characters.";
    }

    if (!ENUMS.ACCOUNT_STATUSES.includes(form.status)) {
      return "Select a valid account status.";
    }

    if (!form.openDate) return "Opening date is required.";

    const date = new Date(`${form.openDate}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== form.openDate
    ) {
      return "Enter a valid opening date.";
    }

    if (form.openDate > localDate()) {
      return "Opening date cannot be in the future.";
    }

    try {
      parseMoney(form.openingBalance);
      if (form.creditLimit.trim()) parseMoney(form.creditLimit);
    } catch (err) {
      return err instanceof Error ? err.message : "Invalid amount.";
    }

    if (!form.allowTransactions && form.allowInternationalTransactions) {
      return "International transactions require transactions to be enabled.";
    }

    if (form.notes.length > 500) {
      return "Notes cannot exceed 500 characters.";
    }

    return "";
  }

  function goTo(target: Step) {
    if (target > 1) {
      const problem = validateClient();
      if (problem) {
        setError(problem);
        setStep(1);
        return;
      }
    }

    if (target === 3) {
      const problem = validateDetails();
      if (problem) {
        setError(problem);
        setStep(2);
        return;
      }
    }

    setError("");
    setStep(target);
  }

  async function submit() {
    if (step !== 3 || saving || success) return;

    const problem = validateClient() || validateDetails();

    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload: AccountInput = {
        clientId: form.clientId,
        accountType: form.accountType,
        accountName: form.accountName.trim(),
        currency: form.currency,
        purpose: form.purpose.trim(),
        status: form.status,
        openDate: form.openDate,
        balanceMinor: parseMoney(form.openingBalance),
        creditLimitMinor: form.creditLimit.trim()
          ? parseMoney(form.creditLimit)
          : null,
        allowTransactions: form.allowTransactions,
        allowInternationalTransactions: form.allowInternationalTransactions,
        requireDualApproval: form.requireDualApproval,
        temporaryAccount: form.temporaryAccount,
        notes: form.notes.trim()
      };

      const result = await registerAccount(payload);
      setSuccess(true);
      router.push(ROUTES.accountDetails(result.accountId));
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create account."
      );
    } finally {
      setSaving(false);
    }
  }

  const moneyBalance = money(form.openingBalance, form.currency);
  const moneyLimit = money(form.creditLimit, form.currency);
  const clientName = selectedClient?.companyName ?? "No client selected";

  return (
    <section className="ap-page acw-page">
      <div className="acw-title">
        <Icon name="layers" size={35} />
        <h1>Create Account</h1>
      </div>

      <nav className="acw-steps" aria-label="Create account steps">
        {([
          [1, "Client & Account Setup"],
          [2, "Account Details"],
          [3, "Review & Create"]
        ] as const).map(([number, label], index) => (
          <div className="acw-step-wrap" key={number}>
            {index > 0 && (
              <Icon name="arrow_forward" size={22} />
            )}

            <button
              type="button"
              className={step === number ? "active" : ""}
              onClick={() => goTo(number)}
              aria-current={step === number ? "step" : undefined}
            >
              <span className="acw-step-number">
                {number < step ? (
                  <Icon name="check" size={16} />
                ) : (
                  number
                )}
              </span>

              <span>{label}</span>
            </button>
          </div>
        ))}
      </nav>

      <form
        onSubmit={event => event.preventDefault()}
        className="acw-form"
        noValidate
      >
        <div className="acw-layout">
          <main className="acw-main">
            {step === 1 && (
              <>
                <Section title="Client & Account Setup" icon="groups">
                  <div className="acw-client-select">
                    <div className="acw-field">
                      <label htmlFor="acw-client-search">
                        Find Client <em>*</em>
                      </label>
                      <input
                        id="acw-client-search"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder="Search by client name or ID..."
                      />
                    </div>

                    <div className="acw-field">
                      <label htmlFor="acw-client">Client <em>*</em></label>
                      <select
                        id="acw-client"
                        value={form.clientId}
                        disabled={clientLoading}
                        onChange={event => update("clientId", event.target.value)}
                      >
                        <option value="">
                          {clientLoading ? "Loading..." : "Select a client"}
                        </option>
                        {clientOptions.map(client => (
                          <option key={client.clientId} value={client.clientId}>
                            {client.companyName} ({client.clientId})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedClient && (
                    <div className="acw-selected-client">
                      <div className="acw-client-icon">
                        <Icon name="domain" size={32} />
                      </div>
                      <div>
                        <strong>{selectedClient.companyName}</strong>
                        <p>
                          {selectedClient.clientType ?? "Corporate"} · {selectedClient.industry} · {selectedClient.country}
                        </p>
                        <small>ID: {selectedClient.clientId}</small>
                      </div>
                      <StatusBadge status={selectedClient.status} />
                    </div>
                  )}
                </Section>

                <div className="acw-info">
                  <Icon name="info" size={21} />
                  Select an active client. The account will be permanently
                  linked to this client when created.
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <Section title="Account Details" icon="layers">
                  <p className="acw-section-description">
                    Provide the account information and operational settings.
                  </p>

                  <div className="acw-grid three">
                    <div className="acw-field">
                      <label htmlFor="acw-type">Account Type <em>*</em></label>
                      <select
                        id="acw-type"
                        value={form.accountType}
                        onChange={event => update("accountType", event.target.value)}
                      >
                        <option value="">Select type</option>
                        {ENUMS.ACCOUNT_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div className="acw-field">
                      <label htmlFor="acw-name">Account Name <em>*</em></label>
                      <input
                        id="acw-name"
                        maxLength={120}
                        value={form.accountName}
                        onChange={event => update("accountName", event.target.value)}
                        placeholder="e.g., Trade Finance – Operations"
                      />
                    </div>

                    <div className="acw-field">
                      <label htmlFor="acw-currency">Currency <em>*</em></label>
                      <select
                        id="acw-currency"
                        value={form.currency}
                        onChange={event => update("currency", event.target.value)}
                      >
                        {ENUMS.CURRENCIES.map(currency => (
                          <option key={currency} value={currency}>{currency}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="acw-field acw-purpose">
                    <label htmlFor="acw-purpose">Account Purpose <em>*</em></label>
                    <textarea
                      id="acw-purpose"
                      maxLength={250}
                      rows={3}
                      value={form.purpose}
                      onChange={event => update("purpose", event.target.value)}
                      placeholder="Describe the account's intended purpose..."
                    />
                    <small>{form.purpose.length} / 250</small>
                  </div>
                </Section>

                <Section title="Account Settings" icon="settings">
                  <div className="acw-grid three">
                    <div className="acw-field">
                      <label htmlFor="acw-status">Account Status <em>*</em></label>
                      <select
                        id="acw-status"
                        value={form.status}
                        onChange={event => update("status", event.target.value)}
                      >
                        {ENUMS.ACCOUNT_STATUSES.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>

                    <div className="acw-field">
                      <label htmlFor="acw-opened">Open Date <em>*</em></label>
                      <input
                        id="acw-opened"
                        type="date"
                        max={localDate()}
                        value={form.openDate}
                        onChange={event => update("openDate", event.target.value)}
                      />
                    </div>

                    <div className="acw-field">
                      <label htmlFor="acw-balance">
                        Initial Balance ({form.currency}) <em>*</em>
                      </label>
                      <input
                        id="acw-balance"
                        type="text"
                        inputMode="decimal"
                        value={form.openingBalance}
                        onChange={event => update("openingBalance", event.target.value)}
                      />
                    </div>
                  </div>
                </Section>

                <Section title="Financial Parameters" icon="paid">
                  <div className="acw-grid three">
                    <div className="acw-field">
                      <label htmlFor="acw-credit">Credit Limit ({form.currency})</label>
                      <input
                        id="acw-credit"
                        inputMode="decimal"
                        value={form.creditLimit}
                        placeholder="Not configured"
                        onChange={event => update("creditLimit", event.target.value)}
                      />
                    </div>

                    <div className="acw-field">
                      <label>Available Limit ({form.currency})</label>
                      <input
                        readOnly
                        value={form.creditLimit.trim()
                          ? "Not yet established"
                          : "Not configured"}
                      />
                    </div>

                    <div className="acw-field">
                      <label>Utilization</label>
                      <input
                        readOnly
                        value="Not available until credit usage is recorded"
                      />
                    </div>
                  </div>

                  <div className="acw-options-grid">
                    <fieldset>
                      <legend>Transaction Options</legend>
                      <label>
                        <input
                          type="checkbox"
                          checked={form.allowTransactions}
                          onChange={event => {
                            update("allowTransactions", event.target.checked);
                            if (!event.target.checked) {
                              setForm(current => ({
                                ...current,
                                allowTransactions: false,
                                allowInternationalTransactions: false
                              }));
                            }
                          }}
                        />
                        Allow Transactions
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          disabled={!form.allowTransactions}
                          checked={form.allowInternationalTransactions}
                          onChange={event => update(
                            "allowInternationalTransactions",
                            event.target.checked
                          )}
                        />
                        Allow International Transactions
                      </label>
                    </fieldset>

                    <fieldset>
                      <legend>Additional Options</legend>
                      <label>
                        <input
                          type="checkbox"
                          checked={form.requireDualApproval}
                          onChange={event => update(
                            "requireDualApproval",
                            event.target.checked
                          )}
                        />
                        Require Dual Approval
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          checked={form.temporaryAccount}
                          onChange={event => update(
                            "temporaryAccount",
                            event.target.checked
                          )}
                        />
                        Temporary Account
                      </label>
                    </fieldset>
                  </div>
                </Section>

                <Section title="Notes (Optional)" icon="description">
                  <div className="acw-field">
                    <textarea
                      rows={2}
                      maxLength={500}
                      placeholder="Enter internal notes, operating instructions, special conditions..."
                      value={form.notes}
                      onChange={event => update("notes", event.target.value)}
                    />
                    <small>{form.notes.length} / 500</small>
                  </div>
                </Section>
              </>
            )}

            {step === 3 && (
              <>
                <div className="acw-review-heading">
                  <Icon name="fact_check" size={30} />
                  <div>
                    <h2>Review & Create</h2>
                    <p>
                      Review the client and account information below.
                      If everything is correct, create the account.
                    </p>
                  </div>
                </div>

                <div className="acw-review-grid">
                  <div className="acw-review-stack">
                    <Section
                      title="Client Information"
                      icon="groups"
                      action={
                        <button type="button" onClick={() => goTo(1)}>
                          <Icon name="edit" size={17} /> Change
                        </button>
                      }
                    >
                      <div className="acw-review-client">
                        <div className="acw-client-icon large">
                          <Icon name="domain" size={43} />
                        </div>
                        <div>
                          <h3>{clientName}</h3>
                          <p>Client ID: {selectedClient?.clientId}</p>
                          <p>Industry: {selectedClient?.industry}</p>
                          <p>Country: {selectedClient?.country}</p>
                        </div>
                        <StatusBadge status={selectedClient?.status ?? "Active"} />
                      </div>
                    </Section>

                    <Section title="Account Summary" icon="monitoring">
                      <SummaryRow label="Account">
                        {form.accountName}
                      </SummaryRow>
                      <SummaryRow label="Currency">{form.currency}</SummaryRow>
                      <SummaryRow label="Open Date">{prettyDate(form.openDate)}</SummaryRow>
                      <SummaryRow label="Initial Balance">{moneyBalance}</SummaryRow>
                      <SummaryRow label="Credit Limit">{moneyLimit}</SummaryRow>
                    </Section>
                  </div>

                  <Section
                    title="Account Details"
                    icon="layers"
                    action={
                      <button type="button" onClick={() => goTo(2)}>
                        <Icon name="edit" size={17} /> Change
                      </button>
                    }
                  >
                    <SummaryRow label="Account Type">{form.accountType}</SummaryRow>
                    <SummaryRow label="Account Name">{form.accountName}</SummaryRow>
                    <SummaryRow label="Currency">{form.currency}</SummaryRow>
                    <SummaryRow label="Account Purpose">{form.purpose}</SummaryRow>
                    <SummaryRow label="Account Status">
                      <StatusBadge status={form.status} />
                    </SummaryRow>
                    <SummaryRow label="Open Date">{prettyDate(form.openDate)}</SummaryRow>
                    <SummaryRow label="Initial Balance">{moneyBalance}</SummaryRow>
                    <SummaryRow label="Credit Limit">{moneyLimit}</SummaryRow>
                    <SummaryRow label="Allow Transactions">
                      {form.allowTransactions ? "Yes" : "No"}
                    </SummaryRow>
                    <SummaryRow label="International Transactions">
                      {form.allowInternationalTransactions ? "Yes" : "No"}
                    </SummaryRow>
                    <SummaryRow label="Dual Approval">
                      {form.requireDualApproval ? "Required" : "Not required"}
                    </SummaryRow>
                    <SummaryRow label="Temporary Account">
                      {form.temporaryAccount ? "Yes" : "No"}
                    </SummaryRow>
                    <SummaryRow label="Notes">
                      {form.notes || "None"}
                    </SummaryRow>
                  </Section>
                </div>

                <div className="acw-info">
                  <Icon name="info" size={23} />
                  <span>
                    By clicking <strong>Create Account</strong>, the account
                    will be created for <strong>{clientName}</strong> with
                    the above settings.
                  </span>
                </div>
              </>
            )}

            {error && (
              <div className="acw-error" role="alert">
                <Icon name="error" size={21} />
                {error}
              </div>
            )}
          </main>

          {step !== 3 && (
            <aside className="acw-sidebar">
              <Section title="Client Context" icon="groups">
                {selectedClient ? (
                  <div className="acw-sidebar-client">
                    <div className="acw-client-icon">
                      <Icon name="domain" size={34} />
                    </div>
                    <h3>{selectedClient.companyName}</h3>
                    <StatusBadge status={selectedClient.status} />
                    <p>Client ID: {selectedClient.clientId}</p>
                    <p>Industry: {selectedClient.industry}</p>
                    <p>Country: {selectedClient.country}</p>
                  </div>
                ) : (
                  <p className="acw-empty">Select a client to display its profile.</p>
                )}
              </Section>

              <Section title="Account Summary (Draft)" icon="layers">
                <SummaryRow label="Client">
                  {selectedClient?.companyName || "—"}
                </SummaryRow>
                <SummaryRow label="Account Type">
                  {form.accountType || "—"}
                </SummaryRow>
                <SummaryRow label="Account Name">
                  {form.accountName || "—"}
                </SummaryRow>
                <SummaryRow label="Currency">{form.currency}</SummaryRow>
                <SummaryRow label="Purpose">
                  {form.purpose || "—"}
                </SummaryRow>
                <SummaryRow label="Status">
                  <StatusBadge status={form.status} />
                </SummaryRow>
                <SummaryRow label="Open Date">{prettyDate(form.openDate)}</SummaryRow>
                <SummaryRow label="Initial Balance">{moneyBalance}</SummaryRow>
                <SummaryRow label="Credit Limit">{moneyLimit}</SummaryRow>
              </Section>

              <Section title="Next Steps" icon="flag">
                <div className="acw-next-steps">
                  {([
                    [1, "Client & Account Setup"],
                    [2, "Account Details"],
                    [3, "Review & Create"]
                  ] as const).map(([number, label]) => {
                    const completed = number < step;

                    return (
                      <button
                        key={number}
                        type="button"
                        onClick={() => goTo(number)}
                      >
                        <span className={
                          completed
                            ? "acw-step-complete"
                            : "acw-step-number"
                        }>
                          {completed ? (
                            <Icon name="check" size={17} />
                          ) : (
                            number
                          )}
                        </span>

                        <strong>{label}</strong>

                        <small>
                          {completed
                            ? "Completed"
                            : step === number
                              ? "In Progress"
                              : "Pending"}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </Section>

            </aside>
          )}
        </div>

        <footer className="acw-footer">
          <Link href={ROUTES.accounts} className="acw-button secondary">
            <Icon name="close" size={20} /> Cancel
          </Link>

          <div className="acw-footer-right">
            {step > 1 && (
              <button
                type="button"
                className="acw-button secondary"
                onClick={() => goTo((step - 1) as Step)}
                disabled={saving}
              >
                <Icon name="arrow_back" size={20} /> Back
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                className="acw-button primary"
                onClick={() => goTo((step + 1) as Step)}
              >
                Next: {step === 1 ? "Account Details" : "Review & Create"}
                <Icon name="arrow_forward" size={20} />
              </button>
            ) : (
              <button
                className="acw-button success"
                type="button"
                onClick={() => void submit()}
                disabled={saving || success}
              >
                <Icon name="check" size={20} />
                {saving ? "Creating..." : "Create Account"}
              </button>
            )}
          </div>
        </footer>
      </form>
    </section>
  );
}