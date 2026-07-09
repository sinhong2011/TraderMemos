import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "demo@tradermemos.app";
const PASSWORD = process.env.E2E_PASSWORD ?? "hunter2";

test("login -> dashboard -> calendar -> trades -> detail -> stats", async ({
	page,
}) => {
	await page.goto("/dashboard");
	await page.evaluate(() => localStorage.removeItem("tm_token"));
	await page.reload();

	// Login screen.
	await expect(page.getByText("Sign in to your journal")).toBeVisible();
	await page.locator("#email").fill(EMAIL);
	await page.locator("#password").fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();

	// Dashboard: stats strip + range control.
	await expect(page.getByText(/WINS/).first()).toBeVisible();
	await expect(page.getByText(/LOSSES/).first()).toBeVisible();
	await expect(page.getByRole("button", { name: "30D" })).toBeVisible();

	// Calendar: month stats header + WEEK column.
	await page.getByRole("link", { name: "Calendar" }).click();
	await expect(page.getByText("WEEK")).toBeVisible();
	await expect(page.getByRole("button", { name: "Today" })).toBeVisible();

	// Trades log -> open a trade -> detail.
	await page.getByRole("link", { name: "Trades" }).click();
	await expect(page.getByText(/\d+ trades/)).toBeVisible();
	await page.locator("tbody tr").first().click();
	await expect(page.getByText("Back to trades")).toBeVisible();

	// Stats (reports).
	await page.getByRole("link", { name: "Stats" }).click();
	await expect(page.getByText("REPORTS")).toBeVisible();
});

test("new trade drawer logs a trade", async ({ page }) => {
	await page.goto("/dashboard");
	await page.evaluate(() => localStorage.removeItem("tm_token"));
	await page.reload();
	await page.locator("#email").fill(EMAIL);
	await page.locator("#password").fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page.getByText(/WINS/).first()).toBeVisible();

	// Open the drawer from the sidebar quick action.
	await page.getByRole("button", { name: "New Trade" }).click();
	await expect(page.getByText("Log any trade you've entered")).toBeVisible();

	const symbol = `E2E${Date.now() % 10000}`;
	// exact: the header search input is labelled "Search symbol" and would
	// also match a substring lookup.
	await page.getByLabel("Symbol", { exact: true }).fill(symbol);
	await page.getByLabel("Qty row 1").fill("5");
	await page.getByLabel("Price row 1").fill("10.50");
	await page.getByRole("button", { name: "Save" }).click();

	// Drawer closes and the trade shows up in the dashboard table.
	await expect(page.getByText("Log any trade you've entered")).toBeHidden();
	await expect(page.getByText(symbol)).toBeVisible();
});
