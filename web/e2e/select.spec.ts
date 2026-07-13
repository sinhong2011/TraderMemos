import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "demo@tradermemos.app";
const PASSWORD = process.env.E2E_PASSWORD ?? "hunter2";

async function signIn(page: import("@playwright/test").Page) {
	await page.goto("/dashboard");
	await page.evaluate(() => {
		localStorage.removeItem("tm_token");
		localStorage.removeItem("tm_refresh");
	});
	await page.reload();
	await page.locator("#email").fill(EMAIL);
	await page.locator("#password").fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page.getByText(/WINS/).first()).toBeVisible();
}

test.describe("SignalSelect", () => {
	test("account-and-filters popover expands and shows date presets", async ({
		page,
	}) => {
		await signIn(page);

		// Account + date range now live in the sidebar "Account and filters"
		// popover, not a standalone header SignalSelect.
		const trigger = page.getByRole("button", { name: "Account and filters" });
		await trigger.click();

		const popup = page.getByRole("dialog");
		await expect(popup).toBeVisible();
		await expect(popup.getByRole("combobox", { name: "Account" })).toBeVisible();
		await expect(
			popup.getByRole("button", { name: "Last 30 days" }),
		).toBeVisible();

		const box = await popup.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.width).toBeGreaterThan(40);
		expect(box!.height).toBeGreaterThan(40);
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(
			page.viewportSize()!.width + 1,
		);
	});

	test("select inside New Trade modal expands and selects an option", async ({
		page,
	}) => {
		await signIn(page);
		await page.getByRole("button", { name: "New Trade" }).click();
		await expect(page.getByRole("heading", { name: "New Trade" })).toBeVisible();

		const market = page.getByRole("combobox", { name: "Market" });
		await market.click();

		const listbox = page.getByRole("listbox").last();
		await expect(listbox).toBeVisible();

		const box = await listbox.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.width).toBeGreaterThan(40);
		expect(box!.height).toBeGreaterThan(40);

		await listbox.getByRole("option").first().click();
		await expect(market).not.toHaveText("Select…");
	});
});
