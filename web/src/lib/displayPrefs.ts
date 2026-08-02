import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Account } from "./api/types";

export const DISPLAY_PREFS_STORAGE_KEY = "tm-display-prefs";

/** Currencies offered in the header display switch. */
export const DISPLAY_CURRENCIES = [
  "USD",
  "HKD",
  "TWD",
  "CNY",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "SGD",
] as const;

export type DisplayCurrencyCode = (typeof DISPLAY_CURRENCIES)[number];

/** `null` = follow the selected account's base currency. */
export type DisplayCurrencyOverride = DisplayCurrencyCode | null;

/**
 * Special prefs value: resolve to the browser's IANA zone at request time.
 * Stored as-is in localStorage; never sent to the API.
 */
export const TIMEZONE_LOCAL = "local";

/** Default analytics / session clock (US equity). */
export const TIMEZONE_DEFAULT = "America/New_York";

/** Curated IANA zones for Settings → Timezone (plus Local). Labels omit offset — use timezoneSelectOptions(). */
export const TIMEZONE_CHOICES = [
  { value: TIMEZONE_LOCAL, name: "Local (browser)" },
  { value: "America/New_York", name: "Eastern (New York)" },
  { value: "America/Chicago", name: "Central (Chicago)" },
  { value: "America/Denver", name: "Mountain (Denver)" },
  { value: "America/Los_Angeles", name: "Pacific (Los Angeles)" },
  { value: "Europe/London", name: "London" },
  { value: "Europe/Berlin", name: "Berlin" },
  { value: "Asia/Hong_Kong", name: "Hong Kong" },
  { value: "Asia/Taipei", name: "Taipei" },
  { value: "Asia/Shanghai", name: "Shanghai" },
  { value: "Asia/Singapore", name: "Singapore" },
  { value: "Asia/Tokyo", name: "Tokyo" },
  { value: "UTC", name: "UTC" },
] as const;

export type TimezonePref = (typeof TIMEZONE_CHOICES)[number]["value"];

/**
 * Exchange clock that defines the trading day. Grouping a Friday New York
 * close under the viewer's Saturday is never correct, so `"local"` is not
 * offered here — a market's day cannot follow the browser.
 */
export type MarketTimezonePref = Exclude<TimezonePref, typeof TIMEZONE_LOCAL>;

export const MARKET_TIMEZONE_DEFAULT: MarketTimezonePref = TIMEZONE_DEFAULT;

/** 12-hour vs 24-hour clock for displayed times (Tradervue-style). */
export type TimeFormatPref = "h12" | "h23";

export const TIME_FORMAT_DEFAULT: TimeFormatPref = "h12";

export const TIME_FORMAT_OPTIONS = [
  { value: "h12" as const, label: "12-hour (1:30 PM)" },
  { value: "h23" as const, label: "24-hour (13:30)" },
];

/**
 * Which timestamp attributes a trade to a calendar day / date filter.
 * Close date = realized P&L day (default). Open date = entry day.
 */
export type TradeDateBasis = "close" | "open";

export const TRADE_DATE_BASIS_DEFAULT: TradeDateBasis = "close";

export const TRADE_DATE_BASIS_OPTIONS = [
  { value: "close" as const, label: "Close date (last activity)" },
  { value: "open" as const, label: "Open date (entry)" },
];

function isTimeFormatPref(value: string): value is TimeFormatPref {
  return value === "h12" || value === "h23";
}

function isTradeDateBasis(value: string): value is TradeDateBasis {
  return value === "close" || value === "open";
}

/**
 * Format the current offset for an IANA zone as `UTC+08` / `UTC-05` / `UTC+05:30`.
 * DST-aware for the given instant (defaults to now). Hours are always two digits.
 */
export function formatUtcOffsetPrefix(timeZone: string, at: Date = new Date()): string {
  try {
    const raw =
      new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
        .formatToParts(at)
        .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    if (raw === "GMT" || raw === "UTC") return "UTC+00";
    const m = raw.match(/GMT([+-])(\d+)(?::(\d+))?/i);
    if (!m) return raw.replace(/^GMT/i, "UTC");
    const sign = m[1];
    const hours = String(Number(m[2])).padStart(2, "0");
    const mins = m[3] ? Number(m[3]) : 0;
    if (mins === 0) return `UTC${sign}${hours}`;
    return `UTC${sign}${hours}:${String(mins).padStart(2, "0")}`;
  } catch {
    return "UTC";
  }
}

/**
 * RFC3339 offset suffix (`"+08:00"`, `"-05:00"`, `"Z"`) for a zone at a given
 * instant. Used to build day-boundary timestamps in the display timezone.
 */
export function rfc3339OffsetSuffix(timeZone: string, at: Date = new Date()): string {
  try {
    const raw =
      new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
        .formatToParts(at)
        .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    if (raw === "GMT" || raw === "UTC") return "Z";
    const m = raw.match(/GMT([+-])(\d+)(?::(\d+))?/i);
    if (!m) return "Z";
    const hours = String(Number(m[2])).padStart(2, "0");
    const mins = String(m[3] ? Number(m[3]) : 0).padStart(2, "0");
    if (hours === "00" && mins === "00") return "Z";
    return `${m[1]}${hours}:${mins}`;
  } catch {
    return "Z";
  }
}

export const PRIVACY_MASK = "••••";

function isDisplayCurrencyCode(value: string): value is DisplayCurrencyCode {
  return (DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

function isTimezonePref(value: string): value is TimezonePref {
  return (TIMEZONE_CHOICES as readonly { value: string }[]).some((o) => o.value === value);
}

function isMarketTimezonePref(value: string): value is MarketTimezonePref {
  return value !== TIMEZONE_LOCAL && isTimezonePref(value);
}

/**
 * Resolve the market timezone pref to an IANA name. This zone owns everything
 * date-shaped: calendar day attribution, date-range filter boundaries, and the
 * API `tz` bucketing param. The display timezone only formats clock times.
 */
export function resolveMarketTimezone(pref: string = MARKET_TIMEZONE_DEFAULT): string {
  return isMarketTimezonePref(pref) ? pref : MARKET_TIMEZONE_DEFAULT;
}

/** Resolve a stored prefs value to an IANA name for display formatting. */
export function resolveDisplayTimezone(pref: string = TIMEZONE_DEFAULT): string {
  if (pref === TIMEZONE_LOCAL) {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || TIMEZONE_DEFAULT;
    } catch {
      return TIMEZONE_DEFAULT;
    }
  }
  return isTimezonePref(pref) ? pref : TIMEZONE_DEFAULT;
}

/** Select options with live `UTC±XX` prefixes. */
export function timezoneSelectOptions(
  at: Date = new Date(),
): { value: TimezonePref; label: string }[] {
  return TIMEZONE_CHOICES.map(({ value, name }) => {
    const iana = value === TIMEZONE_LOCAL ? resolveDisplayTimezone(TIMEZONE_LOCAL) : value;
    const offset = formatUtcOffsetPrefix(iana, at);
    if (value === "UTC") return { value, label: "UTC+00" };
    if (value === TIMEZONE_LOCAL) {
      return { value, label: `${offset} Local (${iana})` };
    }
    return { value, label: `${offset} ${name}` };
  });
}

/** Market timezone select options — same list minus "Local (browser)". */
export function marketTimezoneSelectOptions(
  at: Date = new Date(),
): { value: MarketTimezonePref; label: string }[] {
  return timezoneSelectOptions(at).filter(
    (o): o is { value: MarketTimezonePref; label: string } => o.value !== TIMEZONE_LOCAL,
  );
}

/** Current display clock options for Intl date/time formatting. */
export function getDisplayTimeOpts(): {
  timeZone: string;
  hour12: boolean;
  hourCycle: TimeFormatPref;
} {
  const s = useDisplayPrefs.getState();
  const hourCycle = isTimeFormatPref(s.timeFormat) ? s.timeFormat : TIME_FORMAT_DEFAULT;
  return {
    timeZone: resolveDisplayTimezone(s.timezone),
    hour12: hourCycle === "h12",
    hourCycle,
  };
}

/**
 * Format an hour bucket key (`"14:00"`) for display. The API buckets hours in
 * the market timezone (`tz` filter param), so keys are already on the market
 * clock — this only applies the 12/24-hour clock preference.
 */
export function formatHourKeyLabel(hourKey: string, hourCycle?: TimeFormatPref): string {
  const hour = Number.parseInt(hourKey.slice(0, 2), 10);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return hourKey;
  const cycle = hourCycle ?? getDisplayTimeOpts().hourCycle;
  if (cycle === "h23") return `${String(hour).padStart(2, "0")}:00`;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${hour < 12 ? "AM" : "PM"}`;
}

interface DisplayPrefsState {
  /**
   * Display currency override for read-only UI.
   * Amounts are FX-converted from account base → display using latest rates.
   * `null` follows the selected account's base currency (no conversion).
   */
  displayCurrency: DisplayCurrencyOverride;
  /** When true, money formatters render a mask instead of amounts. */
  privacyMode: boolean;
  /**
   * Display timezone for formatted timestamps. `"local"` follows the browser;
   * default is US Eastern. Does not change trading-day grouping or analytics
   * bucketing — those follow `marketTimezone`.
   */
  timezone: TimezonePref;
  /**
   * Exchange clock that defines the trading day. Drives calendar day
   * attribution, date-range filter boundaries, and API day/hour bucketing.
   */
  marketTimezone: MarketTimezonePref;
  /** 12-hour vs 24-hour for displayed times (and picker labels). */
  timeFormat: TimeFormatPref;
  /**
   * Attribute trades to calendar days / date ranges by close or open timestamp.
   * Default close matches realized-P&L calendar semantics.
   */
  tradeDateBasis: TradeDateBasis;
  setDisplayCurrency: (currency: DisplayCurrencyOverride) => void;
  setPrivacyMode: (on: boolean) => void;
  togglePrivacyMode: () => void;
  setTimezone: (tz: TimezonePref) => void;
  setMarketTimezone: (tz: MarketTimezonePref) => void;
  setTimeFormat: (fmt: TimeFormatPref) => void;
  setTradeDateBasis: (basis: TradeDateBasis) => void;
}

export const useDisplayPrefs = create<DisplayPrefsState>()(
  persist(
    (set) => ({
      displayCurrency: null,
      privacyMode: false,
      timezone: TIMEZONE_DEFAULT,
      marketTimezone: MARKET_TIMEZONE_DEFAULT,
      timeFormat: TIME_FORMAT_DEFAULT,
      tradeDateBasis: TRADE_DATE_BASIS_DEFAULT,
      setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
      setPrivacyMode: (privacyMode) => set({ privacyMode }),
      togglePrivacyMode: () => set((s) => ({ privacyMode: !s.privacyMode })),
      setTimezone: (timezone) =>
        set({ timezone: isTimezonePref(timezone) ? timezone : TIMEZONE_DEFAULT }),
      setMarketTimezone: (marketTimezone) =>
        set({
          marketTimezone: isMarketTimezonePref(marketTimezone)
            ? marketTimezone
            : MARKET_TIMEZONE_DEFAULT,
        }),
      setTimeFormat: (timeFormat) =>
        set({ timeFormat: isTimeFormatPref(timeFormat) ? timeFormat : TIME_FORMAT_DEFAULT }),
      setTradeDateBasis: (tradeDateBasis) =>
        set({
          tradeDateBasis: isTradeDateBasis(tradeDateBasis)
            ? tradeDateBasis
            : TRADE_DATE_BASIS_DEFAULT,
        }),
    }),
    {
      name: DISPLAY_PREFS_STORAGE_KEY,
      partialize: (s) => ({
        displayCurrency: s.displayCurrency,
        privacyMode: s.privacyMode,
        timezone: s.timezone,
        marketTimezone: s.marketTimezone,
        timeFormat: s.timeFormat,
        tradeDateBasis: s.tradeDateBasis,
      }),
      merge: (persisted, current) => {
        const raw = persisted as (Partial<DisplayPrefsState> & { currency?: string }) | undefined;
        let displayCurrency: DisplayCurrencyOverride = current.displayCurrency;
        if (raw && "displayCurrency" in raw) {
          const v = raw.displayCurrency;
          displayCurrency =
            v === null || v === undefined
              ? null
              : isDisplayCurrencyCode(v)
                ? v
                : current.displayCurrency;
        } else if (raw?.currency && isDisplayCurrencyCode(raw.currency)) {
          displayCurrency = raw.currency;
        }
        const timezone =
          raw?.timezone && isTimezonePref(raw.timezone) ? raw.timezone : current.timezone;
        const marketTimezone =
          raw?.marketTimezone && isMarketTimezonePref(raw.marketTimezone)
            ? raw.marketTimezone
            : current.marketTimezone;
        const timeFormat =
          raw?.timeFormat && isTimeFormatPref(raw.timeFormat) ? raw.timeFormat : current.timeFormat;
        const tradeDateBasis =
          raw?.tradeDateBasis && isTradeDateBasis(raw.tradeDateBasis)
            ? raw.tradeDateBasis
            : current.tradeDateBasis;
        return {
          ...current,
          displayCurrency,
          privacyMode:
            typeof raw?.privacyMode === "boolean" ? raw.privacyMode : current.privacyMode,
          timezone,
          marketTimezone,
          timeFormat,
          tradeDateBasis,
        };
      },
    },
  ),
);

/** Subscribe so components re-render when timezone / time format change. */
export function useDisplayTimePrefs(): { timezone: TimezonePref; timeFormat: TimeFormatPref } {
  const timezone = useDisplayPrefs((s) => s.timezone);
  const timeFormat = useDisplayPrefs((s) => s.timeFormat);
  return { timezone, timeFormat };
}

/** Account ledger currency — source of truth for stored amounts / forms. */
export function accountBaseCurrency(
  accounts: readonly Pick<Account, "id" | "base_currency">[],
  accountId?: string,
  fallback = "USD",
): string {
  if (!accountId) return fallback;
  return accounts.find((a) => a.id === accountId)?.base_currency ?? fallback;
}

/** Prefer display override; otherwise use account base. */
export function resolveDisplayCurrency(baseCurrency: string): string {
  return useDisplayPrefs.getState().displayCurrency ?? baseCurrency;
}

/**
 * Money formatting currency for read-only UI surfaces.
 * Forms / cash entry should keep using `accountBaseCurrency`.
 */
export function useDisplayCurrency(baseCurrency: string): string {
  const override = useDisplayPrefs((s) => s.displayCurrency);
  return override ?? baseCurrency;
}

export function isPrivacyMode(): boolean {
  return useDisplayPrefs.getState().privacyMode;
}

/**
 * Subscribe to privacy mode in any component that renders `fmtMoney*`.
 * Formatters read privacy via `getState()` at render time. Under React Compiler,
 * parent subscriptions do not remask memoized children — call this in the same
 * component that formats money (or a leaf like MoneyCell).
 */
export function usePrivacyMode(): boolean {
  return useDisplayPrefs((s) => s.privacyMode);
}
