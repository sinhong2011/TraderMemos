import { beforeEach, describe, expect, it } from "vite-plus/test";
import { defaultCardIds } from "./reportCards";
import { useReportsView, visibleCardIds } from "./reportsView";

beforeEach(() => {
  useReportsView.setState({ cards: {}, activePresetId: undefined });
});

describe("useReportsView", () => {
  it("resolves defaults for untouched tabs", () => {
    expect(visibleCardIds(useReportsView.getState().cards, "overview")).toEqual(
      defaultCardIds("overview"),
    );
  });

  it("stores a sanitized per-tab order and resets back to defaults", () => {
    useReportsView.getState().setTabCards("risk", ["rule-compliance", "bogus", "drawdown"]);
    expect(visibleCardIds(useReportsView.getState().cards, "risk")).toEqual([
      "rule-compliance",
      "drawdown",
    ]);

    useReportsView.getState().resetTabCards("risk");
    expect(useReportsView.getState().cards.risk).toBeUndefined();
    expect(visibleCardIds(useReportsView.getState().cards, "risk")).toEqual(defaultCardIds("risk"));
  });

  it("applyLayout replaces the whole layout and tracks the preset", () => {
    useReportsView.getState().setTabCards("overview", ["playbook"]);
    useReportsView.getState().applyLayout({ risk: ["rule-compliance"] }, "preset-1");

    const s = useReportsView.getState();
    expect(s.activePresetId).toBe("preset-1");
    expect(s.cards.overview).toBeUndefined();
    expect(s.cards.risk).toEqual(["rule-compliance"]);
  });

  it("applyLayout with no cards restores the default layout", () => {
    useReportsView.getState().setTabCards("overview", ["playbook"]);
    useReportsView.getState().applyLayout(undefined, "preset-2");
    expect(useReportsView.getState().cards).toEqual({});
  });
});
