/* eslint-disable */
// Manual QA driver for /system (Trading System map). Not part of the test
// suite — ad hoc verification script using the project's own Playwright
// install (via the system Chrome binary, since no Chromium browser was
// downloaded for Playwright in this sandbox).
const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const BASE_URL = process.env.TM_E2E_BASE_URL || "http://127.0.0.1:5173";
// A separate, dedicated account for this scripted run — a live GUI session was
// already in progress against sysqa@example.com (Chrome on :9222, actively
// updating) when this script started; reusing that account would race its
// in-flight state. See the final report for the sysqa@example.com login check.
const EMAIL = "system-map-e2e@example.com";
const PASSWORD = "password123";
const SHOT_DIR = process.env.TM_E2E_SHOT_DIR || path.join(__dirname, "../e2e-artifacts/system-map");

if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
function record(id, pass, note) {
  results.push({ id, pass, note });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}${note ? " — " + note : ""}`);
}

async function shot(page, name) {
  // The shell crossfades routes via the CSS ::view-transition-*(page) rules
  // (see app/shell.tsx) — wait it out so screenshots don't catch a mid-fade
  // double-exposure of the old and new route content.
  await page
    .evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))))
    .catch(() => {});
  await page.waitForTimeout(350);
  const p = path.join(SHOT_DIR, name);
  await page.screenshot({ path: p, fullPage: false });
  console.log("screenshot:", p);
  return p;
}

async function findDecisionContainer(page, title) {
  return page.evaluateHandle((title) => {
    const headings = Array.from(document.querySelectorAll("h3"));
    const h = headings.find((h) => h.textContent.trim().endsWith(title));
    if (!h) return null;
    return h.closest("section");
  }, title);
}

async function getTextareaFor(page, title) {
  const handle = await findDecisionContainer(page, title);
  const el = handle.asElement();
  if (!el) throw new Error(`decision container not found for "${title}"`);
  const textareaHandle = await el.evaluateHandle((el) => el.querySelector("textarea"));
  return textareaHandle.asElement();
}

async function scrollTriggerIntoView(page) {
  await page
    .evaluate(() => {
      const headings = Array.from(document.querySelectorAll("h3"));
      const h = headings.find((h) => h.textContent.trim().endsWith("Trigger"));
      const container = h?.closest("section");
      container?.scrollIntoView({ block: "center" });
    })
    .catch(() => {});
}

async function getSwitchFor(page, title) {
  const handle = await findDecisionContainer(page, title);
  const el = handle.asElement();
  if (!el) throw new Error(`decision container not found for "${title}"`);
  const switchHandle = await el.evaluateHandle((el) => el.querySelector('[role="switch"]'));
  return switchHandle.asElement();
}

async function clickMapNode(page, title) {
  // Desktop map (React Flow) — nodes render as divs with the title as first line.
  const node = page.locator(".react-flow__node").filter({ hasText: title }).first();
  if (await node.count()) {
    await node.click();
    return;
  }
  // Fallback: mobile list (role=option buttons) if the flow canvas isn't present.
  await page.getByRole("option", { name: new RegExp("^" + title) }).click();
}

async function main() {
  await require("fs").promises.mkdir(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console.error]", msg.text());
  });
  page.on("response", (res) => {
    if (res.status() >= 400) console.log("[http]", res.status(), res.url());
  });

  try {
    // ---- Login ----
    await page.goto(`${BASE_URL}/home`);
    await page.evaluate(() => {
      localStorage.removeItem("tm_token");
      localStorage.removeItem("tm_refresh");
    });
    await page.reload();

    const setupHeading = page.getByText("Create your account", { exact: false });
    const loginHeading = page.getByText("Welcome back", { exact: false });
    await Promise.race([
      setupHeading.waitFor({ timeout: 8000 }).catch(() => {}),
      loginHeading.waitFor({ timeout: 8000 }).catch(() => {}),
    ]);

    if (await loginHeading.isVisible().catch(() => false)) {
      console.log("Login screen detected — signing in.");
      await page.locator("#username").fill(EMAIL);
      await page.locator("#password").fill(PASSWORD);
      await page.locator('form button[type="submit"]').click();
    } else {
      console.log("Setup screen detected — creating account.");
      // Not expected in this run (setup already completed), but handle it anyway.
      throw new Error("Setup screen appeared unexpectedly — user should already exist.");
    }

    await page.getByRole("link", { name: "System" }).waitFor({ timeout: 15000 });
    console.log("Logged in — nav visible.");

    // ================= Case 1: empty /system =================
    await page.getByRole("link", { name: "System" }).click();
    await page.waitForURL(/\/system/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    const startBtn = page.getByRole("button", { name: "Start v1.0" });
    await startBtn.waitFor({ timeout: 10000 }).catch(() => {});
    const case1Pass = await startBtn.isVisible().catch(() => false);
    await shot(page, "system-01-empty.png");
    record("1-empty", case1Pass, case1Pass ? "Start v1.0 visible" : "Start v1.0 NOT visible");

    // ================= Case 2: after Start v1.0 =================
    await startBtn.click();
    await page.getByRole("heading", { name: "Four-week plan" }).waitFor({ timeout: 10000 });
    const mapVisible = await page
      .locator(".react-flow")
      .first()
      .isVisible()
      .catch(() => false);
    const marketNodeVisible = await page
      .locator(".react-flow__node")
      .filter({ hasText: "Market environment" })
      .first()
      .isVisible()
      .catch(() => false);
    await shot(page, "system-02-started.png");
    record(
      "2-started",
      mapVisible && marketNodeVisible,
      `react-flow visible=${mapVisible}, Market environment node visible=${marketNodeVisible}`,
    );

    // ================= Case 3: Entry node, fill Trigger, toggle, Save =================
    await clickMapNode(page, "Entry");
    await page.getByRole("heading", { name: /· Trigger$/ }).waitFor({ timeout: 5000 });

    const triggerText = "Buy only on a close above the 20-day high with volume above average.";
    const triggerTextarea = await getTextareaFor(page, "Trigger");
    await triggerTextarea.click();
    await triggerTextarea.fill(triggerText);

    const triggerSwitch = await getSwitchFor(page, "Trigger");
    const switchStateBefore = await triggerSwitch.getAttribute("data-checked");
    await triggerSwitch.click();
    const switchStateAfter = await triggerSwitch.getAttribute("data-checked");
    const switchToggledOn = switchStateBefore === null && switchStateAfter !== null;

    const saveBtn = page.getByRole("button", { name: "Save", exact: true });
    await saveBtn.waitFor();
    const saveEnabled = await saveBtn.isEnabled();
    await saveBtn.click();
    await page
      .getByText("Draft saved")
      .waitFor({ timeout: 5000 })
      .catch(() => {});

    const savedTextValue = await triggerTextarea.inputValue();
    await scrollTriggerIntoView(page);
    await shot(page, "system-03-entry-filled.png");
    record(
      "3-entry-filled",
      saveEnabled && switchToggledOn && savedTextValue === triggerText,
      `saveEnabled=${saveEnabled}, switchToggledOn=${switchToggledOn}, textMatches=${savedTextValue === triggerText}`,
    );

    // ================= Case 4: hard reload /system?node=entry, read back =================
    await page.goto(`${BASE_URL}/system?node=entry`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /· Trigger$/ }).waitFor({ timeout: 10000 });
    const reloadedTextarea = await getTextareaFor(page, "Trigger");
    const reloadedText = await reloadedTextarea.inputValue();
    const reloadedSwitch = await getSwitchFor(page, "Trigger");
    const reloadedSwitchOn = (await reloadedSwitch.getAttribute("data-checked")) !== null;
    await scrollTriggerIntoView(page);
    await shot(page, "system-04-reload-readback.png");
    record(
      "4-reload-readback",
      reloadedText === triggerText && reloadedSwitchOn,
      `text="${reloadedText}", switchOn=${reloadedSwitchOn}`,
    );

    // ================= Case 5: vague wording nudge =================
    const vagueText = triggerText.replace("Buy only on", "Buy only on, depends,");
    const vagueTextarea = await getTextareaFor(page, "Trigger");
    await vagueTextarea.fill(vagueText);
    await page.getByText("Vague wording", { exact: false }).waitFor({ timeout: 5000 });
    const vagueNudgeVisible = await page.getByText("Vague wording", { exact: false }).isVisible();
    const vagueNudgeMentionsDepends = (
      await page.getByText("Vague wording", { exact: false }).locator("..").innerText()
    ).includes("depends");
    await page
      .getByText("Vague wording", { exact: false })
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    await shot(page, "system-05-vague.png");
    record(
      "5-vague",
      vagueNudgeVisible && vagueNudgeMentionsDepends,
      `nudgeVisible=${vagueNudgeVisible}, mentionsDepends=${vagueNudgeMentionsDepends}`,
    );

    // ================= Case 6: Cancel edits =================
    const cancelBtn = page.getByRole("button", { name: "Cancel edits" });
    await cancelBtn.waitFor();
    await cancelBtn.click();
    await page.waitForTimeout(300);
    const afterCancelTextarea = await getTextareaFor(page, "Trigger");
    const afterCancelText = await afterCancelTextarea.inputValue();
    await scrollTriggerIntoView(page);
    await shot(page, "system-06-cancel.png");
    record(
      "6-cancel",
      afterCancelText === triggerText && !afterCancelText.includes("depends"),
      `text="${afterCancelText}"`,
    );

    // ================= Case 7: dirty discard =================
    const dirtyEditText = triggerText + " (unsaved edit)";
    const dirtyTextarea = await getTextareaFor(page, "Trigger");
    await dirtyTextarea.fill(dirtyEditText);
    await clickMapNode(page, "Risk");
    const dirtyDialog = page.getByRole("dialog", { name: "Unsaved changes" });
    const dirtyDialogVisible = await dirtyDialog.isVisible().catch(() => false);
    if (dirtyDialogVisible) {
      await dirtyDialog.getByRole("button", { name: "Discard" }).click();
    }
    await page.getByRole("heading", { name: /· Risk budget$/ }).waitFor({ timeout: 5000 });
    await shot(page, "system-07a-dirty-discard-on-risk.png");

    // Reopen Entry — should show the saved text, not the abandoned edit.
    await clickMapNode(page, "Entry");
    await page.getByRole("heading", { name: /· Trigger$/ }).waitFor({ timeout: 5000 });
    const reopenedTextarea = await getTextareaFor(page, "Trigger");
    const reopenedText = await reopenedTextarea.inputValue();
    await scrollTriggerIntoView(page);
    await shot(page, "system-07-dirty-discard.png");
    record(
      "7-dirty-discard",
      dirtyDialogVisible && reopenedText === triggerText,
      `dialogShown=${dirtyDialogVisible}, reopenedText="${reopenedText}"`,
    );

    // ================= Case 8: Activate v1.0 (first activate, no reasons) =================
    const activateBtn = page.getByRole("button", { name: "Activate", exact: true });
    await activateBtn.click();
    const activateDialog = page.getByRole("dialog", { name: /Activate v/ });
    await activateDialog.waitFor({ timeout: 5000 });
    const activateDialogText = await activateDialog.innerText();
    const noReasonsRequired = activateDialogText.includes("This becomes the active system");
    await activateDialog.getByRole("button", { name: "Activate" }).click();
    await page
      .getByText("Version activated")
      .waitFor({ timeout: 5000 })
      .catch(() => {});
    const readonlyBadge = page.getByText("Read-only", { exact: true });
    await readonlyBadge.waitFor({ timeout: 5000 });
    const readonlyVisible = await readonlyBadge.isVisible();
    await shot(page, "system-08-activate.png");
    record(
      "8-activate",
      noReasonsRequired && readonlyVisible,
      `noReasonsRequiredCopy=${noReasonsRequired}, readonlyBadgeVisible=${readonlyVisible}`,
    );

    // ================= Case 9: Start next version, change, activate w/ reason =================
    const selectedVersionLabel = async () =>
      (
        await page
          .getByRole("combobox", { name: "Version" })
          .evaluate((el) => el.options[el.selectedIndex]?.textContent || "")
      ).trim();

    const v1Label = await selectedVersionLabel();

    const startNextBtn = page.getByRole("button", { name: "Start next version" });
    await startNextBtn.click();
    await page.getByRole("button", { name: "Save", exact: true }).waitFor({ timeout: 10000 });

    const v2Label = await selectedVersionLabel();
    const newDraftCreated = v2Label !== v1Label && /draft/i.test(v2Label);

    // Market node holds the "market environment" rule text.
    await clickMapNode(page, "Market");
    await page.getByRole("heading", { name: /· Market environment$/ }).waitFor({ timeout: 5000 });
    const marketTextarea = await getTextareaFor(page, "Market environment");
    const originalMarketText = await marketTextarea.inputValue();
    const newMarketText =
      "Trade actively only when the index closes above its 200-day moving average.";
    await marketTextarea.fill(newMarketText);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .getByText("Draft saved")
      .waitFor({ timeout: 5000 })
      .catch(() => {});

    const activateBtn2 = page.getByRole("button", { name: "Activate", exact: true });
    await activateBtn2.click();
    const activateDialog2 = page.getByRole("dialog", { name: /Activate v/ });
    await activateDialog2.waitFor({ timeout: 5000 });
    const activateDialog2Text = await activateDialog2.innerText();
    const reasonRequiredCopy = activateDialog2Text.includes(
      "Give a reason for each changed decision",
    );
    const confirmBtn2 = activateDialog2.getByRole("button", { name: "Activate" });

    // Pick a reason for the changed "market" decision — select exists per changed decision.
    const reasonSelect = activateDialog2.locator("select").first();
    const reasonSelectExists = (await reasonSelect.count()) > 0;
    if (reasonSelectExists) {
      await reasonSelect.selectOption("regime");
    }
    await confirmBtn2.click();
    await page
      .getByText("Version activated")
      .waitFor({ timeout: 5000 })
      .catch(() => {});
    await page.getByText("Read-only", { exact: true }).waitFor({ timeout: 5000 });
    const v2ActiveLabel = await selectedVersionLabel();
    const v2NowActive = v2ActiveLabel.includes("In use") && v2ActiveLabel !== v1Label;
    await shot(page, "system-09-next-version.png");
    record(
      "9-next-version",
      newDraftCreated && reasonRequiredCopy && reasonSelectExists && v2NowActive,
      `v1Label="${v1Label}", newDraftCreated=${newDraftCreated} (v2="${v2Label}"), reasonRequiredCopy=${reasonRequiredCopy}, reasonSelectExists=${reasonSelectExists}, v2ActiveLabel="${v2ActiveLabel}", originalMarketText="${originalMarketText}"`,
    );

    // ================= Node walkthrough =================
    const nodeNames = ["Market", "Entry", "Risk", "Holding", "Review"];
    let allNodesOpened = true;
    for (const n of nodeNames) {
      await clickMapNode(page, n);
      await page.waitForTimeout(250);
      const headingVisible = await page
        .getByRole("heading", { level: 3 })
        .first()
        .isVisible()
        .catch(() => false);
      allNodesOpened = allNodesOpened && headingVisible;
    }
    await shot(page, "system-10-nodes.png");
    record(
      "10-node-walkthrough",
      allNodesOpened,
      `allNodesOpenedWithVisibleHeading=${allNodesOpened}`,
    );

    // ================= Case 11: unsaved edits survive Rules ↔ Follow =================
    await page.getByRole("button", { name: "Start next version" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).waitFor({ timeout: 10000 });
    await clickMapNode(page, "Entry");
    await page.getByRole("heading", { name: /· Trigger$/ }).waitFor({ timeout: 5000 });
    const keepText = "Buy the first pullback after a 20-day high close.";
    await (await getTextareaFor(page, "Trigger")).fill(keepText);
    const unsavedShown = await page.getByText("Unsaved changes", { exact: true }).isVisible();
    await page.getByRole("button", { name: "Follow trade", exact: true }).click();
    await page.getByText("No trade linked yet").waitFor({ timeout: 5000 });
    await shot(page, "system-11a-follow.png");
    await page.getByRole("button", { name: "Write rules", exact: true }).click();
    await page.getByRole("heading", { name: /· Trigger$/ }).waitFor({ timeout: 5000 });
    const survived = await (await getTextareaFor(page, "Trigger")).inputValue();
    await scrollTriggerIntoView(page);
    await shot(page, "system-11b-back-to-rules.png");
    record(
      "11-rules-follow-keeps-edits",
      unsavedShown && survived === keepText,
      `unsavedChip=${unsavedShown}, text="${survived}"`,
    );

    // ================= Case 12: leaving for Review is guarded =================
    const clickMode = (name) => page.getByRole("button", { name, exact: true }).click();
    await clickMode("Review");
    const leaveDialog = page.getByRole("dialog", { name: "Unsaved changes" });
    await leaveDialog.waitFor({ timeout: 5000 });
    await shot(page, "system-12a-leave-guard.png");
    await leaveDialog.getByRole("button", { name: "Keep editing" }).click();
    await page.waitForTimeout(300);
    const stayedText = await (await getTextareaFor(page, "Trigger")).inputValue();
    const stillRules = !page.url().includes("mode=review");
    await clickMode("Review");
    await leaveDialog.getByRole("button", { name: "Discard and leave" }).click();
    await page.waitForURL(/mode=review/, { timeout: 5000 });
    await shot(page, "system-12b-review.png");
    await clickMode("Write rules");
    await page.getByRole("heading", { name: /· Trigger$/ }).waitFor({ timeout: 5000 });
    const afterLeave = await (await getTextareaFor(page, "Trigger")).inputValue();
    record(
      "12-review-guard",
      stayedText === keepText && stillRules && afterLeave !== keepText,
      `keptOnStay=${stayedText === keepText}, stayedInRules=${stillRules}, droppedAfterDiscard=${afterLeave !== keepText}`,
    );

    // ================= Case 13: discard draft dialog (cancel, then confirm) =================
    await page.getByRole("button", { name: "Discard draft" }).click();
    const discardDialog = page.getByRole("dialog", { name: /Discard v/ });
    await discardDialog.waitFor({ timeout: 5000 });
    await shot(page, "system-13a-discard-dialog.png");
    await discardDialog.getByRole("button", { name: "Keep draft" }).click();
    await page.waitForTimeout(300);
    const draftKept = /draft/i.test(await selectedVersionLabel());
    await page.getByRole("button", { name: "Discard draft" }).click();
    await discardDialog.getByRole("button", { name: "Discard draft" }).click();
    await page.getByRole("button", { name: "Start next version" }).waitFor({ timeout: 5000 });
    const backToActive = (await selectedVersionLabel()).includes("In use");
    await shot(page, "system-13b-discarded.png");
    record(
      "13-discard-dialog",
      draftKept && backToActive,
      `keptOnCancel=${draftKept}, activeAfterDiscard=${backToActive}`,
    );

    // ================= Case 14: drag a node, Reset layout =================
    const resetBtn = page.getByRole("button", { name: "Reset layout" });
    const resetDisabledAtStart = await resetBtn.isDisabled();
    const inspectorTitle = () => page.locator(".system-workspace section h2").first().innerText();
    const titleBeforeDrag = await inspectorTitle();
    const riskNode = page
      .locator(".react-flow__node")
      .filter({ hasText: "Risk & position" })
      .first();
    const before = await riskNode.boundingBox();
    await page.mouse.move(before.x + 40, before.y + 20);
    await page.mouse.down();
    await page.mouse.move(before.x + 200, before.y + 60, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const moved = await riskNode.boundingBox();
    const resetEnabledAfterDrag = await resetBtn.isEnabled();
    const titleAfterDrag = await inspectorTitle();
    await shot(page, "system-14a-dragged.png");
    await page.reload({ waitUntil: "networkidle" });
    await riskNode.waitFor();
    await page.waitForTimeout(500);
    const persistedEnabled = await resetBtn.isEnabled();
    await resetBtn.click();
    await page.waitForTimeout(500);
    const resetDisabledAfter = await resetBtn.isDisabled();
    await shot(page, "system-14b-reset.png");
    record(
      "14-drag-reset",
      resetDisabledAtStart &&
        Math.abs(moved.x - before.x) > 60 &&
        resetEnabledAfterDrag &&
        titleAfterDrag === titleBeforeDrag &&
        persistedEnabled &&
        resetDisabledAfter,
      `disabledAtStart=${resetDisabledAtStart}, dx=${Math.round(moved.x - before.x)}, enabledAfterDrag=${resetEnabledAfterDrag}, inspectorKept=${titleAfterDrag === titleBeforeDrag} (${titleBeforeDrag}), persistedAfterReload=${persistedEnabled}, disabledAfterReset=${resetDisabledAfter}`,
    );

    // ================= Case 15: keyboard selection =================
    const holdingNode = page
      .locator(".react-flow__node")
      .filter({ hasText: "Holding decisions" })
      .first();
    await holdingNode.focus();
    await page.keyboard.press("Enter");
    const kbHeading = page.getByRole("heading", { level: 2, name: "Holding decisions" });
    const kbSelected = await kbHeading
      .waitFor({ timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    await shot(page, "system-15-keyboard.png");
    record("15-keyboard-select", kbSelected, `inspectorShowsHolding=${kbSelected}`);

    // ================= Case 16–18: name a version =================
    const versionPill = () => page.locator("header span.rounded-full").first().innerText();
    await page.getByRole("button", { name: "Name this version" }).click();
    const renameDialog = page.getByRole("dialog", { name: /^Name v/ });
    await renameDialog.waitFor({ timeout: 5000 });
    const saveNameDisabledEmpty = await renameDialog
      .getByRole("button", { name: "Save name" })
      .isDisabled();
    await renameDialog.getByRole("textbox").fill("  Trend   pullbacks ");
    await shot(page, "system-16a-name-dialog.png");
    await renameDialog.getByRole("button", { name: "Save name" }).click();
    await page.getByText("Version named").waitFor({ timeout: 5000 });
    await page.waitForTimeout(300);
    const optAfterName = await selectedVersionLabel();
    const pillAfterName = await versionPill();
    await shot(page, "system-16b-named.png");
    record(
      "16-name-version",
      saveNameDisabledEmpty &&
        optAfterName.includes("· Trend pullbacks ·") &&
        pillAfterName.includes("Trend pullbacks"),
      `saveDisabledWhenUnchanged=${saveNameDisabledEmpty}, option="${optAfterName}", pill="${pillAfterName}"`,
    );

    await page.getByRole("button", { name: "Rename this version" }).click();
    const renameDialog2 = page.getByRole("dialog", { name: /^Rename v/ });
    await renameDialog2.waitFor({ timeout: 5000 });
    const reentryValue = await renameDialog2.getByRole("textbox").inputValue();
    await renameDialog2.getByRole("textbox").fill("Something abandoned");
    await renameDialog2.getByRole("button", { name: "Cancel" }).click();
    await page.waitForTimeout(400);
    const optAfterCancel = await selectedVersionLabel();
    await page.getByRole("button", { name: "Rename this version" }).click();
    await renameDialog2.waitFor({ timeout: 5000 });
    const reopenValue = await renameDialog2.getByRole("textbox").inputValue();
    await shot(page, "system-17-rename-reentry.png");
    record(
      "17-rename-cancel-reentry",
      reentryValue === "Trend pullbacks" &&
        optAfterCancel.includes("Trend pullbacks") &&
        reopenValue === "Trend pullbacks",
      `firstOpen="${reentryValue}", afterCancel="${optAfterCancel}", reopen="${reopenValue}"`,
    );

    await renameDialog2.getByRole("textbox").fill("");
    await renameDialog2.getByRole("button", { name: "Save name" }).click();
    await page.getByText("Name removed").waitFor({ timeout: 5000 });
    await page.waitForTimeout(300);
    const optAfterClear = await selectedVersionLabel();
    const nameBtnBack = await page.getByRole("button", { name: "Name this version" }).isVisible();
    await shot(page, "system-18-name-cleared.png");
    record(
      "18-clear-name",
      /^v\d+\.\d+ · In use$/.test(optAfterClear) && nameBtnBack,
      `option="${optAfterClear}", nameButtonBack=${nameBtnBack}`,
    );

    // ================= Case 19: naming a draft keeps unsaved rule edits =================
    await page.getByRole("button", { name: "Start next version" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).waitFor({ timeout: 10000 });
    await clickMapNode(page, "Entry");
    await page.getByRole("heading", { name: /· Trigger$/ }).waitFor({ timeout: 5000 });
    const pendingEdit = "Unsaved trigger edit while naming.";
    await (await getTextareaFor(page, "Trigger")).fill(pendingEdit);
    await page.getByRole("button", { name: "Name this version" }).click();
    const draftNameDialog = page.getByRole("dialog", { name: /^Name v/ });
    await draftNameDialog.getByRole("textbox").fill("Draft idea");
    await draftNameDialog.getByRole("button", { name: "Save name" }).click();
    await page.getByText("Version named").last().waitFor({ timeout: 5000 });
    await page.waitForTimeout(400);
    const editKept = await (await getTextareaFor(page, "Trigger")).inputValue();
    const draftOpt = await selectedVersionLabel();
    const stillDirty = await page.getByText("Unsaved changes", { exact: true }).isVisible();
    await scrollTriggerIntoView(page);
    await shot(page, "system-19-name-draft-keeps-edits.png");
    record(
      "19-name-draft-keeps-edits",
      editKept === pendingEdit && draftOpt.includes("Draft idea") && stillDirty,
      `text="${editKept}", option="${draftOpt}", unsavedChip=${stillDirty}`,
    );
  } catch (err) {
    console.error("FATAL ERROR:", err);
    await shot(page, "system-ERROR.png").catch(() => {});
    record("fatal", false, String(err && err.stack ? err.stack : err));
  } finally {
    await browser.close();
  }

  console.log("\n==== SUMMARY ====");
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id}  ${r.note || ""}`);
  }
}

main();
