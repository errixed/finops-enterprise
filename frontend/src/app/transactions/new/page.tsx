"use client";

import {
    FormEvent,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Account,
    getAccounts,
    formatMoney,
    parseMoney
} from "@/services/accounts";
import {
    initiateTransaction,
    TransactionInput
} from "@/services/transactions";
import { ROUTES } from "../../../../config";

type FieldName =
    | "sourceAccountId"
    | "destinationAccountId"
    | "amount"
    | "description";

type FormErrors = Partial<Record<FieldName, string>>;

function formatInputAmount(value: string) {
    const normalized = value.replace(/,/g, "").trim();

    if (!normalized) return "";

    try {
        const minor = parseMoney(normalized);

        return (minor / 100).toLocaleString("en-CA", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    } catch {
        return value;
    }
}

function accountLabel(account: Account) {
    return `${account.accountNumber} - ${
        account.companyName ?? "Unknown Client"
    } (${account.currency})`;
}

function FieldError({ message }: { message?: string }) {
    if (!message) return null;

    return (
        <p className="transfer-field-error" role="alert">
            <span className="material-symbols-rounded">
                error
            </span>
            {message}
        </p>
    );
}

export default function TransactionCreatePage() {
    const router = useRouter();

    const [accounts, setAccounts] = useState<Account[]>([]);

    const [sourceAccountId, setSourceAccountId] = useState("");
    const [destinationAccountId, setDestinationAccountId] =
        useState("");

    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");

    const [touched, setTouched] = useState<
        Partial<Record<FieldName, boolean>>
    >({});

    const [submitted, setSubmitted] = useState(false);
    const [serverError, setServerError] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const idempotencyKey = useRef<string | null>(null);
    const submitting = useRef(false);

    useEffect(() => {
        let active = true;

        async function loadAccounts() {
            setLoading(true);
            setServerError("");

            try {
                const result = await getAccounts();

                if (active) {
                    setAccounts(result);
                }
            } catch (err) {
                if (active) {
                    setServerError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load accounts"
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadAccounts();

        return () => {
            active = false;
        };
    }, []);

    const sourceAccount = useMemo(
        () =>
            accounts.find(
                account => account.accountId === sourceAccountId
            ),
        [accounts, sourceAccountId]
    );

    const destinationAccount = useMemo(
        () =>
            accounts.find(
                account => account.accountId === destinationAccountId
            ),
        [accounts, destinationAccountId]
    );

    const availableDestinations = useMemo(
        () =>
            accounts.filter(
                account =>
                    !sourceAccount ||
                    account.currency === sourceAccount.currency
            ),
        [accounts, sourceAccount]
    );

    const currency = sourceAccount?.currency ?? "CAD";

    const normalizedAmount = amount.replace(/,/g, "").trim();

    const amountMinor = useMemo(() => {
        if (!normalizedAmount) return null;

        try {
            return parseMoney(normalizedAmount);
        } catch {
            return null;
        }
    }, [normalizedAmount]);

    const validationErrors = useMemo(() => {
        const nextErrors: FormErrors = {};

        if (!sourceAccount) {
            nextErrors.sourceAccountId =
                "Please select a source account.";
        }

        if (!destinationAccount) {
            nextErrors.destinationAccountId =
                "Please select a destination account.";
        }

        if (sourceAccount && destinationAccount) {
            if (
                sourceAccount.accountId ===
                destinationAccount.accountId
            ) {
                nextErrors.sourceAccountId =
                    "Source and destination accounts must be different.";

                nextErrors.destinationAccountId =
                    "Source and destination accounts must be different.";
            } else if (
                sourceAccount.currency !==
                destinationAccount.currency
            ) {
                nextErrors.destinationAccountId =
                    "Both accounts must use the same currency.";
            }
        }

        if (!normalizedAmount) {
            nextErrors.amount =
                "Please enter a transfer amount.";
        } else if (amountMinor === null) {
            nextErrors.amount =
                "Enter a valid amount with up to two decimal places.";
        } else if (amountMinor <= 0) {
            nextErrors.amount =
                "Amount must be at least 0.01.";
        } else if (
            sourceAccount &&
            amountMinor > sourceAccount.balanceMinor
        ) {
            nextErrors.amount =
                "Amount exceeds available balance.";
        }

        if (!description.trim()) {
            nextErrors.description =
                "Please enter a transaction description.";
        } else if (description.length > 250) {
            nextErrors.description =
                "Description cannot exceed 250 characters.";
        }

        return nextErrors;
    }, [
        sourceAccount,
        destinationAccount,
        normalizedAmount,
        amountMinor,
        description
    ]);

    const visibleErrors = useMemo(() => {
        const result: FormErrors = {};

        const fields: FieldName[] = [
            "sourceAccountId",
            "destinationAccountId",
            "amount",
            "description"
        ];

        for (const field of fields) {
            if (touched[field] || submitted) {
                result[field] = validationErrors[field];
            }
        }

        if (
            sourceAccount &&
            destinationAccount &&
            sourceAccount.accountId === destinationAccount.accountId
        ) {
            result.sourceAccountId =
                validationErrors.sourceAccountId;

            result.destinationAccountId =
                validationErrors.destinationAccountId;
        }

        if (
            sourceAccount &&
            destinationAccount &&
            sourceAccount.currency !== destinationAccount.currency
        ) {
            result.destinationAccountId =
                validationErrors.destinationAccountId;
        }

        if (
            sourceAccount &&
            amountMinor !== null &&
            amountMinor > sourceAccount.balanceMinor
        ) {
            result.amount = validationErrors.amount;
        }

        return result;
    }, [
        touched,
        submitted,
        validationErrors,
        sourceAccount,
        destinationAccount,
        amountMinor
    ]);

    const isValid =
        Boolean(sourceAccount) &&
        Boolean(destinationAccount) &&
        amountMinor !== null &&
        amountMinor > 0 &&
        Object.keys(validationErrors).length === 0;

    const canSubmit =
        !loading &&
        !saving &&
        accounts.length >= 2 &&
        isValid;

    function resetRequest() {
        idempotencyKey.current = null;
        setServerError("");
    }

    function markTouched(field: FieldName) {
        setTouched(previous => ({
            ...previous,
            [field]: true
        }));
    }

    function updateField(field: FieldName, value: string) {
        if (field === "sourceAccountId") {
            setSourceAccountId(value);

            const nextSource = accounts.find(
                account => account.accountId === value
            );

            const currentDestination = accounts.find(
                account =>
                    account.accountId === destinationAccountId
            );

            if (
                currentDestination &&
                nextSource &&
                currentDestination.currency !== nextSource.currency
            ) {
                setDestinationAccountId("");
            }
        }

        if (field === "destinationAccountId") {
            setDestinationAccountId(value);
        }

        if (field === "amount") {
            setAmount(value);
        }

        if (field === "description") {
            setDescription(value);
        }

        markTouched(field);
        resetRequest();
    }

    function validateForm(): TransactionInput | null {
        setSubmitted(true);

        setTouched({
            sourceAccountId: true,
            destinationAccountId: true,
            amount: true,
            description: true
        });

        if (
            !isValid ||
            !sourceAccount ||
            !destinationAccount ||
            amountMinor === null
        ) {
            return null;
        }

        return {
            sourceAccountId: sourceAccount.accountId,
            destinationAccountId: destinationAccount.accountId,
            amountMinor,
            currency: sourceAccount.currency,
            description: description.trim()
        };
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (submitting.current || saving || loading) {
            return;
        }

        const input = validateForm();

        setServerError("");

        if (!input) {
            return;
        }

        submitting.current = true;
        setSaving(true);

        try {
            if (!idempotencyKey.current) {
                idempotencyKey.current = crypto.randomUUID();
            }

            const transaction = await initiateTransaction(
                input,
                idempotencyKey.current
            );

            router.push(
                ROUTES.transactionDetails(
                    transaction.transactionId
                )
            );
        } catch (err) {
            setServerError(
                err instanceof Error
                    ? err.message
                    : "Unable to create transfer."
            );
        } finally {
            setSaving(false);
            submitting.current = false;
        }
    }

    return (
        <section className="transfer-create-page">
            <nav
                className="transfer-breadcrumb"
                aria-label="Breadcrumb"
            >
                <Link href={ROUTES.transactions}>
                    <span className="material-symbols-rounded">
                        home
                    </span>
                    Transactions
                </Link>

                <span className="material-symbols-rounded">
                    chevron_right
                </span>

                <span>Create Transfer</span>
            </nav>

            <h1 className="transfer-page-title">
                Create Financial Transfer
            </h1>

            <form
                className="transfer-form"
                onSubmit={submit}
                noValidate
            >
                <div className="transfer-form-grid">
                    <div className="transfer-form-field">
                        <label htmlFor="transfer-source">
                            Source Account
                            <span className="transfer-required">
                                {" "}*
                            </span>
                        </label>

                        <select
                            id="transfer-source"
                            className={
                                visibleErrors.sourceAccountId
                                    ? "transfer-invalid"
                                    : ""
                            }
                            value={sourceAccountId}
                            disabled={loading || saving}
                            aria-invalid={Boolean(
                                visibleErrors.sourceAccountId
                            )}
                            aria-describedby={
                                visibleErrors.sourceAccountId
                                    ? "transfer-source-error"
                                    : undefined
                            }
                            onChange={event =>
                                updateField(
                                    "sourceAccountId",
                                    event.target.value
                                )
                            }
                            onBlur={() =>
                                markTouched("sourceAccountId")
                            }
                        >
                            <option value="">
                                Select source account
                            </option>

                            {accounts.map(account => (
                                <option
                                    key={account.accountId}
                                    value={account.accountId}
                                >
                                    {accountLabel(account)}
                                </option>
                            ))}
                        </select>

                        {sourceAccount && (
                            <p className="transfer-balance-help">
                                Balance:{" "}
                                {formatMoney(
                                    sourceAccount.balanceMinor,
                                    sourceAccount.currency
                                )}{" "}
                                {sourceAccount.currency}
                            </p>
                        )}

                        <div id="transfer-source-error">
                            <FieldError
                                message={
                                    visibleErrors.sourceAccountId
                                }
                            />
                        </div>
                    </div>

                    <div className="transfer-form-field">
                        <label htmlFor="transfer-destination">
                            Destination Account
                            <span className="transfer-required">
                                {" "}*
                            </span>
                        </label>

                        <select
                            id="transfer-destination"
                            className={
                                visibleErrors.destinationAccountId
                                    ? "transfer-invalid"
                                    : ""
                            }
                            value={destinationAccountId}
                            disabled={
                                loading ||
                                saving ||
                                !sourceAccount
                            }
                            aria-invalid={Boolean(
                                visibleErrors.destinationAccountId
                            )}
                            aria-describedby={
                                visibleErrors.destinationAccountId
                                    ? "transfer-destination-error"
                                    : undefined
                            }
                            onChange={event =>
                                updateField(
                                    "destinationAccountId",
                                    event.target.value
                                )
                            }
                            onBlur={() =>
                                markTouched("destinationAccountId")
                            }
                        >
                            <option value="">
                                Select destination account
                            </option>

                            {availableDestinations.map(account => (
                                <option
                                    key={account.accountId}
                                    value={account.accountId}
                                >
                                    {accountLabel(account)}
                                </option>
                            ))}
                        </select>

                        {destinationAccount && (
                            <p className="transfer-balance-help">
                                Balance:{" "}
                                {formatMoney(
                                    destinationAccount.balanceMinor,
                                    destinationAccount.currency
                                )}{" "}
                                {destinationAccount.currency}
                            </p>
                        )}

                        <div id="transfer-destination-error">
                            <FieldError
                                message={
                                    visibleErrors.destinationAccountId
                                }
                            />
                        </div>
                    </div>

                    <div className="transfer-form-field">
                        <label htmlFor="transfer-amount">
                            Amount
                            <span className="transfer-required">
                                {" "}*
                            </span>
                        </label>

                        <div
                            className={`transfer-amount-control ${
                                visibleErrors.amount
                                    ? "transfer-invalid"
                                    : ""
                            }`}
                        >
                            <input
                                id="transfer-amount"
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={amount}
                                disabled={saving}
                                aria-invalid={Boolean(
                                    visibleErrors.amount
                                )}
                                aria-describedby={
                                    visibleErrors.amount
                                        ? "transfer-amount-error"
                                        : undefined
                                }
                                onChange={event =>
                                    updateField(
                                        "amount",
                                        event.target.value
                                    )
                                }
                                onBlur={() => {
                                    markTouched("amount");

                                    setAmount(previous =>
                                        formatInputAmount(previous)
                                    );
                                }}
                            />

                            <span className="transfer-currency-label">
                                {currency}
                            </span>
                        </div>

                        <div className="transfer-amount-help">
                            <span>
                                Minimum: 0.01 {currency}
                            </span>

                            {sourceAccount && (
                                <span>
                                    Maximum:{" "}
                                    {formatMoney(
                                        sourceAccount.balanceMinor,
                                        sourceAccount.currency
                                    )}{" "}
                                    {currency}
                                </span>
                            )}
                        </div>

                        <div id="transfer-amount-error">
                            <FieldError
                                message={visibleErrors.amount}
                            />
                        </div>
                    </div>

                    <div className="transfer-form-field">
                        <label htmlFor="transfer-description">
                            Description
                            <span className="transfer-required">
                                {" "}*
                            </span>
                        </label>

                        <div
                            className={`transfer-description-control ${
                                visibleErrors.description
                                    ? "transfer-invalid"
                                    : ""
                            }`}
                        >
                            <textarea
                                id="transfer-description"
                                rows={3}
                                maxLength={250}
                                value={description}
                                disabled={saving}
                                aria-invalid={Boolean(
                                    visibleErrors.description
                                )}
                                aria-describedby={
                                    visibleErrors.description
                                        ? "transfer-description-error"
                                        : undefined
                                }
                                placeholder="Enter transfer description"
                                onChange={event =>
                                    updateField(
                                        "description",
                                        event.target.value
                                    )
                                }
                                onBlur={() =>
                                    markTouched("description")
                                }
                            />

                            <span className="transfer-character-count">
                                {description.length}/250
                            </span>
                        </div>

                        <div id="transfer-description-error">
                            <FieldError
                                message={
                                    visibleErrors.description
                                }
                            />
                        </div>
                    </div>
                </div>

                {sourceAccount &&
                    sourceAccount.status !== "Active" && (
                        <p className="transfer-warning" role="status">
                            The source account is not Active.
                            Transaction processing may be rejected.
                        </p>
                    )}

                {destinationAccount &&
                    destinationAccount.status !== "Active" && (
                        <p className="transfer-warning" role="status">
                            The destination account is not Active.
                            Transaction processing may be rejected.
                        </p>
                    )}

                <div className="transfer-idempotency-notice">
                    <span className="material-symbols-rounded">
                        info
                    </span>

                    <span>
                        A unique idempotency key will be generated
                        automatically for this request and reused
                        if you retry.
                    </span>
                </div>

                {serverError && (
                    <div
                        className="transfer-server-error"
                        role="alert"
                    >
                        <span className="material-symbols-rounded">
                            error
                        </span>

                        <span>{serverError}</span>
                    </div>
                )}

                {loading && (
                    <p className="transfer-loading" role="status">
                        Loading financial accounts...
                    </p>
                )}

                {!loading &&
                    !serverError &&
                    accounts.length < 2 && (
                        <p className="transfer-warning" role="alert">
                            At least two accounts are required to
                            create a transfer.
                        </p>
                    )}

                <div className="transfer-form-actions">
                    <button
                        type="button"
                        className="transfer-cancel-button"
                        disabled={saving}
                        onClick={() =>
                            router.push(ROUTES.transactions)
                        }
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="transfer-submit-button"
                        disabled={!canSubmit}
                    >
                        {saving
                            ? "Creating Transfer..."
                            : "Create Transfer"}
                    </button>
                </div>
            </form>
        </section>
    );
}