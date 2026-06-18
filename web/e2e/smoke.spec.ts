import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "demo@tradermemos.app";
const PASSWORD = process.env.E2E_PASSWORD ?? "hunter2";

test("login -> dashboard -> calendar -> trades -> detail -> reports", async ({
	page,
}) => {
	// Start unauthenticated.
	await page.goto("/dashboard");
	await page.evaluate(() => localStorage.removeItem("tm_token"));
	await page.reload();

	// Login screen.
	await expect(page.getByText("Sign in to your journal")).toBeVisible();
	await page.locator("#email").fill(EMAIL);
	await page.locator("#password").fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();

	// Dashboard renders KPIs (these labels are unique on the page).
	await expect(page.getByText("WIN RATE")).toBeVisible();
	await expect(page.getByText("PROFIT FACTOR")).toBeVisible();
	await expect(page.getByText("EQUITY CURVE")).toBeVisible();

	// Calendar.
	await page.getByRole("link", { name: "Calendar" }).click();
	await expect(page.getByText("P&L CALENDAR")).toBeVisible();

	// Trades log -> open a trade -> detail.
	await page.getByRole("link", { name: "Trades" }).click();
	await expect(page.getByText(/\d+ trades/)).toBeVisible();
	await page.locator("tbody tr").first().click();
	await expect(page.getByText("Back to trades")).toBeVisible();
	await expect(page.getByText("JOURNAL")).toBeVisible();

	// Reports.
	await page.getByRole("link", { name: "Reports" }).click();
	await expect(page.getByText("REPORTS")).toBeVisible();
});
