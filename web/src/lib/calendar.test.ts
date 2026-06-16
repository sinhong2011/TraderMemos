import { describe, expect, it } from "vitest";
import { monthGrid } from "./calendar";

describe("monthGrid", () => {
  it("builds a 6x7 grid covering the month with pnl mapped by day", () => {
    const pnl = { "2026-06-01": 200, "2026-06-15": -50 };
    const grid = monthGrid(2026, 6, pnl); // month is 1-based
    expect(grid.weeks.length).toBe(6);
    expect(grid.weeks[0].length).toBe(7);
    const june1 = grid.weeks.flat().find((c) => c?.date === "2026-06-01");
    expect(june1?.pnl).toBe(200);
    expect(grid.monthTotal).toBe(150);
  });
});
