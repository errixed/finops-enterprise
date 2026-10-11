"use client";

import { FormEvent, useEffect, useState } from "react";
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

interface Props {
    client?: Client;
}

export default function ClientForm({ client }: Props) {
    const router = useRouter();
    const editing = Boolean(client);

    const [form, setForm] = useState<ClientInput>({
        companyName: client?.companyName ?? "",
        registrationNumber: client?.registrationNumber ?? "",
        industry: client?.industry ?? "",
        country: client?.country ?? "",
        contactEmail: client?.contactEmail ?? "",
        contactPhone: client?.contactPhone ?? ""
    });

    const [status, setStatus] = useState(client?.status ?? "Active");

    const [options, setOptions] = useState<ClientOptions>({
        industries: [],
        countries: [],
        statuses: []
    });

    const [loadingOptions, setLoadingOptions] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        let active = true;

        getClientOptions()
            .then(data => {
                if (active) setOptions(data);
            })
            .catch(err => {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load form options"
                    );
                }
            })
            .finally(() => {
                if (active) setLoadingOptions(false);
            });

        return () => {
            active = false;
        };
    }, []);

    function change(field: keyof ClientInput, value: string) {
        setForm(previous => ({
            ...previous,
            [field]: value
        }));
    }

    function validate() {
        const name = form.companyName.trim();
        const registration = form.registrationNumber.trim();
        const email = form.contactEmail.trim();
        const phone = form.contactPhone.trim();

        if (name.length < 2 || name.length > 150) {
            return "Company name must contain 2–150 characters";
        }

        if (!editing && (registration.length < 5 || registration.length > 30)) {
            return "Registration number must contain 5–30 characters";
        }

        if (!options.industries.includes(form.industry)) {
            return "Please select a supported industry";
        }

        if (!options.countries.includes(form.country)) {
            return "Please select a supported country";
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return "Please enter a valid contact email";
        }

        if (phone.length > 30) {
            return "Contact phone cannot exceed 30 characters";
        }

        if (editing && !options.statuses.includes(status)) {
            return "Please select a valid status";
        }

        return "";
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setSuccess("");

        const validationError = validate();

        if (validationError) {
            setError(validationError);
            return;
        }

        setSaving(true);

        try {
            let saved: Client;

            if (client) {
                saved = await updateClient(client.clientId, {
                    companyName: form.companyName.trim(),
                    industry: form.industry,
                    country: form.country,
                    contactEmail: form.contactEmail.trim(),
                    contactPhone: form.contactPhone.trim(),
                    status
                });

                setSuccess("Client updated successfully");
            } else {
                saved = await registerClient({
                    companyName: form.companyName.trim(),
                    registrationNumber: form.registrationNumber.trim(),
                    industry: form.industry,
                    country: form.country,
                    contactEmail: form.contactEmail.trim(),
                    contactPhone: form.contactPhone.trim()
                });

                setSuccess("Client registered successfully");
            }

            router.push(ROUTES.clientDetails(saved.clientId));
            router.refresh();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to save client"
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <form className="corporate-client-form" onSubmit={submit}>

            <div className="corporate-form-grid">
                <div className="corporate-form-column">
                    <label className="corporate-field">
                        <span>
                            Company Name <span className="required-star">*</span>
                        </span>
                        <input
                            type="text"
                            placeholder="e.g. Maple Industrial Group Inc."
                            required
                            minLength={2}
                            maxLength={150}
                            value={form.companyName}
                            onChange={event =>
                                change("companyName", event.target.value)
                            }
                        />
                    </label>

                    {!editing && (
                        <label className="corporate-field">
                            <span>
                                Registration Number <span className="required-star">*</span>
                            </span>
                            <input
                                type="text"
                                placeholder="e.g. CA-ON-100245"
                                required
                                minLength={5}
                                maxLength={30}
                                value={form.registrationNumber}
                                onChange={event =>
                                    change("registrationNumber", event.target.value)
                                }
                            />
                        </label>
                    )}

                    <label className="corporate-field">
                        <span>
                            Industry <span className="required-star">*</span>
                        </span>
                        <select
                            required
                            value={form.industry}
                            disabled={loadingOptions}
                            onChange={event =>
                                change("industry", event.target.value)
                            }
                        >
                            <option value="">Select industry</option>
                            {options.industries.map(industry => (
                                <option key={industry} value={industry}>
                                    {industry}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="corporate-field">
                        <span>
                            Country <span className="required-star">*</span>
                        </span>
                        <select
                            required
                            value={form.country}
                            disabled={loadingOptions}
                            onChange={event =>
                                change("country", event.target.value)
                            }
                        >
                            <option value="">Select country</option>
                            {options.countries.map(country => (
                                <option key={country} value={country}>
                                    {country}
                                </option>
                            ))}
                        </select>
                    </label>

                    {editing && (
                        <label className="corporate-field">
                            <span>
                                Status <span className="required-star">*</span>
                            </span>
                            <select
                                required
                                value={status}
                                disabled={loadingOptions}
                                onChange={event =>
                                    setStatus(event.target.value)
                                }
                            >
                                {options.statuses.map(item => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                </div>

                <div className="corporate-form-column">
                    <label className="corporate-field">
                        <span>
                            Contact Email <span className="required-star">*</span>
                        </span>
                        <input
                            type="email"
                            placeholder="e.g. finance@example.com"
                            required
                            value={form.contactEmail}
                            onChange={event =>
                                change("contactEmail", event.target.value)
                            }
                        />
                    </label>

                    <label className="corporate-field">
                        <span>Contact Phone</span>
                        <input
                            type="tel"
                            placeholder="e.g. +1-416-555-0100"
                            maxLength={30}
                            value={form.contactPhone}
                            onChange={event =>
                                change("contactPhone", event.target.value)
                            }
                        />
                    </label>

                    {!editing && (
                        <label className="corporate-field">
                            <span>Status</span>
                            <input
                                type="text"
                                value="Active"
                                readOnly
                            />
                        </label>
                    )}

                </div>
            </div>

            {error && (
                <p className="corporate-form-error" role="alert">
                    {error}
                </p>
            )}

            {success && (
                <p className="corporate-form-success" role="status">
                    {success}
                </p>
            )}

            <div className="corporate-form-actions">
                <button
                    type="button"
                    className="corporate-cancel-button"
                    disabled={saving}
                    onClick={() =>
                        router.push(
                            editing && client
                                ? `/clients/${client.clientId}`
                                : "/clients"
                        )
                    }
                >
                    Cancel
                </button>

                <button
                    type="submit"
                    className="corporate-submit-button"
                    disabled={saving || loadingOptions}
                >
                    {saving
                        ? "Saving..."
                        : editing
                            ? "Save Changes"
                            : "Register Client"}
                </button>
            </div>
        </form>
    );
}

