/// <reference types="node" />
import { expect, test } from "@playwright/test";

if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) {
  throw new Error("Set E2E_EMAIL and E2E_PASSWORD for e2e tests.");
}
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test("login -> home -> calendar -> trades -> detail -> stats", async ({ page }) => {
  await page.goto("/home");
  await page.evaluate(() => {
    localStorage.removeItem("tm_token");
    localStorage.removeItem("tm_refresh");
  });
  await page.reload();

  // Login screen.
  await expect(page.getByText("Welcome back")).toBeVisible();
  await page.locator("#username").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Home: stats strip + range control.
  await expect(page.getByText(/^Wins$/i).first()).toBeVisible();
  await expect(page.getByText(/^Losses$/i).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "30D" }).or(page.getByRole("tab", { name: "30D" })),
  ).toBeVisible();

  // Calendar: month stats header + WEEK column.
  await page.getByRole("link", { name: "Calendar" }).click();
  await expect(page.getByText("Week", { exact: true })).toBeVisible();
  // "Today" moved into the month-picker popover.
  await page.getByRole("button", { name: /choose month/i }).click();
  await expect(page.getByRole("button", { name: "Today" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Trades log -> open a trade (sheet) -> full detail page.
  await page.getByRole("link", { name: "Trades" }).click();
  // "Log trade" only shows in the empty state; the filter bar is always there.
  await expect(page.getByRole("button", { name: "Add filter" })).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await page.locator("tbody tr").first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Open full page" }).click();
  await expect(page.getByText("Back to trades")).toBeVisible();

  // Reports: the metrics grid must render — this is the assertion
  // that would have caught the missing-StatCard crash.
  await page.getByRole("link", { name: "Reports" }).click();
  // The overview bento replaced the old "Statistics" card.
  await expect(page.getByText("Profit factor").first()).toBeVisible();
  // .first(): the label appears in the metrics grid and the breakdown table.
  await expect(page.getByText("Profit Factor").first()).toBeVisible();
});

test("new trade drawer logs a trade", async ({ page }) => {
  await page.goto("/home");
  await page.evaluate(() => {
    localStorage.removeItem("tm_token");
    localStorage.removeItem("tm_refresh");
  });
  await page.reload();
  await page.locator("#username").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/WINS|Wins/i).first()).toBeVisible();

  // Open the drawer from the sidebar quick action.
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "New Trade" }).click();
  await expect(page.getByRole("dialog", { name: "New Trade" })).toBeVisible();

  const symbol = `E2E${Date.now() % 10000}`;
  // exact: the header search input is labelled "Search symbol" and would
  // also match a substring lookup.
  await page.getByRole("textbox", { name: "Symbol", exact: true }).fill(symbol);
  await page.getByLabel("Qty row 1").fill("5");
  await page.getByLabel("Price row 1").fill("10.50");
  // Buy-only creates an open position; Phase A lists open trades in the book.
  await page.getByRole("button", { name: "Save" }).click();

  // Drawer closes and the open trade shows up in the home table. Scope to
  // the table body: the success toast can also contain the symbol, which
  // would otherwise trip Playwright's strict-mode duplicate-match check.
  await expect(page.getByRole("dialog", { name: "New Trade" })).toBeHidden();
  await expect(page.locator("tbody").getByText(symbol)).toBeVisible();
  await expect(page.locator("tbody").getByText("OPEN").first()).toBeVisible();
});

test("new trade can still log a closed round-trip", async ({ page }) => {
  await page.goto("/home");
  await page.evaluate(() => {
    localStorage.removeItem("tm_token");
    localStorage.removeItem("tm_refresh");
  });
  await page.reload();
  await page.locator("#username").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/WINS|Wins/i).first()).toBeVisible();

  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "New Trade" }).click();
  await expect(page.getByRole("dialog", { name: "New Trade" })).toBeVisible();

  const symbol = `CL${Date.now() % 10000}`;
  await page.getByRole("textbox", { name: "Symbol", exact: true }).fill(symbol);
  await page.getByLabel("Qty row 1").fill("5");
  await page.getByLabel("Price row 1").fill("10.50");
  await page.getByRole("button", { name: "Add execution row" }).click();
  await page.getByRole("button", { name: /Toggle action.*row 2/ }).click();
  await page.getByLabel("Qty row 2").fill("5");
  await page.getByLabel("Price row 2").fill("11.00");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("dialog", { name: "New Trade" })).toBeHidden();
  await expect(page.locator("tbody").getByText(symbol)).toBeVisible();
});
