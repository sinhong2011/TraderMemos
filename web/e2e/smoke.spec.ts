import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "demo@tradermemos.app";
const PASSWORD = process.env.E2E_PASSWORD ?? "hunter2";

test("login -> dashboard -> calendar -> trades -> detail -> stats", async ({ page }) => {
  await page.goto("/dashboard");
  await page.evaluate(() => {
    localStorage.removeItem("tm_token");
    localStorage.removeItem("tm_refresh");
  });
  await page.reload();

  // Login screen.
  await expect(page.getByText("Welcome back")).toBeVisible();
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

  // Stats (reports): the metrics grid must render — this is the assertion
  // that would have caught the missing-StatCard crash.
  await page.getByRole("link", { name: "Stats" }).click();
  await expect(page.getByText("Statistics")).toBeVisible();
  // .first(): the label appears in the metrics grid and the breakdown table.
  await expect(page.getByText("Profit Factor").first()).toBeVisible();
});

test("new trade drawer logs a trade", async ({ page }) => {
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

  // Open the drawer from the sidebar quick action.
  await page.getByRole("button", { name: "New Trade" }).click();
  await expect(page.getByText("Log any trade you've entered")).toBeVisible();

  const symbol = `E2E${Date.now() % 10000}`;
  // exact: the header search input is labelled "Search symbol" and would
  // also match a substring lookup.
  await page.getByLabel("Symbol", { exact: true }).fill(symbol);
  await page.getByLabel("Qty row 1").fill("5");
  await page.getByLabel("Price row 1").fill("10.50");
  // Buy-only creates an open position; Phase A lists open trades in the book.
  await page.getByRole("button", { name: "Save" }).click();

  // Drawer closes and the open trade shows up in the dashboard table. Scope to
  // the table body: the success toast can also contain the symbol, which
  // would otherwise trip Playwright's strict-mode duplicate-match check.
  await expect(page.getByText("Log any trade you've entered")).toBeHidden();
  await expect(page.locator("tbody").getByText(symbol)).toBeVisible();
  await expect(page.locator("tbody").getByText("OPEN").first()).toBeVisible();
});

test("new trade can still log a closed round-trip", async ({ page }) => {
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

  await page.getByRole("button", { name: "New Trade" }).click();
  await expect(page.getByText("Log any trade you've entered")).toBeVisible();

  const symbol = `CL${Date.now() % 10000}`;
  await page.getByLabel("Symbol", { exact: true }).fill(symbol);
  await page.getByLabel("Qty row 1").fill("5");
  await page.getByLabel("Price row 1").fill("10.50");
  await page.getByRole("button", { name: "Add execution row" }).click();
  await page.getByRole("button", { name: "Toggle action row 2" }).click();
  await page.getByLabel("Qty row 2").fill("5");
  await page.getByLabel("Price row 2").fill("11.00");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Log any trade you've entered")).toBeHidden();
  await expect(page.locator("tbody").getByText(symbol)).toBeVisible();
});
