import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
  MARKET_TIMEZONE_DEFAULT,
  TIME_FORMAT_DEFAULT,
  TIMEZONE_DEFAULT,
  useDisplayPrefs,
} from "@/lib/displayPrefs";
import { useJournalPrefs } from "@/lib/journalPrefs";
import {
  applyRemotePrefs,
  changedPrefs,
  localPrefsSnapshot,
  SYNCED_PREF_KEYS,
  unseededPrefs,
} from "@/lib/prefsSync";

beforeEach(() => {
  useDisplayPrefs.setState({
    displayCurrency: null,
    privacyMode: false,
    timezone: TIMEZONE_DEFAULT,
    marketTimezone: MARKET_TIMEZONE_DEFAULT,
    timeFormat: TIME_FORMAT_DEFAULT,
    tradeDateBasis: "close",
  });
  useJournalPrefs.setState({ maxScreenshotsPerTrade: null });
});

describe("what syncs", () => {
  // Syncing either of these would be wrong, not merely chatty: a dark room is
  // a property of where you are sitting, and privacy mode un-hiding amounts on
  // a shared screen because another device turned it off is a real leak.
  it("leaves theme and privacy mode out", () => {
    expect(SYNCED_PREF_KEYS).not.toContain("privacyMode");
    expect(SYNCED_PREF_KEYS).not.toContain("updateNotices");
    expect(localPrefsSnapshot()).not.toHaveProperty("privacyMode");
  });

  it("carries every preference that changes what the numbers mean", () => {
    expect(SYNCED_PREF_KEYS).toContain("marketTimezone");
    expect(SYNCED_PREF_KEYS).toContain("tradeDateBasis");
    expect(SYNCED_PREF_KEYS).toContain("displayCurrency");
    expect(SYNCED_PREF_KEYS).toContain("maxScreenshotsPerTrade");
  });
});

describe("applyRemotePrefs", () => {
  it("writes server values into both stores", () => {
    applyRemotePrefs({
      marketTimezone: "Asia/Hong_Kong",
      timezone: "Asia/Tokyo",
      timeFormat: "h23",
      tradeDateBasis: "open",
      displayCurrency: "HKD",
      maxScreenshotsPerTrade: 3,
    });
    const s = useDisplayPrefs.getState();
    expect(s.marketTimezone).toBe("Asia/Hong_Kong");
    expect(s.timezone).toBe("Asia/Tokyo");
    expect(s.timeFormat).toBe("h23");
    expect(s.tradeDateBasis).toBe("open");
    expect(s.displayCurrency).toBe("HKD");
    expect(useJournalPrefs.getState().maxScreenshotsPerTrade).toBe(3);
  });

  it("leaves keys the server has never stored alone", () => {
    useDisplayPrefs.getState().setTimeFormat("h23");
    applyRemotePrefs({ marketTimezone: "Asia/Tokyo" });
    expect(useDisplayPrefs.getState().timeFormat).toBe("h23");
  });

  // The server stores whatever a client sends, and a newer client may know
  // values this one does not.
  it("falls back to a default rather than storing a value it cannot honour", () => {
    applyRemotePrefs({ timezone: "Mars/Olympus", displayCurrency: "XYZ", timeFormat: "h37" });
    const s = useDisplayPrefs.getState();
    expect(s.timezone).toBe(TIMEZONE_DEFAULT);
    expect(s.timeFormat).toBe(TIME_FORMAT_DEFAULT);
    expect(s.displayCurrency).toBeNull();
  });

  // `null` is a value here — "follow the account's base currency" — not an
  // absent key.
  it("honours an explicit null currency", () => {
    useDisplayPrefs.getState().setDisplayCurrency("HKD");
    applyRemotePrefs({ displayCurrency: null });
    expect(useDisplayPrefs.getState().displayCurrency).toBeNull();
  });

  it("clamps a nonsense screenshots cap to unlimited", () => {
    applyRemotePrefs({ maxScreenshotsPerTrade: -4 });
    expect(useJournalPrefs.getState().maxScreenshotsPerTrade).toBeNull();
  });
});

describe("changedPrefs", () => {
  it("sends only what moved", () => {
    const before = localPrefsSnapshot();
    useDisplayPrefs.getState().setTimeFormat("h23");
    expect(changedPrefs(before, localPrefsSnapshot())).toEqual({ timeFormat: "h23" });
  });

  it("sends nothing when nothing moved", () => {
    const before = localPrefsSnapshot();
    expect(changedPrefs(before, localPrefsSnapshot())).toEqual({});
  });
});

describe("unseededPrefs", () => {
  // The first device to sign in must adopt the setup it already has rather
  // than be reset to defaults by an empty account.
  it("seeds every key when the account has stored nothing", () => {
    useDisplayPrefs.getState().setMarketTimezone("Asia/Hong_Kong");
    const local = localPrefsSnapshot();
    expect(unseededPrefs({}, local)).toEqual(local);
  });

  it("leaves keys the server already has", () => {
    const local = localPrefsSnapshot();
    const seed = unseededPrefs({ marketTimezone: "Asia/Tokyo" }, local);
    expect(seed).not.toHaveProperty("marketTimezone");
    expect(seed).toHaveProperty("timeFormat");
  });
});
