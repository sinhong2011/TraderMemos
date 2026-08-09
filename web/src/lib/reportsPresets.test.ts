import { describe, expect, it } from "vite-plus/test";
import { defaultCardIds, sanitizeCardIds } from "./reportCards";
import {
  captureReportsPreset,
  MAX_PRESETS,
  parseReportsPresets,
  resolvePresetRange,
  type ReportsSearchState,
} from "./reportsPresets";

const search: ReportsSearchState = {
  tab: "detailed",
  side: "long",
  dur: "day",
  pnl: "gross",
  unit: "pct",
  avg: "median",
};

describe("sanitizeCardIds", () => {
  it("keeps known ids in the given order and drops unknowns and duplicates", () => {
    expect(sanitizeCardIds("risk", ["rule-compliance", "bogus", "drawdown", "drawdown"])).toEqual([
      "rule-compliance",
      "drawdown",
    ]);
  });

  it("falls back to defaults for empty or malformed input", () => {
    expect(sanitizeCardIds("overview", [])).toEqual(defaultCardIds("overview"));
    expect(sanitizeCardIds("overview", "nope")).toEqual(defaultCardIds("overview"));
    expect(sanitizeCardIds("overview", [42, null])).toEqual(defaultCardIds("overview"));
  });
});

describe("parseReportsPresets", () => {
  it("returns an empty list for non-arrays", () => {
    expect(parseReportsPresets(undefined)).toEqual([]);
    expect(parseReportsPresets({})).toEqual([]);
    expect(parseReportsPresets("x")).toEqual([]);
  });

  it("drops entries without an id or name and de-duplicates ids", () => {
    const parsed = parseReportsPresets([
      { id: "a", name: "Morning" },
      { id: "", name: "no id" },
      { name: "no id either" },
      { id: "a", name: "duplicate" },
      null,
      "junk",
    ]);
    expect(parsed.map((p) => p.id)).toEqual(["a"]);
    expect(parsed[0].name).toBe("Morning");
  });

  it("defaults invalid enum fields rather than dropping the preset", () => {
    const [p] = parseReportsPresets([
      { id: "a", name: "X", tab: "nope", side: 3, pnl: "grossly", range: "14d" },
    ]);
    expect(p.tab).toBe("overview");
    expect(p.side).toBe("all");
    expect(p.pnl).toBe("net");
    expect(p.range).toBe("all");
  });

  it("keeps valid fields, sanitizes card layouts, and caps the list", () => {
    const many = Array.from({ length: MAX_PRESETS + 5 }, (_, i) => ({
      id: `p${i}`,
      name: `Preset ${i}`,
    }));
    expect(parseReportsPresets(many)).toHaveLength(MAX_PRESETS);

    const [p] = parseReportsPresets([
      {
        id: "a",
        name: "Deep dive",
        tab: "risk",
        side: "short",
        dur: "swing",
        pnl: "gross",
        unit: "pct",
        avg: "median",
        range: { from: "2026-01-01", to: "2026-02-01" },
        symbols: ["AAPL", 7],
        tradeStatus: "win",
        cards: { risk: ["rule-compliance", "bogus"], junkTab: ["x"] },
      },
    ]);
    expect(p.tab).toBe("risk");
    expect(p.range).toEqual({ from: "2026-01-01", to: "2026-02-01" });
    expect(p.symbols).toEqual(["AAPL"]);
    expect(p.tradeStatus).toBe("win");
    expect(p.cards).toEqual({ risk: ["rule-compliance"] });
  });
});

describe("captureReportsPreset", () => {
  it("stores a round-trippable named range as the relative key", () => {
    const preset = captureReportsPreset({
      name: "  Morning review  ",
      search,
      filters: { from: undefined, to: undefined },
      cards: {},
    });
    expect(preset.name).toBe("Morning review");
    expect(preset.range).toBe("all");
    expect(preset.cards).toBeUndefined();
    expect(preset.id).toBeTruthy();
  });

  it("pins literal dates for a custom range and keeps facet filters", () => {
    const preset = captureReportsPreset({
      name: "Jan deep-dive",
      search,
      filters: {
        from: "2026-01-05",
        to: "2026-01-23",
        symbols: ["ES"],
        tradeStatus: "loss",
      },
      cards: { detailed: ["pnl-heatmap", "sessions"] },
    });
    expect(preset.range).toEqual({ from: "2026-01-05", to: "2026-01-23" });
    expect(preset.symbols).toEqual(["ES"]);
    expect(preset.tradeStatus).toBe("loss");
    expect(preset.cards).toEqual({ detailed: ["pnl-heatmap", "sessions"] });
    expect(preset.tab).toBe("detailed");
    expect(preset.side).toBe("long");
  });
});

describe("resolvePresetRange", () => {
  it("clears the range for 'all'", () => {
    expect(resolvePresetRange("all")).toEqual({ from: undefined, to: undefined });
  });

  it("re-anchors relative keys to today", () => {
    const { from, to } = resolvePresetRange("7d");
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
    const fromDay = new Date(from!.slice(0, 10));
    const toDay = new Date(to!.slice(0, 10));
    const diffDays = Math.round((toDay.getTime() - fromDay.getTime()) / 86_400_000);
    expect(diffDays).toBe(6);
  });

  it("passes literal dates through unchanged", () => {
    expect(resolvePresetRange({ from: "2026-01-05", to: "2026-01-23" })).toEqual({
      from: "2026-01-05",
      to: "2026-01-23",
    });
  });
});
