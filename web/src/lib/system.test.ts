import { describe, expect, it } from "vite-plus/test";
import { changedDecisions, DECISIONS, emptyRule, vagueWords } from "./system";
import {
  decisionClarity,
  isMapNodeId,
  MAP_EDGES,
  MAP_NODES,
  MAP_POSITIONS,
  nodeClarity,
  nodeForDecision,
  STARTER_DECISIONS,
} from "./system-map";

describe("vagueWords", () => {
  it("flags English and Chinese soft wording", () => {
    expect(vagueWords("It depends on how it feels")).toEqual(
      expect.arrayContaining(["depends", "feels"]),
    );
    expect(vagueWords("視情況再決定")).toContain("視情況");
  });
  it("ignores clear rules", () => {
    expect(vagueWords("Buy only on a close above the 20-day high.")).toEqual([]);
  });
});

describe("changedDecisions", () => {
  it("lists only decisions that differ", () => {
    const a = Object.fromEntries(DECISIONS.map((d) => [d, emptyRule()]));
    const b = { ...a, market: { text: "new", executable: true } };
    expect(changedDecisions(a, b)).toEqual(["market"]);
  });
});

describe("system-map", () => {
  it("covers every decision exactly once", () => {
    const ids = MAP_NODES.flatMap((n) => n.decisions);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual([...DECISIONS].sort());
  });

  it("validates node ids and maps decisions", () => {
    expect(isMapNodeId("entry")).toBe(true);
    expect(isMapNodeId("nope")).toBe(false);
    expect(nodeForDecision("trigger")).toBe("entry");
    expect(STARTER_DECISIONS).toHaveLength(4);
  });

  it("lays out a vertical spine with watch branch and feedback", () => {
    const ys = MAP_NODES.map((n) => MAP_POSITIONS[n.id].y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(MAP_EDGES.some((e) => e.kind === "branch" && e.labelKey === "keep_watching")).toBe(true);
    expect(MAP_EDGES.some((e) => e.kind === "feedback")).toBe(true);
  });

  it("ranks clarity needs_clarity > empty > self_clear", () => {
    expect(decisionClarity({ text: "", executable: false })).toBe("empty");
    expect(decisionClarity({ text: "clear", executable: true })).toBe("self_clear");
    expect(decisionClarity({ text: "clear", executable: false })).toBe("needs_clarity");
    expect(decisionClarity({ text: "clear", executable: true }, "still open")).toBe(
      "needs_clarity",
    );
    expect(
      nodeClarity(
        "entry",
        {
          selection: { text: "a", executable: true },
          setup: { text: "", executable: false },
          trigger: { text: "b", executable: true },
        },
        {},
      ),
    ).toBe("empty");
    expect(
      nodeClarity(
        "entry",
        {
          selection: { text: "a", executable: true },
          setup: { text: "b", executable: false },
          trigger: { text: "c", executable: true },
        },
        {},
      ),
    ).toBe("needs_clarity");
  });
});
