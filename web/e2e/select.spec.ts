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
    // Account entries are menu radio items inside the popover menu.
    await expect(page.getByRole("menuitemradio", { name: /All accounts/ })).toBeVisible();
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
    await page.getByRole("button", { name: "Create", exact: true }).first().click();
    await page.getByRole("button", { name: "New Trade" }).click();
    await expect(page.getByRole("heading", { name: "New Trade" })).toBeVisible();

    // Market is a native select now — assert it renders and takes a choice.
    const market = page.getByRole("combobox", { name: /Market symbol 1/ });
    await expect(market).toBeVisible();
    await market.selectOption({ index: 1 });
    await expect(market).not.toHaveValue("");
  });
});
