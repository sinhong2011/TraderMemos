import { describe, expect, it } from "vite-plus/test";
import { DRAWER_PRIMARY, isNavItemActive, PRIMARY_NAV, SECONDARY_NAV } from "./navItems";

const today = PRIMARY_NAV.find((item) => item.to === "/today")!;
const home = PRIMARY_NAV.find((item) => item.to === "/home")!;

describe("isNavItemActive", () => {
  it("lights Today on the day review and on its full-size sections", () => {
    expect(isNavItemActive("/today", today)).toBe(true);
    expect(isNavItemActive("/day/2026-10-02", today)).toBe(true);
    expect(isNavItemActive("/routines", today)).toBe(true);
    expect(isNavItemActive("/missed", today)).toBe(true);
  });

  it("does not light Today elsewhere, or prefix-match a longer segment", () => {
    expect(isNavItemActive("/home", today)).toBe(false);
    expect(isNavItemActive("/dayz", today)).toBe(false);
    expect(isNavItemActive("/day/2026-10-02", home)).toBe(false);
  });
});

describe("nav layout", () => {
  it("keeps sections of Today and tools out of the rail", () => {
    const rail = [...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => item.to);
    for (const gone of ["/routines", "/missed", "/events", "/calculator"]) {
      expect(rail).not.toContain(gone);
    }
  });

  it("leaves an even split of tabs around the phone create button", () => {
    const tabs = PRIMARY_NAV.filter((item) => !DRAWER_PRIMARY.has(item.to));
    // Plus the "More" tab, the capsule must hold an even count.
    expect((tabs.length + 1) % 2).toBe(0);
  });
});
