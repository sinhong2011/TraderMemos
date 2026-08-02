/// <reference types="node" />
import { expect, test } from "@playwright/test";

if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) {
  throw new Error("Set E2E_EMAIL and E2E_PASSWORD for e2e tests.");
}
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

const OUT = process.env.SHOT_DIR ?? ".";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/home");
  await page.evaluate(() => {
    localStorage.removeItem("tm_token");
    localStorage.removeItem("tm_refresh");
  });
  await page.reload();
  await page.locator("#username").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("tools popover — short viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 620 });
  await login(page);
  await page.getByRole("button", { name: "Tools", exact: true }).first().click();
  await expect(page.locator("[data-slot=popover-popup]")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/tools-short.png` });
});

test("tools popover — mobile drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /more/i }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Tools", exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/tools-mobile.png` });
});
