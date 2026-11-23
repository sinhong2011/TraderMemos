import { describe, expect, it } from "vite-plus/test";
import type { Tag, Trade } from "@/lib/api/types";
import { addTagIds, bulkPatchBody, removeTagIds, runPool } from "./bulkTrades";

function tag(id: string): Tag {
  return { id, user_id: "u", name: id, color: "", description: "", kind: "" };
}

function trade(id: string, tagIds: string[]): Trade {
  return { id, tags: tagIds.map(tag) } as Trade;
}

describe("tag list helpers", () => {
  it("adds without duplicating and keeps order", () => {
    expect(addTagIds(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
  it("removes only the given ids", () => {
    expect(removeTagIds(["a", "b", "c"], ["b", "z"])).toEqual(["a", "c"]);
  });
});

describe("bulkPatchBody", () => {
  it("skips trades already in the requested state", () => {
    expect(bulkPatchBody(trade("1", ["a"]), { kind: "add-tags", tagIds: ["a"] })).toBeNull();
    expect(bulkPatchBody(trade("1", ["a"]), { kind: "remove-tags", tagIds: ["b"] })).toBeNull();
  });

  it("sends the trade's full new tag list", () => {
    expect(bulkPatchBody(trade("1", ["a"]), { kind: "add-tags", tagIds: ["b"] })).toEqual({
      tag_ids: ["a", "b"],
    });
    expect(bulkPatchBody(trade("1", ["a", "b"]), { kind: "remove-tags", tagIds: ["a"] })).toEqual({
      tag_ids: ["b"],
    });
  });

  it("restores per-trade lists for undo", () => {
    const op = { kind: "set-tags" as const, tagIdsByTrade: { "1": ["a"], "2": [] } };
    expect(bulkPatchBody(trade("1", ["a", "b"]), op)).toEqual({ tag_ids: ["a"] });
    expect(bulkPatchBody(trade("2", ["x"]), op)).toEqual({ tag_ids: [] });
    expect(bulkPatchBody(trade("3", ["x"]), op)).toBeNull();
    // Undo gets the pre-edit rows, which already "match" — it must still send.
    expect(bulkPatchBody(trade("1", ["a"]), op)).toEqual({ tag_ids: ["a"] });
  });

  it("sets or clears the setup", () => {
    expect(bulkPatchBody(trade("1", []), { kind: "set-setup", setupId: "s" })).toEqual({
      setup_ids: ["s"],
    });
    expect(bulkPatchBody(trade("1", []), { kind: "set-setup", setupId: null })).toEqual({
      setup_ids: [],
    });
  });
});

describe("runPool", () => {
  it("caps concurrency and splits ok from failed", async () => {
    let inFlight = 0;
    let peak = 0;
    const result = await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      if (n % 3 === 0) throw new Error("boom");
    });
    expect(peak).toBe(3);
    expect(result.ok.sort()).toEqual([1, 2, 4, 5, 7]);
    expect(result.failed.sort()).toEqual([3, 6]);
  });

  it("handles an empty list", async () => {
    expect(await runPool([], 4, async () => {})).toEqual({ ok: [], failed: [] });
  });
});
