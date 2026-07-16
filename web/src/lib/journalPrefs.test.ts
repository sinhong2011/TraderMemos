import { describe, expect, it } from "vite-plus/test";
import { capScreenshots } from "./journalPrefs";

describe("capScreenshots", () => {
  it("passes through when unlimited", () => {
    expect(capScreenshots([1, 2, 3, 4, 5, 6], null)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("trims to the configured max", () => {
    expect(capScreenshots(["a", "b", "c"], 2)).toEqual(["a", "b"]);
  });
});
