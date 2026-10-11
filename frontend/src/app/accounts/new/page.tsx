"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Client, getClients } from "@/services/clients";
import { parseMoney, registerAccount } from "@/services/accounts";
import { ROUTES, PAGINATION, ENUMS } from "../../../../config";

export default function AccountRegistrationPage() {
    const router = useRouter();

    const [clients, setClients] = useState<Client[]>([]);
    const [clientId, setClientId] = useState("");
    const [accountType, setAccountType] = useState("");
    const [currency, setCurrency] = useState("");
    const [openingBalance, setOpeningBalance] = useState("0.00");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        async function loadClients() {
            try {
                const firstPage = await getClients({
                    page: PAGINATION.DEFAULT_PAGE,
                    pageSize: 100
                });

                const allClients = [...firstPage.data];

                for (
                    let page = 2;
                    page <= firstPage.pagination.totalPages;
                    page++
                ) {
                    const result = await getClients({
                        page,
                        pageSize: 100
                    });

                    allClients.push(...result.data);
                }

                if (active) {
                    setClients(allClients);
                }
            } catch (err) {
                if (active) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load corporate clients"
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadClients();

        return () => {
            active = false;
        };
    }, []);

    const selectedClient = clients.find(
        client => client.clientId === clientId
    );

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        if (!selectedClient) {
            setError("Please select a corporate client");
            return;
        }

        if (selectedClient.status !== "Active") {
            setError("Only active corporate clients can register accounts");
            return;
        }

        if (!ENUMS.ACCOUNT_TYPES.includes(accountType)) {
            setError("Please select a valid account type");
            return;
        }

        if (!ENUMS.CURRENCIES.includes(currency)) {
            setError("Please select a currency");
            return;
        }

        setSaving(true);

        try {
            const balanceMinor = parseMoney(openingBalance);

            const account = await registerAccount({
                clientId,
                accountType,
                currency,
                balanceMinor
            });

            router.push(ROUTES.accountDetails(account.accountId));
            router.refresh();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to register account"
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="account-registration-page">
            <div className="account-registration-heading">
                <h1>Register Financial Account</h1>
                <p>Create a new account for an existing client</p>
            </div>

            <form
                className="account-registration-form"
                onSubmit={submit}
            >
                <div className="account-registration-fields">
                    <label className="account-registration-field">
                        <span>
                            Client <span className="required-star">*</span>
                        </span>

                        <select
                            required
                            value={clientId}
                            disabled={loading || saving}
                            onChange={event =>
                                setClientId(event.target.value)
                            }
                        >
                            <option value="">
                                {loading ? "Loading clients..." : "Select client"}
                            </option>

                            {clients.map(client => (
                                <option
                                    key={client.clientId}
                                    value={client.clientId}
                                >
                                    {client.companyName}
                                </option>
                            ))}
                        </select>
                    </label>

                    {selectedClient && (
                        <div className="account-selected-client">
                            <span className="material-symbols-rounded">
                                business
                            </span>

                            <div>
                                <strong>{selectedClient.companyName}</strong>
                                <span
                                    className={`accounts-status-badge ${selectedClient.status === "Active"
                                        ? "active"
                                        : selectedClient.status === "Suspended"
                                            ? "frozen"
                                            : "closed"
                                        }`}
                                >
                                    {selectedClient.status}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="account-registration-two-columns">
                        <label className="account-registration-field">
                            <span>
                                Account Type <span className="required-star">*</span>
                            </span>

                            <select
                                required
                                value={accountType}
                                disabled={saving}
                                onChange={event =>
                                    setAccountType(event.target.value)
                                }
                            >
                                <option value="">Select account type</option>
                                {ENUMS.ACCOUNT_TYPES.map(type => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="account-registration-field">
                            <span>
                                Currency <span className="required-star">*</span>
                            </span>

                            <select
                                required
                                value={currency}
                                disabled={saving}
                                onChange={event =>
                                    setCurrency(event.target.value)
                                }
                            >
                                <option value="">Select currency</option>
                                {ENUMS.CURRENCIES.map(currency => (
                                    <option key={currency} value={currency}>
                                        {currency}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="account-registration-field">
                        <span>
                            Opening Balance <span className="required-star">*</span>
                        </span>

                        <div className="account-balance-input">
                            <input
                                type="text"
                                inputMode="decimal"
                                required
                                value={openingBalance}
                                disabled={saving}
                                onChange={event =>
                                    setOpeningBalance(event.target.value)
                                }
                                aria-describedby="account-balance-help"
                            />

                            <span id="account-balance-help">
                                Enter amount in dollars (e.g. 1250.50)
                            </span>
                        </div>
                    </label>
                </div>

                {error && (
                    <p className="corporate-form-error" role="alert">
                        {error}
                    </p>
                )}

                <div className="account-registration-actions">
                    <button
                        type="button"
                        className="corporate-cancel-button"
                        disabled={saving}
                        onClick={() => router.push(ROUTES.accounts)}
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="corporate-submit-button"
                        disabled={
                            saving ||
                            loading ||
                            !selectedClient ||
                            selectedClient.status !== "Active"
                        }
                    >
                        {saving ? "Registering..." : "Register Account"}
                    </button>
                </div>
            </form>
        </section>
    );
}