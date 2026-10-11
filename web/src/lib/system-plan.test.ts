import { describe, expect, it } from "vite-plus/test";
import { i18n } from "@/i18n";
import {
  draftFromRevision,
  draftToBody,
  nodeCheck,
  nodeChecks,
  planPricing,
  samePlanDraft,
  transitionNeedsReason,
} from "./system-plan";

i18n.activate("en");

describe("nodeCheck", () => {
  it("is open until every decision is answered", () => {
    expect(nodeCheck(["selection", "setup"], { selection: { answer: "yes", note: "" } })).toEqual({
      state: "open",
      answered: 1,
      total: 2,
    });
  });

  it("is met when all answered and none failed; N/A counts as answered", () => {
    expect(
      nodeCheck(["selection", "setup"], {
        selection: { answer: "yes", note: "" },
        setup: { answer: "na", note: "" },
      }).state,
    ).toBe("met");
  });

  it("one no breaks the node even with others open", () => {
    expect(nodeCheck(["selection", "setup"], { setup: { answer: "no", note: "" } }).state).toBe(
      "not_met",
    );
  });

  it("covers every map node", () => {
    expect(Object.keys(nodeChecks({}))).toEqual(["market", "entry", "risk", "holding", "review"]);
  });
});

describe("plan drafts", () => {
  it("drops empty conditions and trims text", () => {
    const body = draftToBody({
      ...draftFromRevision(null),
      thesis: "  base breakout ",
      entry: "120",
      conditions: { market: { answer: "", note: "  " }, setup: { answer: "yes", note: " ok " } },
    });
    expect(body.thesis).toBe("base breakout");
    expect(body.entry_price).toBe(120);
    expect(body.stop_price).toBeNull();
    expect(body.conditions).toEqual({ setup: { answer: "yes", note: "ok" } });
  });

  it("treats whitespace-only and blank-condition edits as unchanged", () => {
    const base = draftFromRevision(null);
    expect(
      samePlanDraft(base, {
        ...base,
        thesis: "  ",
        conditions: { market: { answer: "", note: "" } },
      }),
    ).toBe(true);
    expect(samePlanDraft(base, { ...base, thesis: "x" })).toBe(false);
  });
});

describe("planPricing", () => {
  it("computes R for a coherent long", () => {
    expect(planPricing("long", 100, 95, 115).r).toBeCloseTo(3);
  });

  it("flags a long stop above entry and a short target above entry", () => {
    expect(planPricing("long", 100, 105, null).problem).toBeTruthy();
    expect(planPricing("short", 100, 105, 110).problem).toBeTruthy();
  });

  it("is silent while prices are incomplete", () => {
    expect(planPricing("long", 100, null, null)).toEqual({ problem: null, r: null });
  });
});

describe("transitionNeedsReason", () => {
  it("asks for a reason when closing or reopening only", () => {
    expect(transitionNeedsReason("planned", "waiting")).toBe(false);
    expect(transitionNeedsReason("waiting", "skipped")).toBe(true);
    expect(transitionNeedsReason("cancelled", "planned")).toBe(true);
  });
});
