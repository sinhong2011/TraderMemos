import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "demo@tradermemos.app";
const PASSWORD = process.env.E2E_PASSWORD ?? "hunter2";

async function signIn(page: import("@playwright/test").Page) {
	await page.goto("/dashboard");
	await page.evaluate(() => localStorage.removeItem("tm_token"));
	await page.reload();
	await page.locator("#email").fill(EMAIL);
	await page.locator("#password").fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page.getByText(/WINS/).first()).toBeVisible();
}

test.describe("SignalSelect", () => {
	test("header date range expands and shows options", async ({ page }) => {
		await signIn(page);

		const trigger = page.getByRole("combobox", { name: "Date range" });
		await trigger.click();

		const listbox = page.getByRole("listbox");
		await expect(listbox).toBeVisible();
		await expect(listbox.getByRole("option", { name: "Last 30 days" })).toBeVisible();

		const box = await listbox.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.width).toBeGreaterThan(40);
		expect(box!.height).toBeGreaterThan(40);
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
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
