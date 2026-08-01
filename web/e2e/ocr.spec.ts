import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) {
  throw new Error("Set E2E_EMAIL and E2E_PASSWORD for e2e tests.");
}
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "fill-confirm.png",
);

async function signIn(page: Page) {
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

test("scan screenshot prefills new trade and saves", async ({ page }) => {
  const symbol = `OCR${Date.now() % 10000}`;
  // Use "now" so the saved trade lands in the home page's default date window
  // (same as the manual New Trade smoke path).
  const executedAt = new Date().toISOString();

  // Mock OCR so e2e does not require a Tesseract-enabled API build.
  await page.route("**/api/v1/ocr/parse", async (route) => {
    expect(route.request().method()).toBe("POST");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        symbol,
        instrument_type: "stock",
        side: "long",
        confidence: 0.92,
        raw_text: `${symbol} BUY 8 @ 12.34`,
        warnings: [],
        rows: [
          {
            side: "buy",
            quantity: 8,
            price: 12.34,
            fees: 0,
            commission: 0.5,
            executed_at: executedAt,
          },
        ],
      }),
    });
  });

  await signIn(page);
  await page.getByRole("button", { name: "New Trade" }).click();
  await expect(page.getByText("Log any trade you've entered")).toBeVisible();
  await expect(page.getByRole("button", { name: "Prefill trade from screenshot" })).toBeVisible();

  await page.getByTestId("ocr-scan-input").setInputFiles(FIXTURE);

  await expect(page.getByLabel("Symbol", { exact: true })).toHaveValue(symbol);
  await expect(page.getByLabel("Qty row 1")).toHaveValue("8");
  await expect(page.getByLabel("Price row 1")).toHaveValue("12.34");
  await expect(page.getByLabel("Commission row 1")).toHaveValue("0.5");
  await expect(page.getByRole("button", { name: /Toggle action row 1/i })).toHaveText(/BUY/i);

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Log any trade you've entered")).toBeHidden();
  await expect(page.locator("tbody").getByText(symbol)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("tbody").getByText("OPEN").first()).toBeVisible();
});

test("scan screenshot surfaces OCR unavailable without crashing the drawer", async ({ page }) => {
  await page.route("**/api/v1/ocr/parse", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "unavailable", message: "ocr not configured" },
      }),
    });
  });

  await signIn(page);
  await page.getByRole("button", { name: "New Trade" }).click();
  await expect(page.getByText("Log any trade you've entered")).toBeVisible();

  await page.getByTestId("ocr-scan-input").setInputFiles(FIXTURE);

  // Toast + drawer stay usable so the trader can still type the trade.
  await expect(page.getByText(/ocr not configured|OCR failed/i).first()).toBeVisible();
  await expect(page.getByText("Log any trade you've entered")).toBeVisible();
  await expect(page.getByLabel("Symbol", { exact: true })).toBeVisible();
});
