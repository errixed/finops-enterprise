
import {
    test,
    expect
} from "@playwright/test";

const routes = [
    "/",
    "/clients",
    "/clients/new",
    "/accounts",
    "/accounts/new",
    "/transactions",
    "/transactions/new",
    "/transactions/history",
    "/risk",
    "/risk/policies",
    "/risk/policies/new",
    "/risk/assessments",
    "/risk/alerts",
    "/risk/analytics",
    "/risk/cases",
    "/risk/cases/new",
    "/approvals",
    "/approvals/queue",
    "/approvals/workflows",
    "/approvals/workflows/new",
    "/approvals/policies",
    "/approvals/policies/new",
    "/approvals/decisions",
    "/approvals/audit"
];

for (const route of routes) {
    test(`Page renders: ${route}`, async ({ page }) => {
        const response = await page.goto(route);

        expect(response).not.toBeNull();

        expect(response!.status()).toBeLessThan(400);

        await expect(page.locator("body")).toBeVisible();

        await expect(page.locator("body")).not.toBeEmpty();
    });
}

test("Client creation page contains form inputs", async ({
    page
}) => {
    await page.goto("/clients/new");

    const inputs = page.locator("input, select, textarea");

    expect(await inputs.count()).toBeGreaterThan(0);
});

test("Account creation page contains form inputs", async ({
    page
}) => {
    await page.goto("/accounts/new");

    const inputs = page.locator("input, select, textarea");

    expect(await inputs.count()).toBeGreaterThan(0);
});

test("Transaction creation page contains form inputs", async ({
    page
}) => {
    await page.goto("/transactions/new");

    const inputs = page.locator("input, select, textarea");

    expect(await inputs.count()).toBeGreaterThan(0);
});

test("Risk policy creation page renders", async ({
    page
}) => {
    await page.goto("/risk/policies/new");

    await expect(page.locator("body")).toBeVisible();

    await expect(page.locator("main")).not.toBeEmpty();
});

test("Approval workflow creation page renders", async ({
    page
}) => {
    await page.goto("/approvals/workflows/new");

    await expect(page.locator("body")).toBeVisible();
});

test("Navigation between major modules works", async ({
    page
}) => {
    const modules = [
        "/clients",
        "/accounts",
        "/transactions",
        "/risk",
        "/approvals"
    ];

    for (const route of modules) {
        await page.goto(route);

        await expect(page).toHaveURL(
            new RegExp(`${route.replaceAll("/", "\\/")}/?$`)
        );
    }
});

test("Application does not show Next.js runtime errors", async ({
    page
}) => {
    const runtimeErrors: string[] = [];

    page.on("pageerror", error => {
        runtimeErrors.push(error.message);
    });

    const response = await page.goto("/", {
        waitUntil: "domcontentloaded"
    });

    expect(response?.status()).toBe(200);

    await expect(page.locator("body")).toBeVisible();

    await expect(page.locator("main")).toBeVisible();

    expect(runtimeErrors).toEqual([]);
});

test("Navigation works at mobile viewport width", async ({
    page
}) => {
    await page.setViewportSize({
        width: 390,
        height: 844
    });

    await page.goto("/");

    await expect(page.locator("body")).toBeVisible();

    await page.goto("/transactions");

    await expect(page.locator("body")).toBeVisible();
});
