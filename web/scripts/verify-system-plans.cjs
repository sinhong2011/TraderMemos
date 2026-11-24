/* eslint-disable */
// Drives Follow trade plan flows against the local QA server.
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

async function clickNode(page, title) {
  const node = page.locator(".react-flow__node").filter({ hasText: title }).first();
  await node.click();
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const httpErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console.error]", msg.text().slice(0, 300));
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && res.url().includes("/api/")) {
      httpErrors.push(`${res.status()} ${res.url()}`);
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
    await page.getByText("Welcome back").waitFor({ timeout: 10000 });
    await page.locator("#username").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator('form button[type="submit"]').click();
    await page.waitForTimeout(800);
    await page.goto(`${BASE_URL}/system?mode=follow`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Trading system" }).waitFor();
    await page.getByRole("button", { name: "New plan" }).first().waitFor();
    await shot(page, "plan-01-empty-follow.png");
    record("empty-follow", await page.getByText("No plan open").isVisible(), "no plan banner");

    // Cancel a new plan, then reopen and confirm the form starts blank.
    await page.getByRole("button", { name: "New plan" }).first().click();
    const dialog = page.locator('[data-slot="dialog-content"]');
    await dialog.getByRole("heading", { name: "New plan" }).waitFor();
    await dialog.getByLabel("Symbol").fill("SHOULD-CLEAR");
    await shot(page, "plan-02-new-dialog.png");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await dialog.waitFor({ state: "hidden" });
    record(
      "cancel-new",
      !(await page
        .getByText("SHOULD-CLEAR")
        .isVisible()
        .catch(() => false)),
    );

    await page.getByRole("button", { name: "New plan" }).first().click();
    await dialog.getByLabel("Symbol").waitFor();
    const reentry = await dialog.getByLabel("Symbol").inputValue();
    record("reentry-blank", reentry === "", `symbol="${reentry}"`);
    await shot(page, "plan-03-reentry-blank.png");

    await dialog.getByLabel("Symbol").fill("nvda");
    await dialog.getByLabel("Thesis (optional)").fill("Base breakout before the fill");
    await dialog.getByRole("button", { name: "Create plan" }).click();
    await page.locator('select[aria-label="Plan"]').waitFor({ timeout: 8000 });
    await shot(page, "plan-04-created.png");
    const planSelect = page.locator('select[aria-label="Plan"]');
    const selectText = await planSelect.inputValue();
    const createdLabel = await planSelect.locator("option:checked").textContent();
    record(
      "created-planned",
      (createdLabel || "").includes("NVDA") && (createdLabel || "").includes("Planned"),
      createdLabel || selectText,
    );

    // Entry: answer one "not met" (inverse) then the rest met.
    await clickNode(page, "Entry conditions");
    const field = (name) => page.getByRole("textbox", { name, exact: true });
    await field("Setup").fill("7-week flat base");
    await field("Trigger").fill("Hold above the pivot on volume");
    const answer = (title) => page.locator(`[aria-label="Answer for ${title}"]`);
    const selection = answer("Stock selection");
    await selection.getByRole("button", { name: "Not met" }).click();
    await shot(page, "plan-05-not-met.png");
    const entryNode = page.locator(".react-flow__node").filter({ hasText: "Entry conditions" });
    record(
      "node-not-met",
      await entryNode.getByText("Breaks a rule").isVisible(),
      "entry node after one no",
    );

    await selection.getByRole("button", { name: "Met", exact: true }).click();
    await answer("Setup").getByRole("button", { name: "Met", exact: true }).click();
    await answer("Trigger").getByRole("button", { name: "N/A", exact: true }).click();
    await field("What you saw for Trigger").fill("Volume not in yet");
    record(
      "node-met",
      await entryNode.getByText("Meets your rules").isVisible(),
      "all answered, none failed",
    );

    // Risk prices: incoherent, then coherent.
    await clickNode(page, "Risk & position");
    await field("Entry").fill("100");
    await field("Stop").fill("110");
    await page.getByText("A long needs its stop below entry.").waitFor();
    await shot(page, "plan-06-bad-prices.png");
    record("price-inverse", true);
    await field("Stop").fill("95");
    await field("Target").fill("115");
    await page.getByText("Planned 3.00R").waitFor();
    await shot(page, "plan-07-planned-r.png");

    // Unsaved chip, discard edits returns to the saved snapshot.
    record("dirty-chip", await page.getByText("Unsaved changes").isVisible());
    await page.getByRole("button", { name: "Discard edits" }).click();
    await page.waitForTimeout(200);
    const entryAfterDiscard = await field("Entry").inputValue();
    record(
      "discard-edits",
      entryAfterDiscard === "" && !(await page.getByText("Unsaved changes").isVisible()),
      `entry="${entryAfterDiscard}"`,
    );
    await shot(page, "plan-08-discarded.png");

    // Re-enter the prices and save a revision.
    await field("Entry").fill("100");
    await field("Stop").fill("95");
    await field("Target").fill("115");
    await page.getByRole("button", { name: "Save revision" }).click();
    await page.getByText("revision 2").first().waitFor({ timeout: 8000 });
    record("saved-rev", !(await page.getByText("Unsaved changes").isVisible()));
    await shot(page, "plan-09-saved.png");

    // Read an older snapshot back. It must not show the prices just saved.
    await page.getByRole("button", { name: "Plan history" }).click();
    await page.getByRole("button", { name: /Revision 1/ }).click();
    await page.getByText("Read-only").first().waitFor();
    await clickNode(page, "Risk & position");
    await shot(page, "plan-10-old-revision.png");
    const snap = await page.locator("section").filter({ hasText: "Read-only" }).first().innerText();
    record(
      "old-snapshot",
      snap.includes("Revision 1") && !snap.includes("100"),
      snap.split("\n").slice(0, 8).join(" | "),
    );
    await page.getByRole("button", { name: "Back to latest" }).click();
    await page.getByText("Read-only").waitFor({ state: "hidden" });

    // Status: waiting, then back, then skip (cancel the dialog first).
    await page.getByRole("button", { name: "Waiting for trigger" }).click();
    await page.getByText("revision 2").first().waitFor();
    await page
      .locator("span")
      .filter({ hasText: /^Waiting for trigger$/ })
      .first()
      .waitFor();
    await shot(page, "plan-11-waiting.png");
    record("waiting", await page.getByRole("button", { name: "Back to planned" }).isVisible());
    await page.getByRole("button", { name: "Back to planned" }).click();
    await page.getByRole("button", { name: "Waiting for trigger" }).waitFor();
    await page.getByRole("button", { name: "Waiting for trigger" }).click();

    await page.getByRole("button", { name: "More plan actions" }).click();
    await page.getByRole("menuitem", { name: "Skip this trade…" }).click();
    await page
      .locator('[data-slot="dialog-content"]')
      .getByRole("button", { name: "Back" })
      .click();
    record("cancel-skip", await page.getByRole("button", { name: "Back to planned" }).isVisible());

    await page.getByRole("button", { name: "More plan actions" }).click();
    await page.getByRole("menuitem", { name: "Skip this trade…" }).click();
    await page
      .locator('[data-slot="dialog-content"]')
      .getByRole("textbox", { name: "Reason", exact: true })
      .fill("Gapped through the pivot");
    await shot(page, "plan-12-skip-reason.png");
    await page
      .locator('[data-slot="dialog-content"]')
      .getByRole("button", { name: "Skip trade" })
      .click();
    await page.getByRole("button", { name: "Reopen" }).waitFor({ timeout: 8000 });
    await shot(page, "plan-13-skipped.png");
    record("skipped-readonly", await page.getByText("Reopen it to keep revising").isVisible());

    await page.getByRole("button", { name: "Reopen" }).click();
    await page
      .locator('[data-slot="dialog-content"]')
      .getByRole("textbox", { name: "Reason", exact: true })
      .fill("Pulled back to the pivot");
    await page
      .locator('[data-slot="dialog-content"]')
      .getByRole("button", { name: "Reopen" })
      .click();
    await page.getByRole("button", { name: "Link trade" }).waitFor({ timeout: 8000 });
    record("reopened", await page.getByRole("button", { name: "Waiting for trigger" }).isVisible());

    // Link: cancel, then confirm the same-symbol trade.
    await page.getByRole("button", { name: "Link trade" }).click();
    await page.locator('[data-slot="dialog-content"]').getByText("NVDA").first().waitFor();
    const dialogText = await page.locator('[data-slot="dialog-content"]').innerText();
    record(
      "candidates-same-symbol",
      dialogText.includes("NVDA") && !dialogText.includes("AMD"),
      dialogText.slice(0, 180),
    );
    record("opened-before-warning", dialogText.includes("Opened before this plan was written"));
    await shot(page, "plan-14-link-dialog.png");
    await page
      .locator('[data-slot="dialog-content"]')
      .getByRole("button", { name: "Cancel" })
      .click();
    await page.locator('[data-slot="dialog-content"]').waitFor({ state: "hidden" });
    record("cancel-link", await page.getByRole("button", { name: "Link trade" }).isVisible());

    await page.getByRole("button", { name: "Link trade" }).click();
    await page.locator('[data-slot="dialog-content"]').getByRole("radio").first().click();
    await page
      .locator('[data-slot="dialog-content"]')
      .getByRole("button", { name: "Link trade" })
      .click();
    await page.getByText("New revisions are marked after the fill").waitFor({ timeout: 8000 });
    await shot(page, "plan-15-linked.png");
    record(
      "linked-taken",
      await page
        .locator("span")
        .filter({ hasText: /^Taken$/ })
        .first()
        .isVisible(),
    );

    await clickNode(page, "Entry conditions");
    await field("Thesis").fill("Exited into strength");
    await page.getByRole("button", { name: "Save revision" }).click();
    await page.getByText("revision 3").first().waitFor({ timeout: 8000 });
    await page.getByRole("button", { name: "Plan history" }).click();
    await page.getByText("After fill").first().waitFor();
    await shot(page, "plan-16-after-fill.png");
    record("after-fill", await page.getByText("After fill").first().isVisible());

    // A second plan cannot take the same trade.
    await page.getByRole("button", { name: "New plan" }).first().click();
    await page.locator('[data-slot="dialog-content"]').getByLabel("Symbol").fill("NVDA");
    await page
      .locator('[data-slot="dialog-content"]')
      .getByRole("button", { name: "Create plan" })
      .click();
    await page.getByText("revision 1").first().waitFor({ timeout: 8000 });
    await page.getByRole("button", { name: "Link trade" }).click();
    await page.getByText("Already confirms another plan").waitFor();
    await shot(page, "plan-17-link-conflict.png");
    const blocked = page.locator('[data-slot="dialog-content"]').getByRole("radio").first();
    record("link-blocked", await blocked.isDisabled());
    await page
      .locator('[data-slot="dialog-content"]')
      .getByRole("button", { name: "Cancel" })
      .click();
    await page.locator('[data-slot="dialog-content"]').waitFor({ state: "hidden" });

    // Unlink the first plan, then the second can take the trade.
    await planSelect.selectOption({ index: 1 });
    await page.getByText("revision 3").first().waitFor({ timeout: 8000 });
    await page.getByRole("button", { name: "More plan actions" }).click();
    await page.getByRole("menuitem", { name: "Unlink trade…" }).click();
    await page
      .locator('[data-slot="dialog-content"]')
      .getByRole("textbox", { name: "Reason", exact: true })
      .fill("Wrong fill");
    await page
      .locator('[data-slot="dialog-content"]')
      .getByRole("button", { name: "Unlink" })
      .click();
    await page.getByRole("button", { name: "Link trade" }).waitFor({ timeout: 8000 });
    await shot(page, "plan-18-unlinked.png");
    record(
      "unlinked-waiting",
      await page.getByRole("button", { name: "Back to planned" }).isVisible(),
    );

    await planSelect.selectOption({ index: 0 });
    await page.getByRole("button", { name: "Link trade" }).click();
    await page.locator('[data-slot="dialog-content"]').getByRole("radio").first().click();
    await page
      .locator('[data-slot="dialog-content"]')
      .getByRole("button", { name: "Link trade" })
      .click();
    await page.getByText("New revisions are marked after the fill").waitFor({ timeout: 8000 });
    record(
      "relinked",
      await page
        .locator("span")
        .filter({ hasText: /^Taken$/ })
        .first()
        .isVisible(),
    );
    await shot(page, "plan-19-relinked.png");

    // Dirty leave: keep editing stays, discard actually leaves.
    await clickNode(page, "Entry conditions");
    await field("Thesis").fill("Abandoned edit");
    await page.getByText("Unsaved changes").waitFor();
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await page.getByRole("heading", { name: "Unsaved changes" }).waitFor();
    await shot(page, "plan-20-dirty-leave.png");
    await page
      .locator('[data-slot="dialog-content"]')
      .getByRole("button", { name: "Keep editing" })
      .click();
    await page.locator('[data-slot="dialog-content"]').waitFor({ state: "hidden" });
    record(
      "keep-editing",
      await field("Thesis")
        .inputValue()
        .then((v) => v === "Abandoned edit"),
    );

    await page.getByRole("button", { name: "Review", exact: true }).click();
    await page.getByRole("heading", { name: "Unsaved changes" }).waitFor();
    await page.getByRole("button", { name: "Discard and leave" }).click();
    await page
      .getByRole("heading", { name: "Review" })
      .waitFor({ timeout: 8000 })
      .catch(() => {});
    await shot(page, "plan-21-review.png");
    await page.getByRole("button", { name: "Follow trade" }).click();
    await planSelect.waitFor();
    await clickNode(page, "Entry conditions");
    const thesisBack = await field("Thesis").inputValue();
    record("discard-leave", thesisBack !== "Abandoned edit", `thesis="${thesisBack}"`);
    await shot(page, "plan-22-edits-gone.png");

    // Narrow layout uses the stacked list.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await shot(page, "plan-23-narrow.png");
    record("narrow-list", await page.getByRole("listbox", { name: "System map" }).isVisible());
  } catch (err) {
    console.error("SCRIPT ERROR", err);
    await shot(page, "plan-error.png").catch(() => {});
    record("script", false, String(err).slice(0, 400));
  } finally {
    console.log("--- summary ---");
    for (const r of results) console.log(`${r.pass ? "ok" : "FAIL"} ${r.id} ${r.note || ""}`);
    if (httpErrors.length) console.log("http errors", httpErrors.slice(0, 12));
    await browser.close();
    if (results.some((r) => !r.pass)) process.exit(1);
  }
}

main();
