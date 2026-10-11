export function validateMinorUnits(amount) {
    if (!Number.isSafeInteger(amount) || amount < 0) {
        const error = new Error(
            "Amount must be a non-negative safe integer in minor units"
        );

        error.statusCode = 400;
        error.details = { field: "balanceMinor" };

        throw error;
    }

    return amount;
}

export function formatMoney(amountMinor, currency) {
    if (!["CAD", "USD"].includes(currency)) {
        throw new Error("Unsupported currency");
    }

    validateMinorUnits(amountMinor);

    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency
    }).format(amountMinor / 100);
}