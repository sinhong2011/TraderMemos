import { describe, expect, it } from "vite-plus/test";
import { validateTradesSearch } from "./trades.index";

describe("validateTradesSearch", () => {
  it("keeps the cooldown panel param", () => {
    expect(validateTradesSearch({ panel: "cooldown" })).toEqual({ panel: "cooldown" });
  });

  it("drops anything else", () => {
    expect(validateTradesSearch({})).toEqual({});
    expect(validateTradesSearch({ panel: "pause" })).toEqual({});
    expect(validateTradesSearch({ panel: 1 })).toEqual({});
  });
});
