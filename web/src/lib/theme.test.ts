import { describe, expect, it } from "vite-plus/test";
import { pnlColor } from "../components/theme-tokens";

describe("pnlColor", () => {
  it("maps sign to semantic classes", () => {
    expect(pnlColor(120)).toBe("text-profit");
    expect(pnlColor(-5)).toBe("text-loss");
    expect(pnlColor(0)).toBe("text-flat");
  });
});
