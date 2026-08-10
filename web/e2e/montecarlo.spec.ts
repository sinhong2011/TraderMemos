/// <reference types="node" />
import { expect, test } from "@playwright/test";

if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) {
  throw new Error("Set E2E_EMAIL and E2E_PASSWORD for e2e tests.");
}
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

// Roadmap #129: the Monte Carlo card on Reports -> Risk must render real
// simulation output against a seeded book (>= 10 closed trades).
test("reports risk tab shows the Monte Carlo fan", async ({ page }) => {
  await page.goto("/home");
  await page.evaluate(() => {
    localStorage.removeItem("tm_token");
    localStorage.removeItem("tm_refresh");
  });
  await page.reload();

  await expect(page.getByText("Welcome back")).toBeVisible();
  await page.locator("#username").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/^Wins$/i).first()).toBeVisible();

  await page.getByRole("link", { name: "Reports" }).click();
  await page.getByRole("tab", { name: "Risk" }).click();

  // The card fetches lazily when the tab activates; wait through the skeleton.
  const card = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Monte Carlo" }) });
  await expect(card).toBeVisible();

  // Outcome tiles — real values, not the insufficient-data empty state.
  await expect(page.getByText("Not enough closed trades")).toBeHidden();
  await expect(page.getByText("Median Outcome")).toBeVisible();
  await expect(page.getByText("Best Case")).toBeVisible();
  await expect(page.getByText("Worst Case")).toBeVisible();
  await expect(page.getByText("Typical Max Drawdown")).toBeVisible();
  await expect(page.getByText("Chance of Profit")).toBeVisible();
  await expect(page.getByText("Risk of Ruin")).toBeVisible();

  // The i.i.d. caveat mandated by the issue, with the resample counts filled in.
  await expect(page.getByText(/resamples of your \d+ closed/)).toBeVisible();

  // The fan chart drew: recharts renders an SVG with area paths in the card.
  await expect(card.locator("svg.recharts-surface").first()).toBeVisible();
  await expect(card.locator("path.recharts-area-area").first()).toBeVisible();
});
