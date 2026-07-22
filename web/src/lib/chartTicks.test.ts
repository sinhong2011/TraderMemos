import { describe, expect, it } from "vite-plus/test";
import { uniqueDayTicks } from "./chartTicks";

describe("uniqueDayTicks", () => {
  it("keeps the first point of each day", () => {
    expect(
      uniqueDayTicks([
        { at: "2026-07-09T09:30:00Z" },
        { at: "2026-07-09T15:45:00Z" },
        { at: "2026-07-10T09:31:00Z" },
      ]),
    ).toEqual(["2026-07-09T09:30:00Z", "2026-07-10T09:31:00Z"]);
  });
  it("handles empty input", () => {
    expect(uniqueDayTicks([])).toEqual([]);
  });
});
