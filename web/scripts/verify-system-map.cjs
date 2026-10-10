/* eslint-disable */
// Manual QA driver for /system (Trading System map). Not part of the test
// suite — ad hoc verification script using the project's own Playwright
// install (via the system Chrome binary, since no Chromium browser was
// downloaded for Playwright in this sandbox).
const path = require("path");
const {
  chromium,
} = require("/workspace/web/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core");

const BASE_URL = "http://127.0.0.1:5173";
// A separate, dedicated account for this scripted run — a live GUI session was
// already in progress against sysqa@example.com (Chrome on :9222, actively
// updating) when this script started; reusing that account would race its
// in-flight state. See the final report for the sysqa@example.com login check.
const EMAIL = "system-map-e2e@example.com";
const PASSWORD = "password123";
const SHOT_DIR = "/opt/cursor/artifacts/screenshots";

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
    const h = headings.find((h) => h.textContent.trim().startsWith(title));
    if (!h) return null;
    return h.closest("div.flex.flex-col.gap-2");
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
      const h = headings.find((h) => h.textContent.trim().startsWith("Trigger"));
      const container = h?.closest("div.flex.flex-col.gap-2");
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
    const mapVisible = await page.getByRole("heading", { name: "System map" }).isVisible();
    const marketNodeVisible = await page
      .locator(".react-flow__node")
      .filter({ hasText: "Market" })
      .first()
      .isVisible()
      .catch(() => false);
    await shot(page, "system-02-started.png");
    record(
      "2-started",
      mapVisible && marketNodeVisible,
      `map card visible=${mapVisible}, Market node visible=${marketNodeVisible}`,
    );

    // ================= Case 3: Entry node, fill Trigger, toggle, Save =================
    await clickMapNode(page, "Entry");
    await page.getByRole("heading", { name: "Trigger" }).waitFor({ timeout: 5000 });

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
    await page.getByRole("heading", { name: "Trigger" }).waitFor({ timeout: 10000 });
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
    await page.getByRole("heading", { name: "Risk budget" }).waitFor({ timeout: 5000 });
    await shot(page, "system-07a-dirty-discard-on-risk.png");

    // Reopen Entry — should show the saved text, not the abandoned edit.
    await clickMapNode(page, "Entry");
    await page.getByRole("heading", { name: "Trigger" }).waitFor({ timeout: 5000 });
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
    const newDraftCreated = v2Label !== v1Label && v2Label.includes("draft");

    // Market node holds the "market environment" rule text.
    await clickMapNode(page, "Market");
    await page.getByRole("heading", { name: "Market environment" }).waitFor({ timeout: 5000 });
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
    const v2NowActive = v2ActiveLabel.includes("active") && v2ActiveLabel !== v1Label;
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
