/// <reference types="node" />
import { expect, test, type Page } from "@playwright/test";

if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) {
  throw new Error("Set E2E_EMAIL and E2E_PASSWORD for e2e tests.");
}
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

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

// Cooldown mode is opt-in, so every spec here turns it on first.
async function enableCooldown(page: Page) {
  await page.goto("/settings#rules");
  const toggle = page.getByRole("switch", { name: "Cooldown mode" });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
}

// The feature adds a lock on trade entry, so it stays invisible until asked for.
test("cooldown mode is off by default and hides its surfaces", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings#rules");
  const toggle = page.getByRole("switch", { name: "Cooldown mode" });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-checked")) === "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  // The Auto cooldown limit belongs to the feature and goes with it.
  await expect(page.getByText("Auto cooldown")).toBeHidden();

  await page.getByRole("link", { name: "Trades" }).click();
  await expect(page.getByRole("button", { name: "Add filter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cooldown" })).toBeHidden();
});

// The whole circuit breaker in one pass: start from the Trades toolbar, the
// lock (veil, capsule, tab title, new-trade redirect), the early return gate
// with its forced reflection, and the release putting everything back.
test("cooldown locks trade entry and the return gate unlocks it", async ({ page }) => {
  await signIn(page);
  await enableCooldown(page);
  await page.getByRole("link", { name: "Trades" }).click();
  await expect(page.getByRole("button", { name: "Add filter" })).toBeVisible();

  // Start face: 2 minutes, no impulse named yet.
  await page.getByRole("button", { name: "Cooldown" }).click();
  const dialog = page.getByRole("dialog", { name: "Take a cooldown" });
  await expect(dialog).toBeVisible();
  await dialog.getByText("2 min", { exact: true }).click();
  await dialog.getByRole("button", { name: "Start 2 min" }).click();

  // Counting face; the tab title carries the clock.
  await expect(page.getByRole("dialog", { name: "Cooling down" })).toBeVisible();
  await expect(page).toHaveTitle(/⏸/);

  // Closing the dialog keeps the lock: veil over the list, floating capsule.
  await page
    .getByRole("dialog", { name: "Cooling down" })
    .getByRole("button", { name: "Close" })
    .click();
  await expect(page.getByText("Trade entry is locked")).toBeVisible();
  const capsule = page.getByRole("button", { name: /Cooling down/ });
  await expect(capsule).toBeVisible();

  // "New trade" from anywhere lands on the cooldown, not the form.
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "New Trade" }).click();
  await expect(page.getByRole("dialog", { name: "Cooling down" })).toBeVisible();

  // Early unlock: no impulse and no reflection → Unlock stays inert.
  await page.getByRole("button", { name: "I need to trade now" }).click();
  const gate = page.getByRole("dialog", { name: "Before you go back" });
  await expect(gate).toBeVisible();
  const unlock = gate.getByRole("button", { name: "Unlock" });
  await expect(unlock).toBeDisabled();

  await gate.getByRole("button", { name: "Revenge" }).click();
  await expect(unlock).toBeDisabled();
  await gate
    .locator("#cooldown-reflection")
    .fill("I want the loss back right now and that is exactly the trade I always regret.");
  await gate.getByRole("radio", { name: /One trade/ }).click();
  await expect(unlock).toBeEnabled();
  await unlock.click();

  // Released: dialog, veil, capsule and the title all reset.
  await expect(gate).toBeHidden();
  await expect(page.getByText("Trade entry is locked")).toBeHidden();
  await expect(capsule).toBeHidden();
  await expect(page).toHaveTitle(/^TraderMemos$/);

  // The form opens again now that the lock is gone.
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "New Trade" }).click();
  await expect(page.getByRole("dialog", { name: "New Trade" })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("?panel=cooldown opens the panel once and strips the param", async ({ page }) => {
  await signIn(page);
  await enableCooldown(page);
  await page.goto("/trades?panel=cooldown");
  await expect(page.getByRole("dialog", { name: "Take a cooldown" })).toBeVisible();
  await expect(page).toHaveURL(/\/trades$/);
  await page
    .getByRole("dialog", { name: "Take a cooldown" })
    .getByRole("button", { name: "Close" })
    .click();
  await expect(page.getByRole("dialog", { name: "Take a cooldown" })).toBeHidden();
});
