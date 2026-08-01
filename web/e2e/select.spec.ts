import { expect, test } from "@playwright/test";

if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) {
  throw new Error("Set E2E_EMAIL and E2E_PASSWORD for e2e tests.");
}
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/home");
  await page.evaluate(() => {
    localStorage.removeItem("tm_token");
    localStorage.removeItem("tm_refresh");
  });
  await page.reload();
  await page.locator("#username").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/Wins/i).first()).toBeVisible();
}

test.describe("SignalSelect", () => {
  test("account popover and date-range control are available", async ({ page }) => {
    await signIn(page);

    const account = page.getByRole("button", { name: /Account:/i });
    await account.click();
    await expect(page.getByRole("button", { name: "All accounts", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    const dateRange = page
      .getByRole("combobox", { name: "Date range" })
      .or(page.getByRole("button", { name: "Date range" }));
    await dateRange.click();
    await expect(page.getByRole("button", { name: "Last 30 days" })).toBeVisible();

    const box = await page.getByRole("button", { name: "Last 30 days" }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(40);
  });

  test("select inside New Trade modal expands and selects an option", async ({ page }) => {
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
