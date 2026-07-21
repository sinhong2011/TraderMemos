import { describe, expect, it } from "vite-plus/test";
import { utcSecToChartTime } from "./chartTime";

describe("utcSecToChartTime", () => {
  it("maps summer UTC RTH open to 09:30 Eastern", () => {
    // 2024-07-15 13:30 UTC = 09:30 EDT
    const utc = Math.floor(Date.parse("2024-07-15T13:30:00.000Z") / 1000);
    expect(utcSecToChartTime(utc, "America/New_York")).toBe(
      Math.floor(Date.UTC(2024, 6, 15, 9, 30, 0) / 1000),
    );
  });

  it("maps winter UTC RTH open to 09:30 Eastern", () => {
    // 2024-01-15 14:30 UTC = 09:30 EST
    const utc = Math.floor(Date.parse("2024-01-15T14:30:00.000Z") / 1000);
    expect(utcSecToChartTime(utc, "America/New_York")).toBe(
      Math.floor(Date.UTC(2024, 0, 15, 9, 30, 0) / 1000),
    );
  });

  it("maps market close 20:00 UTC to 16:00 Eastern in summer", () => {
    const utc = Math.floor(Date.parse("2024-07-15T20:00:00.000Z") / 1000);
    expect(utcSecToChartTime(utc, "America/New_York")).toBe(
      Math.floor(Date.UTC(2024, 6, 15, 16, 0, 0) / 1000),
    );
  });
});
