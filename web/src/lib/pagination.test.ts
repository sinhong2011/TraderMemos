import { describe, expect, it } from "vite-plus/test";
import { clampPage, pageCountFor, pageItems, pageRangeLabel, slicePage } from "./pagination";

describe("pagination helpers", () => {
  it("computes page count", () => {
    expect(pageCountFor(0, 25)).toBe(0);
    expect(pageCountFor(26, 25)).toBe(2);
    expect(pageCountFor(25, 25)).toBe(1);
  });

  it("clamps page into range", () => {
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(9, 3)).toBe(3);
    expect(clampPage(2, 0)).toBe(1);
  });

  it("slices the active page", () => {
    const items = [1, 2, 3, 4, 5];
    expect(slicePage(items, 1, 2)).toEqual([1, 2]);
    expect(slicePage(items, 3, 2)).toEqual([5]);
  });

  it("formats range label", () => {
    expect(pageRangeLabel(1, 25, 26)).toBe("1–25 of 26");
    expect(pageRangeLabel(2, 25, 26)).toBe("26–26 of 26");
    expect(pageRangeLabel(1, 25, 0)).toBe("0 of 0");
  });

  it("builds compact page items with ellipsis", () => {
    expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(1, 10)).toEqual([1, 2, "ellipsis", 10]);
    expect(pageItems(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
    expect(pageItems(10, 10)).toEqual([1, "ellipsis", 9, 10]);
  });
});
