"use client";

import {
    FormEvent,
    useEffect,
    useRef,
    useState
} from "react";
import { useRouter } from "next/navigation";
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

export default function TransactionCreatePage() {
    const router = useRouter();

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [sourceAccountId, setSourceAccountId] = useState("");
    const [destinationAccountId, setDestinationAccountId] =
        useState("");

    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Retain the key when retrying the same request.
    const idempotencyKey = useRef<string | null>(null);
    const submitting = useRef(false);

    useEffect(() => {
        let active = true;

        async function loadAccounts() {
            setLoading(true);
            setError("");

            try {
                const result = await getAccounts();

                if (active) {
                    setAccounts(result);
                }
            } catch (err) {
                if (active) {
                    setError(
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

    const sourceAccount = accounts.find(
        account => account.accountId === sourceAccountId
    );

    const destinationAccount = accounts.find(
        account => account.accountId === destinationAccountId
    );

    const availableDestinations = accounts.filter(account =>
        account.accountId !== sourceAccountId &&
        account.currency === sourceAccount?.currency
    );

    function resetSubmission() {
        idempotencyKey.current = null;
        setError("");
    }

    function changeSource(value: string) {
        setSourceAccountId(value);
        setDestinationAccountId("");
        resetSubmission();
    }

    function changeDestination(value: string) {
        setDestinationAccountId(value);
        resetSubmission();
    }

    function changeAmount(value: string) {
        setAmount(value);
        resetSubmission();
    }

    function changeDescription(value: string) {
        setDescription(value);
        resetSubmission();
    }

    function formatAmountOnBlur() {
        if (!amount.trim()) return;

        try {
            const minor = parseMoney(amount);

            const whole = BigInt(minor) / BigInt(100);
            const cents = BigInt(minor) % BigInt(100);

            setAmount(
                `${whole}.${cents.toString().padStart(2, "0")}`
            );
        } catch {
            return;
        }
    }

    function validate(): TransactionInput {
        if (!sourceAccount) {
            throw new Error("Please select a source account");
        }

        if (!destinationAccount) {
            throw new Error("Please select a destination account");
        }

        if (sourceAccount.accountId === destinationAccount.accountId) {
            throw new Error(
                "Source and destination accounts must differ"
            );
        }

        if (sourceAccount.currency !== destinationAccount.currency) {
            throw new Error(
                "Source and destination accounts must use the same currency"
            );
        }

        const amountMinor = parseMoney(amount);

        if (amountMinor <= 0) {
            throw new Error(
                "Transfer amount must be greater than zero"
            );
        }

        if (description.length > 250) {
            throw new Error(
                "Description cannot exceed 250 characters"
            );
        }

        return {
            sourceAccountId: sourceAccount.accountId,
            destinationAccountId: destinationAccount.accountId,
            amountMinor,
            currency: sourceAccount.currency,
            description
        };
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (submitting.current) return;

        setError("");

        let input: TransactionInput;

        try {
            input = validate();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Invalid transaction information"
            );
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
                ROUTES.transactionDetails(transaction.transactionId)
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to initiate transaction"
            );
        } finally {
            submitting.current = false;
            setSaving(false);
        }
    }

    function accountLabel(account: Account) {
        return [
            account.accountNumber,
            account.companyName ?? "Unknown client",
            account.currency,
            account.status,
            formatMoney(account.balanceMinor, account.currency)
        ].join(" | ");
    }

    return (
        <section className="account-registration-page">
            <div className="account-registration-heading">
                <h1>New Transaction</h1>
                <p>
                    Initiate a financial transfer between existing accounts
                </p>
            </div>

            <form
                className="account-registration-form"
                onSubmit={submit}
            >
                <div className="account-registration-fields">

                    <label className="account-registration-field">
                        <span>
                            Source Account
                            <span className="required-star"> *</span>
                        </span>

                        <select
                            required
                            value={sourceAccountId}
                            disabled={loading || saving}
                            onChange={event =>
                                changeSource(event.target.value)
                            }
                        >
                            <option value="">
                                {loading
                                    ? "Loading accounts..."
                                    : "Select source account"}
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
                    </label>

                    {sourceAccount && (
                        <div className="transaction-account-summary">
                            <strong>Source Account</strong>
                            <span>
                                Account: {sourceAccount.accountNumber}
                            </span>
                            <span>
                                Client: {sourceAccount.companyName ?? "Unknown"}
                            </span>
                            <span>
                                Currency: {sourceAccount.currency}
                            </span>
                            <span>
                                Status: {sourceAccount.status}
                            </span>
                            <span>
                                Available Balance:{" "}
                                {formatMoney(
                                    sourceAccount.balanceMinor,
                                    sourceAccount.currency
                                )}
                            </span>
                        </div>
                    )}

                    <label className="account-registration-field">
                        <span>
                            Destination Account
                            <span className="required-star"> *</span>
                        </span>

                        <select
                            required
                            value={destinationAccountId}
                            disabled={
                                loading ||
                                saving ||
                                !sourceAccount
                            }
                            onChange={event =>
                                changeDestination(event.target.value)
                            }
                        >
                            <option value="">
                                {!sourceAccount
                                    ? "Select a source account first"
                                    : "Select destination account"}
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
                    </label>

                    {destinationAccount && (
                        <div className="transaction-account-summary">
                            <strong>Destination Account</strong>
                            <span>
                                Account: {destinationAccount.accountNumber}
                            </span>
                            <span>
                                Client: {destinationAccount.companyName ?? "Unknown"}
                            </span>
                            <span>
                                Currency: {destinationAccount.currency}
                            </span>
                            <span>
                                Status: {destinationAccount.status}
                            </span>
                            <span>
                                Current Balance:{" "}
                                {formatMoney(
                                    destinationAccount.balanceMinor,
                                    destinationAccount.currency
                                )}
                            </span>
                        </div>
                    )}

                    <label className="account-registration-field">
                        <span>
                            Transfer Amount
                            <span className="required-star"> *</span>
                        </span>

                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            required
                            value={amount}
                            disabled={saving}
                            onChange={event =>
                                changeAmount(event.target.value)
                            }
                            onBlur={formatAmountOnBlur}
                            aria-describedby="transaction-amount-help"
                        />

                        <small id="transaction-amount-help">
                            Enter an amount in{" "}
                            {sourceAccount?.currency ?? "the selected currency"}
                            {" "}(e.g. 2500.00).
                        </small>
                    </label>

                    <label className="account-registration-field">
                        <span>Transaction Description</span>

                        <textarea
                            className="transaction-description-input"
                            value={description}
                            maxLength={250}
                            disabled={saving}
                            rows={4}
                            placeholder="Enter transaction description"
                            onChange={event =>
                                changeDescription(event.target.value)
                            }
                        />

                        <small>
                            {description.length}/250 characters
                        </small>
                    </label>

                    {sourceAccount?.status !== "Active" &&
                        sourceAccount && (
                            <p className="transaction-form-warning">
                                The source account is not Active.
                                Processing may be rejected.
                            </p>
                        )}

                    {destinationAccount?.status !== "Active" &&
                        destinationAccount && (
                            <p className="transaction-form-warning">
                                The destination account is not Active.
                                Processing may be rejected.
                            </p>
                        )}

                    <p className="transaction-form-notice">
                        Submitting this form creates a Pending transaction.
                        Account balances will not change until the
                        transaction is processed.
                    </p>
                </div>

                {error && (
                    <p className="corporate-form-error" role="alert">
                        {error}
                    </p>
                )}

                {loading && (
                    <p role="status">Loading financial accounts...</p>
                )}

                {!loading && accounts.length === 0 && (
                    <p className="corporate-form-error" role="alert">
                        No accounts are available.
                    </p>
                )}

                <div className="account-registration-actions">
                    <button
                        type="button"
                        className="corporate-cancel-button"
                        disabled={saving}
                        onClick={() =>
                            router.push(ROUTES.transactions)
                        }
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="corporate-submit-button"
                        disabled={
                            loading ||
                            saving ||
                            accounts.length < 2
                        }
                    >
                        {saving
                            ? "Creating Transaction..."
                            : "Create Transaction"}
                    </button>
                </div>
            </form>
        </section>
    );
}