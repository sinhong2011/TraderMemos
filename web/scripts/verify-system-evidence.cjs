/* eslint-disable */
// Drives the holding-evidence timeline and the revise-step scoring fix.
const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const BASE_URL = process.env.TM_E2E_BASE_URL || "http://127.0.0.1:5173";
const EMAIL = "system-map-e2e@example.com";
const PASSWORD = "password123";
const SHOT_DIR = process.env.TM_E2E_SHOT_DIR || "/opt/cursor/artifacts/screenshots";

fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
function record(id, pass, note) {
  results.push({ id, pass, note });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}${note ? " — " + note : ""}`);
}

async function shot(page, name) {
  await page
    .evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))))
    .catch(() => {});
  await page.waitForTimeout(250);
  const p = path.join(SHOT_DIR, name);
  await page.screenshot({ path: p, fullPage: false });
  console.log("screenshot:", p);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console.error]", msg.text().slice(0, 300));
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && res.url().includes("/api/")) {
      console.log("[http]", res.status(), res.url());
    }
  });

  try {
    await page.goto(`${BASE_URL}/home`);
    await page.evaluate(() => {
      localStorage.setItem("tm-locale", "en");
      localStorage.removeItem("tm_token");
      localStorage.removeItem("tm_refresh");
    });
    await page.reload();
    await page.getByText("Welcome back").waitFor({ timeout: 15000 });
    await page.locator("#username").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator('form button[type="submit"]').click();
    await page.getByRole("link", { name: "System" }).waitFor();

    await page.goto(`${BASE_URL}/system`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Four-week plan" }).waitFor();
    const revise = page.getByRole("button", { name: /Revise the version/ });
    const reviseText = await revise.innerText();
    const reviseCheck = await revise.locator("svg").count();
    record(
      "revise-not-done",
      reviseText.includes("1 / 1") && !reviseText.includes("Done") && reviseCheck === 0,
      reviseText.replace(/\s+/g, " "),
    );
    const write = page.getByRole("button", { name: /Write v1.0/ });
    record("write-is-current", (await write.getAttribute("aria-current")) === "step");
    await shot(page, "evidence-01-stepper.png");

    const plans = await page.evaluate(async () => {
      const token = localStorage.getItem("tm_token");
      const res = await fetch("/api/v1/system/plans", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    });
    const taken = plans.find((p) => p.status === "taken" && p.trade_id);
    record("has-taken-plan", Boolean(taken), taken ? taken.symbol : "none");
    if (!taken) throw new Error("no taken plan to attach evidence to");

    const cardOk = await page.evaluate(async (tradeId) => {
      const token = localStorage.getItem("tm_token");
      const res = await fetch(`/api/v1/trades/${tradeId}/system-card`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ time_stop_days: 1, thesis: "qa time stop" }),
      });
      return res.status;
    }, taken.trade_id);
    record("time-stop-card", cardOk === 200, String(cardOk));

    await page.goto(`${BASE_URL}/system?mode=follow&plan=${taken.id}&node=review`, {
      waitUntil: "networkidle",
    });
    const evidence = page.getByRole("heading", { name: "Evidence at the time" }).or(
      page.getByText("Evidence at the time").first(),
    );
    await page.getByText("Evidence at the time").first().waitFor();
    await page.getByText(/time stop was due/i).scrollIntoViewIfNeeded();
    record("time-stop-prompt", await page.getByText(/time stop was due/i).isVisible());
    await shot(page, "evidence-02-prompt.png");

    await page.locator('select[aria-label="Action"]').selectOption("add");
    await page.getByText("Adding or trimming is a note").waitFor();
    record("scaling-hint", await page.getByText("not an order").first().isVisible());
    await page.getByRole("textbox", { name: "Evidence note", exact: true }).fill("Volume held above the pivot");
    await shot(page, "evidence-03-compose.png");
    await page.getByRole("button", { name: "Record", exact: true }).click();
    await page.getByText("Evidence recorded").waitFor();
    await page.getByText("Volume held above the pivot").first().waitFor();
    record("recorded", true);
    await shot(page, "evidence-04-recorded.png");

    await page.getByRole("button", { name: "Correct" }).click();
    await page.getByText("Correcting this note").waitFor();
    await page.getByRole("textbox", { name: "Evidence note", exact: true }).fill("Abandoned wording");
    await page.getByRole("button", { name: "Cancel" }).click();
    record("cancel-correction", (await page.getByText("Abandoned wording").count()) === 0);
    record(
      "original-kept",
      (await page.getByText("Volume held above the pivot").count()) >= 1,
    );

    await page.getByRole("button", { name: "Correct" }).click();
    await page.getByRole("textbox", { name: "Evidence note", exact: true }).fill("Volume faded after the add");
    await page.getByRole("button", { name: "Save correction" }).click();
    await page.getByText("Correction saved").waitFor();
    await page.getByText("Volume faded after the add").first().waitFor();
    record(
      "correction-keeps-original",
      (await page.getByText("Volume held above the pivot").count()) >= 1 &&
        (await page.getByText("Earlier revisions").count()) >= 1,
    );
    await shot(page, "evidence-05-corrected.png");

    await page.getByRole("button", { name: "Withdraw" }).click();
    const dialog = page.locator('[data-slot="dialog-content"]');
    await dialog.getByRole("heading", { name: "Withdraw this note" }).waitFor();
    await dialog.getByRole("button", { name: "Back" }).click();
    await dialog.waitFor({ state: "hidden" });
    record("withdraw-cancel", (await page.getByRole("button", { name: "Correct" }).count()) === 1);

    await page.getByRole("button", { name: "Withdraw" }).click();
    await dialog.getByLabel("Reason").fill("Wrote the wrong moment");
    await dialog.getByRole("button", { name: "Withdraw" }).click();
    await page.getByText("Note withdrawn").waitFor();
    await page.getByText(/Withdrawn /).first().waitFor();
    record("withdrawn", (await page.getByRole("button", { name: "Correct" }).count()) === 0);
    record(
      "withdrawn-keeps-text",
      (await page.getByText("Volume faded after the add").count()) >= 1,
    );
    await shot(page, "evidence-06-withdrawn.png");

    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Volume faded after the add").first().waitFor();
    record("read-back", (await page.getByText(/Withdrawn /).count()) >= 1);
    await shot(page, "evidence-07-reentry.png");

    const cancelled = plans.find((p) => p.status === "cancelled" || p.status === "planned");
    if (cancelled) {
      await page.locator('select[aria-label="Plan"]').selectOption(cancelled.id);
      await page.getByText("Link a trade to record what you saw while holding").waitFor();
      record("not-taken", true, cancelled.status);
      await shot(page, "evidence-08-not-taken.png");
      await page.locator('select[aria-label="Plan"]').selectOption(taken.id);
      await page.getByText("Volume faded after the add").first().waitFor();
      record("back-to-taken", true);
    } else {
      record("not-taken", false, "no other plan to switch to");
    }
  } catch (err) {
    console.error(err);
    await shot(page, "evidence-fail.png").catch(() => {});
    record("threw", false, String(err).slice(0, 400));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(JSON.stringify({ pass: results.length - failed.length, fail: failed.length, results }, null, 2));
  if (failed.length) process.exit(1);
}

main();
