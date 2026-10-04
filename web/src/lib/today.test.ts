import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useDisplayPrefs } from "./displayPrefs";
import { marketTodayKey, useMarketToday } from "./today";

const initial = useDisplayPrefs.getState().marketTimezone;

describe("marketTodayKey", () => {
  afterEach(() => useDisplayPrefs.getState().setMarketTimezone(initial));

  it("reads the date on the market clock, not the browser's", () => {
    // 09:45 on Oct 4 in Hong Kong is still the evening of Oct 3 in New York.
    const at = new Date("2026-10-04T01:45:00Z");
    useDisplayPrefs.getState().setMarketTimezone("America/New_York");
    expect(marketTodayKey(at)).toBe("2026-10-03");
    useDisplayPrefs.getState().setMarketTimezone("Asia/Hong_Kong");
    expect(marketTodayKey(at)).toBe("2026-10-04");
  });
});

describe("useMarketToday", () => {
  afterEach(() => {
    vi.useRealTimers();
    useDisplayPrefs.getState().setMarketTimezone(initial);
  });

  it("re-keys the day when the market timezone changes", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T01:45:00Z"));
    useDisplayPrefs.getState().setMarketTimezone("America/New_York");
    const { result } = renderHook(() => useMarketToday());
    expect(result.current).toBe("2026-10-03");
    act(() => useDisplayPrefs.getState().setMarketTimezone("Asia/Hong_Kong"));
    expect(result.current).toBe("2026-10-04");
  });
});
