
"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { useRouter } from "next/navigation";
import {
  Client,
  ClientInput,
  ClientOptions,
  getClientOptions,
  registerClient,
  updateClient
} from "@/services/clients";
import { ROUTES } from "../../../config";
import { Icon } from "@/components/ui";

interface Props {
  client?: Client;
}

type ClientType = "Corporate" | "Individual";
type RiskRating = "Low" | "Medium" | "High" | "Critical";
type KycStatus =
  | "Not Started"
  | "In Progress"
  | "Pending Review"
  | "Verified"
  | "Rejected";

type Contact = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  primary: boolean;
};

type ClientDraft = {
  clientType: ClientType;
  companyName: string;
  operatingName: string;
  registrationNumber: string;
  incorporationDate: string;
  industry: string;
  country: string;
  currency: string;
  organizationSize: string;
  businessAddress: string;
  city: string;
  provinceState: string;
  postalCode: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  relationshipManager: string;
  riskRating: RiskRating;
  complianceCategory: string;
  kycStatus: KycStatus;
  checklist: string[];
  contacts: Contact[];
  nextReviewAt: string;
};

type StagedDocument = {
  id: string;
  documentType: string;
  file: File;
};

const DRAFT_KEY = "finops-create-client-draft-v1";

const STEPS = [
  "Basic Information",
  "Business Details",
  "Contacts",
  "Compliance & Risk",
  "Review & Create"
];

const CHECKLIST = [
  "Government ID / Incorporation Documents",
  "Proof of Address",
  "Beneficial Ownership (if applicable)",
  "Sanctions & PEP Screening",
  "Compliance Review"
];

const DOCUMENT_TYPES = [
  "Incorporation Certificate",
  "Business Registration",
  "Government ID",
  "Proof of Address",
  "KYC Form",
  "Beneficial Ownership",
  "Other"
];

const emptyOptions: ClientOptions = {
  industries: [],
  countries: [],
  statuses: []
};

function initialDraft(client?: Client): ClientDraft {
  return {
    clientType: client?.clientType ?? "Corporate",
    companyName: client?.companyName ?? "",
    operatingName: client?.operatingName ?? "",
    registrationNumber: client?.registrationNumber ?? "",
    incorporationDate: client?.incorporationDate?.slice(0, 10) ?? "",
    industry: client?.industry ?? "",
    country: client?.country ?? "",
    currency: client?.currency ?? "CAD",
    organizationSize: client?.organizationSize ?? "",
    businessAddress: client?.businessAddress ?? "",
    city: client?.city ?? "",
    provinceState: client?.provinceState ?? "",
    postalCode: client?.postalCode ?? "",
    contactPhone: client?.contactPhone ?? "",
    contactEmail: client?.contactEmail ?? "",
    website: client?.website ?? "",
    relationshipManager: client?.relationshipManager ?? "",
    riskRating: client?.riskRating ?? "Low",
    complianceCategory: client?.complianceCategory ?? "Standard",
    kycStatus: client?.kycStatus ?? "Not Started",
    checklist: client?.checklist ?? [],
    contacts: client?.contacts ?? [],
    nextReviewAt: client?.nextReviewAt?.slice(0, 10) ?? ""
  };
}

function Section({
  number,
  title,
  icon,
  children,
  className = ""
}: {
  number: number;
  title: string;
  icon: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`cc-panel ${className}`} id={`cc-step-${number}`}>
      <header className="cc-panel-heading">
        <h2>
          <Icon name={icon} size={27} />
          {number}. {title}
        </h2>
        {number === 1 && (
          <span><em>*</em> Required Fields</span>
        )}
      </header>
      <div className="cc-panel-body">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
  className = ""
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`cc-field ${className}`}>
      <span>
        {label}
        {required && <em> *</em>}
      </span>
      {children}
    </label>
  );
}

export default function ClientForm({ client }: Props) {
  const router = useRouter();
  const editing = Boolean(client);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ClientDraft>(() => initialDraft(client));
  const [options, setOptions] = useState<ClientOptions>(emptyOptions);
  const [activeStep, setActiveStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [documents, setDocuments] = useState<StagedDocument[]>([]);
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [showContactEditor, setShowContactEditor] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState<Contact>({
    id: "",
    name: "",
    role: "",
    email: "",
    phone: "",
    primary: false
  });

  useEffect(() => {
    let active = true;

    getClientOptions()
      .then(data => {
        if (active) setOptions(data);
      })
      .catch(err => {
        if (active) {
          setError(err instanceof Error
            ? err.message
            : "Unable to load options.");
        }
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });

    if (!editing) {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<ClientDraft>;
          if (active) {
            setForm(current => ({ ...current, ...saved }));
            setNotice("Your locally saved draft was restored.");
          }
        }
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }

    return () => {
      active = false;
    };
  }, [editing]);

  function change<K extends keyof ClientDraft>(
    key: K,
    value: ClientDraft[K]
  ) {
    setForm(current => ({ ...current, [key]: value }));
    setNotice("");
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setNotice("Draft saved in this browser. Files are not included.");
    } catch {
      setError("Unable to save draft in this browser.");
    }
  }
  function deleteDraft() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this draft? All unsaved information will be lost."
    );

    if (!confirmed) return;

    try {
      localStorage.removeItem(DRAFT_KEY);

      setForm(initialDraft());
      setDocuments([]);
      setActiveStep(1);
      setShowContactEditor(false);
      setEditingContactId(null);
      setError("");
      setNotice("Draft deleted successfully.");
    } catch {
      setError("Unable to delete the saved draft.");
    }
  }


  function openContactEditor(contact?: Contact) {
    setEditingContactId(contact?.id ?? null);
    setContactDraft(contact ?? {
      id: crypto.randomUUID(),
      name: "",
      role: "",
      email: "",
      phone: "",
      primary: form.contacts.length === 0
    });
    setShowContactEditor(true);
  }

  function saveContact() {
    if (!contactDraft.name.trim() || !contactDraft.role.trim()) {
      setError("Contact name and role are required.");
      return;
    }

    if (
      contactDraft.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactDraft.email)
    ) {
      setError("Please enter a valid contact email.");
      return;
    }

    const updated = editingContactId
      ? form.contacts.map(contact =>
        contact.id === editingContactId ? contactDraft : contact
      )
      : [...form.contacts, contactDraft];

    const normalized = updated.map(contact => ({
      ...contact,
      primary: contactDraft.primary
        ? contact.id === contactDraft.id
        : contact.primary
    }));

    if (!normalized.some(contact => contact.primary) && normalized.length) {
      normalized[0].primary = true;
    }

    change("contacts", normalized);
    setShowContactEditor(false);
    setError("");
  }

  function removeContact(contactId: string) {
    const remaining = form.contacts.filter(c => c.id !== contactId);
    if (remaining.length && !remaining.some(c => c.primary)) {
      remaining[0] = { ...remaining[0], primary: true };
    }
    change("contacts", remaining);
  }

  function choosePrimary(contactId: string) {
    change("contacts", form.contacts.map(c => ({
      ...c,
      primary: c.id === contactId
    })));
  }

  function toggleChecklist(item: string) {
    change(
      "checklist",
      form.checklist.includes(item)
        ? form.checklist.filter(value => value !== item)
        : [...form.checklist, item]
    );
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;

    const accepted: StagedDocument[] = [];

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} exceeds the 10 MB file limit.`);
        continue;
      }

      if (![
        "application/pdf",
        "image/jpeg",
        "image/png"
      ].includes(file.type)) {
        setError(`${file.name}: only PDF, JPG and PNG are accepted.`);
        continue;
      }

      accepted.push({
        id: crypto.randomUUID(),
        documentType,
        file
      });
    }

    setDocuments(current => [...current, ...accepted]);
  }

  function validateStep(step: number) {
    if (step === 1) {
      if (form.companyName.trim().length < 2) {
        return "Enter a legal name with at least two characters.";
      }
      if (form.registrationNumber.trim().length < 5) {
        return "Registration/Tax ID must have at least five characters.";
      }
      if (!options.industries.includes(form.industry)) {
        return "Choose a supported industry.";
      }
      if (!options.countries.includes(form.country)) {
        return "Choose a supported country.";
      }
      if (!form.currency) return "Choose a currency.";
      if (!form.organizationSize) return "Choose organization size.";
      if (!form.incorporationDate) return "Enter incorporation date.";
    }

    if (step === 2) {
      if (!form.businessAddress.trim()) return "Enter business address.";
      if (!form.city.trim()) return "Enter city.";
      if (!form.provinceState.trim()) return "Enter province/state.";
      if (!form.postalCode.trim()) return "Enter postal code.";
      if (!form.contactPhone.trim()) return "Enter business phone.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
        return "Enter a valid business email.";
      }
    }

    if (step === 3 && form.contacts.length === 0) {
      return "Add at least one contact.";
    }

    if (step === 4 && !form.riskRating) {
      return "Select an initial risk rating.";
    }

    return "";
  }


  function goToStep(step: number) {
    if (step < 1 || step > STEPS.length) return;

    if (step > activeStep) {
      for (let index = 1; index < step; index++) {
        const issue = validateStep(index);

        if (issue) {
          setActiveStep(index);
          setError(issue);
          return;
        }
      }
    }

    setError("");
    setActiveStep(step);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }


  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    for (let step = 1; step <= 4; step++) {
      const issue = validateStep(step);

      if (issue) {
        goToStep(step);
        setError(issue);
        return;
      }
    }

    if (documents.length > 0) {
      setError(
        "Documents are staged but not uploaded. Remove the staged files " +
        "or connect the document storage API before creating this client."
      );
      setActiveStep(4);
      return;
    }

    setSaving(true);

    try {
      const payload: ClientInput = {
        companyName: form.companyName.trim(),
        registrationNumber: form.registrationNumber.trim(),
        industry: form.industry,
        country: form.country,
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim(),
        clientType: form.clientType,
        relationshipManager: form.relationshipManager || null,
        nextReviewAt: form.nextReviewAt || null,
        operatingName: form.operatingName,
        incorporationDate: form.incorporationDate,
        currency: form.currency,
        organizationSize: form.organizationSize,
        businessAddress: form.businessAddress,
        city: form.city,
        provinceState: form.provinceState,
        postalCode: form.postalCode,
        website: form.website,
        riskRating: form.riskRating,
        complianceCategory: form.complianceCategory,
        kycStatus: form.kycStatus,
        checklist: form.checklist,
        contacts: form.contacts
      };

      const saved = client
        ? await updateClient(client.clientId, payload)
        : await registerClient(payload);

      if (!editing) {
        localStorage.removeItem(DRAFT_KEY);
      }

      router.push(ROUTES.clientDetails(saved.clientId));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error
        ? err.message
        : "Unable to save client.");
    } finally {
      setSaving(false);
    }
  }

  const stepValid = STEPS.map((_, index) =>
    index < 4 ? validateStep(index + 1) === "" : false
  );

  const allValid = stepValid.slice(0, 4).every(Boolean);

  return (
    <form className="cc-form" onSubmit={submit}>
      <div className="cc-layout">
        <main className="cc-main">
          <nav className="cc-stepper" aria-label="Create client steps">
            {STEPS.map((step, index) => (
              <div className="cc-step-wrap" key={step}>
                {index > 0 && <Icon name="arrow_forward" size={22} />}
                <button
                  type="button"
                  className={activeStep === index + 1 ? "active" : ""}
                  onClick={() => goToStep(index + 1)}
                >
                  <span className="cc-step-number">
                    {stepValid[index] ? (
                      <Icon name="check" size={16} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span>{step}</span>
                </button>
              </div>
            ))}
          </nav>
          {activeStep === 1 && (
            <Section number={1} title="Basic Information" icon="apartment">
              <div className="cc-basic-grid">
                <div className="cc-type-choice">
                  <strong>Client Type <em>*</em></strong>
                  {(["Corporate", "Individual"] as ClientType[]).map(type => (
                    <label key={type}>
                      <input
                        type="radio"
                        name="clientType"
                        checked={form.clientType === type}
                        onChange={() => change("clientType", type)}
                      />
                      {type}
                    </label>
                  ))}
                </div>

                <Field label="Client ID (Auto)">
                  <input readOnly value={client?.clientId ?? "Assigned on creation"} />
                </Field>

                <Field label="Legal Name" required>
                  <input
                    value={form.companyName}
                    maxLength={150}
                    onChange={e => change("companyName", e.target.value)}
                    placeholder="Registered legal name"
                  />
                </Field>

                <Field label="Industry" required>
                  <select
                    value={form.industry}
                    disabled={loadingOptions}
                    onChange={e => change("industry", e.target.value)}
                  >
                    <option value="">Select industry</option>
                    {options.industries.map(value => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Operating Name (if different)">
                  <input
                    value={form.operatingName}
                    onChange={e => change("operatingName", e.target.value)}
                  />
                </Field>

                <div className="cc-two-col">
                  <Field label="Country" required>
                    <select
                      value={form.country}
                      onChange={e => change("country", e.target.value)}
                    >
                      <option value="">Select country</option>
                      {options.countries.map(value => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Currency" required>
                    <select
                      value={form.currency}
                      onChange={e => change("currency", e.target.value)}
                    >
                      <option value="CAD">CAD</option>
                      <option value="USD">USD</option>
                    </select>
                  </Field>
                </div>

                <div className="cc-two-col">
                  <Field label="Registration / Tax ID" required>
                    <input
                      value={form.registrationNumber}
                      readOnly={editing}
                      maxLength={30}
                      onChange={e => change("registrationNumber", e.target.value)}
                    />
                  </Field>

                  <Field label="Incorporation Date" required>
                    <input
                      type="date"
                      value={form.incorporationDate}
                      onChange={e => change("incorporationDate", e.target.value)}
                    />
                  </Field>
                </div>

                <Field label="Organization Size" required>
                  <select
                    value={form.organizationSize}
                    onChange={e => change("organizationSize", e.target.value)}
                  >
                    <option value="">Select size</option>
                    {[
                      "1–10 employees",
                      "11–50 employees",
                      "51–100 employees",
                      "101–500 employees",
                      "501–1,000 employees",
                      "1,001+ employees"
                    ].map(value => (
                      <option value={value} key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </Section>
          )}

          {activeStep === 2 && (
            <Section number={2} title="Business Details" icon="business_center">
              <div className="cc-business-grid">
                <Field label="Business Address" required className="cc-span-all">
                  <input
                    value={form.businessAddress}
                    onChange={e => change("businessAddress", e.target.value)}
                  />
                </Field>

                <Field label="City" required>
                  <input
                    value={form.city}
                    onChange={e => change("city", e.target.value)}
                  />
                </Field>

                <Field label="Province/State" required>
                  <input
                    value={form.provinceState}
                    onChange={e => change("provinceState", e.target.value)}
                  />
                </Field>

                <Field label="Postal Code" required>
                  <input
                    value={form.postalCode}
                    onChange={e => change("postalCode", e.target.value)}
                  />
                </Field>

                <Field label="Business Phone" required>
                  <input
                    type="tel"
                    value={form.contactPhone}
                    onChange={e => change("contactPhone", e.target.value)}
                  />
                </Field>

                <Field label="Business Email" required>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={e => change("contactEmail", e.target.value)}
                  />
                </Field>

                <Field label="Website">
                  <input
                    value={form.website}
                    placeholder="https://"
                    onChange={e => change("website", e.target.value)}
                  />
                </Field>
              </div>
            </Section>
          )}
          {activeStep === 3 && (
            <Section number={3} title="Contacts" icon="groups">
              <div className="cc-section-action">
                <button type="button" onClick={() => openContactEditor()}>
                  <Icon name="add" size={18} /> Add Contact
                </button>
              </div>

              <div className="cc-table-scroll">
                <table className="cc-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Primary</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.contacts.length === 0 ? (
                      <tr><td colSpan={4}>No contacts added.</td></tr>
                    ) : form.contacts.map(contact => (
                      <tr key={contact.id}>
                        <td>{contact.name}</td>
                        <td>{contact.role}</td>
                        <td>
                          <input
                            type="radio"
                            name="primaryContact"
                            aria-label={`Set ${contact.name} as primary`}
                            checked={contact.primary}
                            onChange={() => choosePrimary(contact.id)}
                          />
                        </td>
                        <td>
                          <div className="cc-row-actions">
                            <button
                              type="button"
                              aria-label={`Edit ${contact.name}`}
                              onClick={() => openContactEditor(contact)}
                            >
                              <Icon name="edit" size={19} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${contact.name}`}
                              onClick={() => removeContact(contact.id)}
                            >
                              <Icon name="delete" size={19} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
          {activeStep === 4 && (
            <Section number={4} title="Compliance & Risk" icon="verified_user">
              <div className="cc-compliance-grid">
                <div className="cc-compliance-fields">
                  <Field label="Risk Rating (Initial)" required>
                    <select
                      value={form.riskRating}
                      onChange={e => change(
                        "riskRating", e.target.value as RiskRating
                      )}
                    >
                      {(["Low", "Medium", "High", "Critical"] as RiskRating[])
                        .map(value => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                    </select>
                  </Field>

                  <Field label="Compliance Category" required>
                    <select
                      value={form.complianceCategory}
                      onChange={e => change("complianceCategory", e.target.value)}
                    >
                      {["Standard", "Enhanced", "Restricted"].map(value => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="KYC Status" required>
                    <select
                      value={form.kycStatus}
                      onChange={e => change(
                        "kycStatus", e.target.value as KycStatus
                      )}
                    >
                      {([
                        "Not Started",
                        "In Progress",
                        "Pending Review",
                        "Verified",
                        "Rejected"
                      ] as KycStatus[]).map(value => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Next Review Date">
                    <input
                      type="date"
                      value={form.nextReviewAt}
                      onChange={e => change("nextReviewAt", e.target.value)}
                    />
                  </Field>
                </div>

                <div className="cc-checklist">
                  <h3>
                    <Icon name="fact_check" size={22} />
                    KYC / Compliance Checklist
                  </h3>

                  {CHECKLIST.map(item => (
                    <label key={item}>
                      <input
                        type="checkbox"
                        checked={form.checklist.includes(item)}
                        onChange={() => toggleChecklist(item)}
                      />
                      {item}
                    </label>
                  ))}
                </div>

                <div className="cc-documents">
                  <div className="cc-documents-heading">
                    <h3><Icon name="description" size={22} /> Documents</h3>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Icon name="add" size={18} /> Select Files
                    </button>
                  </div>

                  <select
                    aria-label="Document type"
                    value={documentType}
                    onChange={e => setDocumentType(e.target.value)}
                  >
                    {DOCUMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>

                  <input
                    ref={fileRef}
                    className="cc-hidden-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    onChange={e => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />

                  <div className="cc-table-scroll">
                    <table className="cc-table">
                      <thead>
                        <tr>
                          <th>Document</th>
                          <th>File Name</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.length === 0 ? (
                          <tr><td colSpan={4}>No documents selected.</td></tr>
                        ) : documents.map(document => (
                          <tr key={document.id}>
                            <td>{document.documentType}</td>
                            <td>{document.file.name}</td>
                            <td><span className="cc-tag pending">Staged</span></td>
                            <td>
                              <div className="cc-row-actions">
                                <button
                                  type="button"
                                  aria-label={`Preview ${document.file.name}`}
                                  onClick={() => {
                                    const url = URL.createObjectURL(document.file);
                                    window.open(url, "_blank", "noopener,noreferrer");
                                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                                  }}
                                >
                                  <Icon name="visibility" size={18} />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Remove ${document.file.name}`}
                                  onClick={() => setDocuments(current =>
                                    current.filter(d => d.id !== document.id)
                                  )}
                                >
                                  <Icon name="delete" size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="cc-file-note">
                    Files are staged locally, not uploaded or saved to the database.
                  </p>
                </div>
              </div>
            </Section>
          )}
          {activeStep === 5 && (
            <section id="cc-step-5" className="cc-panel cc-review">
              <header className="cc-panel-heading">
                <h2><Icon name="fact_check" size={23} /> Review & Create</h2>
              </header>
              <div className="cc-panel-body">
                <p>Review the live summary and verify all details before submitting.</p>
                <p><strong>Contacts:</strong> {form.contacts.length}</p>
                <p>
                  <strong>Compliance checks completed:</strong>{" "}
                  {form.checklist.length} of {CHECKLIST.length}
                </p>
                <p>
                  <strong>Documents awaiting upload:</strong>{" "}
                  {documents.length}
                </p>
              </div>
            </section>
          )}

          {error && (
            <div className="cc-message cc-error" role="alert">
              <Icon name="error" size={20} />
              {error}
            </div>
          )}

          {notice && (
            <div className="cc-message" role="status">
              <Icon name="info" size={20} />
              {notice}
            </div>
          )}
        </main>

        <aside className="cc-sidebar">
          <section className="cc-panel">
            <header className="cc-panel-heading">
              <h2><Icon name="apartment" size={25} /> Client Summary</h2>
            </header>
            <div className="cc-summary">
              {[
                ["Client Type", form.clientType],
                ["Legal Name", form.companyName || "Not entered"],
                ["Industry", form.industry || "Not selected"],
                ["Country", form.country || "Not selected"],
                ["Currency", form.currency],
                ["Risk Rating", form.riskRating],
                ["KYC Status", form.kycStatus]
              ].map(([label, value]) => (
                <div key={label}>
                  <strong>{label}:</strong>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="cc-panel">
            <header className="cc-panel-heading">
              <h2><Icon name="flag" size={25} /> Next Steps</h2>
            </header>
            <div className="cc-next-steps">
              {STEPS.map((label, index) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => goToStep(index + 1)}
                >
                  <span className={
                    stepValid[index] ? "cc-complete" : "cc-step-number"
                  }>
                    {stepValid[index] ? <Icon name="check" size={17} /> : index + 1}
                  </span>
                  <strong>{label}</strong>
                  <small>
                    {stepValid[index]
                      ? "Completed"
                      : activeStep === index + 1 ? "In Progress" : "Pending"}
                  </small>
                </button>
              ))}
            </div>
          </section>

          <div className="cc-info-note">
            <Icon name="info" size={25} />
            <span>
              New clients are registered in Active status after successful submission.
              Initial risk rating is distinct from transaction risk assessments.
            </span>
          </div>
        </aside>
      </div>

      <footer className="cc-footer">
        <button
          type="button"
          className="cc-outline-button"
          onClick={() => router.push(ROUTES.clients)}
        >
          <Icon name="close" size={21} /> Cancel
        </button>

        <div>

          {!editing && (
            <>
              <button
                type="button"
                className="cc-outline-button"
                onClick={saveDraft}
              >
                <Icon name="save" size={19} />
                Save as Draft
              </button>

              <button
                type="button"
                className="cc-delete-draft-button"
                onClick={deleteDraft}
                disabled={saving}
              >
                <Icon name="delete_outline" size={19} />
                Delete Draft
              </button>
            </>
          )}


          <button
            type="button"
            className="cc-outline-button"
            disabled={activeStep === 1}
            onClick={() => goToStep(activeStep - 1)}
          >
            <Icon name="chevron_left" size={22} /> Previous
          </button>

          {activeStep < 5 && (
            <button
              type="button"
              className="cc-primary-button"
              onClick={() => goToStep(activeStep + 1)}
            >
              Next <Icon name="chevron_right" size={21} />
            </button>
          )}

          <button
            type="submit"
            className="cc-primary-button"
            disabled={saving || loadingOptions || !allValid || activeStep !== 5}
          >
            <Icon name="check" size={20} />
            {saving ? "Saving..." : editing ? "Save Changes" : "Create Client"}
          </button>
        </div>
      </footer>

      {showContactEditor && (
        <div className="cc-modal-backdrop">
          <div className="cc-modal" role="dialog" aria-modal="true"
            aria-labelledby="cc-contact-title">
            <h2 id="cc-contact-title">
              {editingContactId ? "Edit Contact" : "Add Contact"}
            </h2>

            {([
              ["name", "Name"],
              ["role", "Role"],
              ["email", "Email"],
              ["phone", "Phone"]
            ] as const).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  value={contactDraft[key]}
                  onChange={e => setContactDraft(current => ({
                    ...current, [key]: e.target.value
                  }))}
                />
              </Field>
            ))}

            <label className="cc-modal-check">
              <input
                type="checkbox"
                checked={contactDraft.primary}
                onChange={e => setContactDraft(current => ({
                  ...current, primary: e.target.checked
                }))}
              />
              Primary Contact
            </label>

            <div className="cc-modal-actions">
              <button
                type="button"
                className="cc-outline-button"
                onClick={() => setShowContactEditor(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cc-primary-button"
                onClick={saveContact}
              >
                Save Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}