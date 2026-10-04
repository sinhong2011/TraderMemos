import { afterEach, describe, expect, it } from "vite-plus/test";
import { useDisplayPrefs } from "./displayPrefs";
import { marketTodayKey } from "./today";

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
