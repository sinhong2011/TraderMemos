import { describe, expect, it } from "vite-plus/test";
import { SUGGESTED_MISTAKE_TAGS, missingMistakePresets } from "./tagPresets";

describe("missingMistakePresets", () => {
  it("offers the whole vocabulary to an empty journal", () => {
    expect(missingMistakePresets([])).toEqual([...SUGGESTED_MISTAKE_TAGS]);
  });

  it("drops names the journal already has, ignoring case and padding", () => {
    const rest = missingMistakePresets([{ name: "  chased  " }, { name: "OVERSIZED" }]);
    expect(rest).not.toContain("Chased");
    expect(rest).not.toContain("Oversized");
    expect(rest).toContain("Revenge trade");
  });

  it("dedupes against custom tags too — names collide server-side regardless of kind", () => {
    expect(missingMistakePresets([{ name: "Overtrading" }])).not.toContain("Overtrading");
  });

  it("keeps the declared order so the chip row is stable between renders", () => {
    const rest = missingMistakePresets([{ name: "Late entry" }]);
    expect(rest).toEqual(SUGGESTED_MISTAKE_TAGS.filter((n) => n !== "Late entry"));
  });
});
