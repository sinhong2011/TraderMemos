import { describe, expect, it } from "vite-plus/test";
import { barsToCandlestickData } from "./barsToCandlestickData";

function bar(time: number, close = 100) {
  return { time, open: close, high: close + 1, low: close - 1, close, volume: 1 };
}

describe("barsToCandlestickData", () => {
  it("passes through contiguous bars unchanged", () => {
    const bars = [bar(1_000), bar(1_300), bar(1_600)];
    const points = barsToCandlestickData(bars, "5", "UTC");
    expect(points).toHaveLength(3);
    expect(points.every((p) => "open" in p)).toBe(true);
  });

  it("inserts whitespace for a missing interval", () => {
    const t0 = Math.floor(Date.parse("2024-07-15T13:30:00.000Z") / 1000);
    const t1 = t0 + 600;
    const points = barsToCandlestickData([bar(t0), bar(t1)], "5", "UTC");
    expect(points).toHaveLength(3);
    expect(points[1]).toEqual({ time: t0 + 300 });
    expect("open" in points[0]!).toBe(true);
    expect("open" in points[2]!).toBe(true);
  });

  it("fills a multi-hour intraday hole so the axis can advance", () => {
    const start = Math.floor(Date.parse("2024-07-15T14:15:00.000Z") / 1000);
    const end = Math.floor(Date.parse("2024-07-15T20:00:00.000Z") / 1000);
    const points = barsToCandlestickData([bar(start), bar(end)], "5", "UTC");
    expect(points.length).toBeGreaterThan(60);
    expect(points[0]).toMatchObject({ time: start, open: 100 });
    expect(points.at(-1)).toMatchObject({ time: end, open: 100 });
    expect(points.filter((p) => !("open" in p)).length).toBeGreaterThan(60);
  });

  it("shifts labels to America/New_York wall clock", () => {
    const utc = Math.floor(Date.parse("2024-07-15T13:30:00.000Z") / 1000);
    const points = barsToCandlestickData([bar(utc)], "5", "America/New_York");
    expect(points[0]).toMatchObject({
      time: Math.floor(Date.UTC(2024, 6, 15, 9, 30, 0) / 1000),
      open: 100,
    });
  });

  it("uses a short break for oversized gaps instead of exploding", () => {
    const t0 = Math.floor(Date.parse("2024-01-02T00:00:00.000Z") / 1000);
    const t1 = t0 + 86_400 * 30;
    const points = barsToCandlestickData([bar(t0), bar(t1)], "D", "UTC");
    // 29 missing days > max fill of 5 → 3 whitespace + 2 candles
    expect(points).toHaveLength(5);
    expect(points.filter((p) => !("open" in p))).toHaveLength(3);
  });
});
