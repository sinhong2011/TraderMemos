/**
 * Display preferences — privacy mode, display currency override, timezones,
 * clock format, trade date basis, and screenshot cap. Module-level
 * `useSyncExternalStore` store (same pattern as tag-bar.ts) persisted to MMKV,
 * mirroring web/src/lib/displayPrefs.ts.
 *
 * Two clocks, two jobs: the *market* timezone owns everything date-shaped
 * (calendar day attribution, filter boundaries, the API `tz` bucketing param);
 * the *display* timezone only formats clock times.
 */

import { useSyncExternalStore } from 'react';

import { storage } from '@/storage/mmkv';

// ---------------------------------------------------------------------------
// Constants (mirrored from web displayPrefs.ts)
// ---------------------------------------------------------------------------

/** Currencies offered by the display-currency override. */
export const DISPLAY_CURRENCIES = [
  'USD',
  'HKD',
  'TWD',
  'CNY',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'SGD',
] as const;

export type DisplayCurrencyCode = (typeof DISPLAY_CURRENCIES)[number];

/** `null` = follow the selected account's base currency. */
export type DisplayCurrencyOverride = DisplayCurrencyCode | null;

/** Prefs value resolved to the device's IANA zone at read time. */
export const TIMEZONE_LOCAL = 'local';

/** Default analytics / session clock (US equity). */
export const TIMEZONE_DEFAULT = 'America/New_York';

/** Curated IANA zones (plus Local). Labels omit offsets — use timezoneOptions(). */
export const TIMEZONE_CHOICES = [
  { value: TIMEZONE_LOCAL, name: 'Local (device)' },
  { value: 'America/New_York', name: 'Eastern (New York)' },
  { value: 'America/Chicago', name: 'Central (Chicago)' },
  { value: 'America/Denver', name: 'Mountain (Denver)' },
  { value: 'America/Los_Angeles', name: 'Pacific (Los Angeles)' },
  { value: 'Europe/London', name: 'London' },
  { value: 'Europe/Berlin', name: 'Berlin' },
  { value: 'Asia/Hong_Kong', name: 'Hong Kong' },
  { value: 'Asia/Taipei', name: 'Taipei' },
  { value: 'Asia/Shanghai', name: 'Shanghai' },
  { value: 'Asia/Singapore', name: 'Singapore' },
  { value: 'Asia/Tokyo', name: 'Tokyo' },
  { value: 'UTC', name: 'UTC' },
] as const;

export type TimezonePref = (typeof TIMEZONE_CHOICES)[number]['value'];

/**
 * Exchange clock that defines the trading day. Grouping a Friday New York
 * close under the viewer's Saturday is never correct, so `"local"` is not
 * offered here — a market's day cannot follow the phone.
 */
export type MarketTimezonePref = Exclude<TimezonePref, typeof TIMEZONE_LOCAL>;

export const MARKET_TIMEZONE_DEFAULT: MarketTimezonePref = TIMEZONE_DEFAULT;

/** 12-hour vs 24-hour clock for displayed times. */
export type TimeFormatPref = 'h12' | 'h23';

export const TIME_FORMAT_DEFAULT: TimeFormatPref = 'h12';

/** Which timestamp attributes a trade to a calendar day / date filter. */
export type TradeDateBasis = 'close' | 'open';

export const TRADE_DATE_BASIS_DEFAULT: TradeDateBasis = 'close';

export const PRIVACY_MASK = '••••';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export type DisplayPrefs = {
  /** When true, money formatters render a mask instead of amounts. */
  privacyMode: boolean;
  /** Override for read-only surfaces; `null` follows the account base currency. */
  displayCurrency: DisplayCurrencyOverride;
  /** Display timezone for formatted timestamps (formatting only). */
  timezone: TimezonePref;
  /** Exchange clock that defines the trading day (bucketing + filters). */
  marketTimezone: MarketTimezonePref;
  timeFormat: TimeFormatPref;
  tradeDateBasis: TradeDateBasis;
  /** Cap on screenshots per trade; `null` = unlimited. */
  maxScreenshotsPerTrade: number | null;
};

const DEFAULTS: DisplayPrefs = {
  privacyMode: false,
  displayCurrency: null,
  timezone: TIMEZONE_DEFAULT,
  marketTimezone: MARKET_TIMEZONE_DEFAULT,
  timeFormat: TIME_FORMAT_DEFAULT,
  tradeDateBasis: TRADE_DATE_BASIS_DEFAULT,
  maxScreenshotsPerTrade: null,
};

const STORAGE_KEY = 'prefs:display';

function isDisplayCurrencyCode(value: unknown): value is DisplayCurrencyCode {
  return typeof value === 'string' && (DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

function isTimezonePref(value: unknown): value is TimezonePref {
  return (
    typeof value === 'string' &&
    (TIMEZONE_CHOICES as readonly { value: string }[]).some((o) => o.value === value)
  );
}

function isMarketTimezonePref(value: unknown): value is MarketTimezonePref {
  return value !== TIMEZONE_LOCAL && isTimezonePref(value);
}

/** Validate every persisted field — a stale or hand-edited blob never wedges the app. */
function sanitize(raw: unknown): DisplayPrefs {
  if (typeof raw !== 'object' || raw == null) return DEFAULTS;
  const r = raw as Record<string, unknown>;
  return {
    privacyMode: typeof r.privacyMode === 'boolean' ? r.privacyMode : DEFAULTS.privacyMode,
    displayCurrency: isDisplayCurrencyCode(r.displayCurrency) ? r.displayCurrency : null,
    timezone: isTimezonePref(r.timezone) ? r.timezone : DEFAULTS.timezone,
    marketTimezone: isMarketTimezonePref(r.marketTimezone)
      ? r.marketTimezone
      : DEFAULTS.marketTimezone,
    timeFormat:
      r.timeFormat === 'h12' || r.timeFormat === 'h23' ? r.timeFormat : DEFAULTS.timeFormat,
    tradeDateBasis:
      r.tradeDateBasis === 'close' || r.tradeDateBasis === 'open'
        ? r.tradeDateBasis
        : DEFAULTS.tradeDateBasis,
    maxScreenshotsPerTrade:
      typeof r.maxScreenshotsPerTrade === 'number' &&
      Number.isFinite(r.maxScreenshotsPerTrade) &&
      r.maxScreenshotsPerTrade >= 1
        ? Math.floor(r.maxScreenshotsPerTrade)
        : null,
  };
}

function load(): DisplayPrefs {
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return DEFAULTS;
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return DEFAULTS;
  }
}

let snapshot: DisplayPrefs = load();
const listeners = new Set<() => void>();

function setPrefs(patch: Partial<DisplayPrefs>) {
  snapshot = { ...snapshot, ...patch };
  storage.set(STORAGE_KEY, JSON.stringify(snapshot));
  for (const listener of listeners) listener();
}

/** Non-reactive read for formatters — components subscribe via useDisplayPrefs. */
export function getPrefs(): DisplayPrefs {
  return snapshot;
}

/**
 * Subscribe to display prefs. Under React Compiler, call this in the same
 * component that formats money/times — a parent's subscription does not
 * re-render memoized children.
 */
export function useDisplayPrefs(): DisplayPrefs {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => snapshot,
  );
}

export function setPrivacyMode(on: boolean) {
  setPrefs({ privacyMode: on });
}

export function setDisplayCurrency(currency: DisplayCurrencyOverride) {
  setPrefs({ displayCurrency: isDisplayCurrencyCode(currency) ? currency : null });
}

export function setTimezone(tz: TimezonePref) {
  setPrefs({ timezone: isTimezonePref(tz) ? tz : TIMEZONE_DEFAULT });
}

export function setMarketTimezone(tz: MarketTimezonePref) {
  setPrefs({ marketTimezone: isMarketTimezonePref(tz) ? tz : MARKET_TIMEZONE_DEFAULT });
}

export function setTimeFormat(fmt: TimeFormatPref) {
  setPrefs({ timeFormat: fmt === 'h23' ? 'h23' : 'h12' });
}

export function setTradeDateBasis(basis: TradeDateBasis) {
  setPrefs({ tradeDateBasis: basis === 'open' ? 'open' : 'close' });
}

export function setMaxScreenshotsPerTrade(max: number | null) {
  setPrefs({
    maxScreenshotsPerTrade:
      max != null && Number.isFinite(max) && max >= 1 ? Math.floor(max) : null,
  });
}

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

/** Resolve a stored prefs value to an IANA name for display formatting. */
export function resolveDisplayTimezone(pref: string = getPrefs().timezone): string {
  if (pref === TIMEZONE_LOCAL) {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || TIMEZONE_DEFAULT;
    } catch {
      return TIMEZONE_DEFAULT;
    }
  }
  return isTimezonePref(pref) ? pref : TIMEZONE_DEFAULT;
}

/** Resolve the market timezone pref to an IANA name (owns day bucketing). */
export function resolveMarketTimezone(pref: string = getPrefs().marketTimezone): string {
  return isMarketTimezonePref(pref) ? pref : MARKET_TIMEZONE_DEFAULT;
}

/** Current display clock options for Intl date/time formatting. */
export function getDisplayTimeOpts(): { timeZone: string; hour12: boolean } {
  const prefs = getPrefs();
  return {
    timeZone: resolveDisplayTimezone(prefs.timezone),
    hour12: prefs.timeFormat === 'h12',
  };
}

/**
 * Format the current offset for an IANA zone as `UTC+08` / `UTC-05` / `UTC+05:30`.
 * DST-aware for the given instant.
 */
export function formatUtcOffsetPrefix(timeZone: string, at: Date = new Date()): string {
  try {
    const raw =
      new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
        .formatToParts(at)
        .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    if (raw === 'GMT' || raw === 'UTC') return 'UTC+00';
    const m = raw.match(/GMT([+-])(\d+)(?::(\d+))?/i);
    if (!m) return raw.replace(/^GMT/i, 'UTC');
    const hours = String(Number(m[2])).padStart(2, '0');
    const mins = m[3] ? Number(m[3]) : 0;
    if (mins === 0) return `UTC${m[1]}${hours}`;
    return `UTC${m[1]}${hours}:${String(mins).padStart(2, '0')}`;
  } catch {
    return 'UTC';
  }
}

/** RFC3339 offset suffix (`"+08:00"`, `"Z"`) for a zone at a given instant. */
export function rfc3339OffsetSuffix(timeZone: string, at: Date = new Date()): string {
  try {
    const raw =
      new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
        .formatToParts(at)
        .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    if (raw === 'GMT' || raw === 'UTC') return 'Z';
    const m = raw.match(/GMT([+-])(\d+)(?::(\d+))?/i);
    if (!m) return 'Z';
    const hours = String(Number(m[2])).padStart(2, '0');
    const mins = String(m[3] ? Number(m[3]) : 0).padStart(2, '0');
    if (hours === '00' && mins === '00') return 'Z';
    return `${m[1]}${hours}:${mins}`;
  } catch {
    return 'Z';
  }
}

/**
 * Interpret an offsetless wall-clock string (`YYYY-MM-DDTHH:mm[:ss]`) in the
 * display timezone and return the UTC instant (ISO).
 */
export function wallClockToIso(v: string, timeZone?: string): string {
  const tz = timeZone ?? resolveDisplayTimezone();
  // Offset in effect around midday of that date (DST transitions run at night).
  const offset = rfc3339OffsetSuffix(tz, new Date(`${v.slice(0, 10)}T12:00:00Z`));
  const d = new Date(`${v}${offset}`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Format an instant as an offsetless wall-clock string in the display timezone. */
export function isoToWallClock(at: string | Date, timeZone?: string): string {
  const tz = timeZone ?? resolveDisplayTimezone();
  const d = typeof at === 'string' ? new Date(at) : at;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

/** Timezone options with live `UTC±XX` prefixes for the settings pickers. */
export function timezoneOptions(
  at: Date = new Date(),
): { value: TimezonePref; label: string }[] {
  return TIMEZONE_CHOICES.map(({ value, name }) => {
    const iana = value === TIMEZONE_LOCAL ? resolveDisplayTimezone(TIMEZONE_LOCAL) : value;
    const offset = formatUtcOffsetPrefix(iana, at);
    if (value === 'UTC') return { value, label: 'UTC+00' };
    if (value === TIMEZONE_LOCAL) return { value, label: `${offset} ${name}` };
    return { value, label: `${offset} ${name}` };
  });
}

/** Market timezone options — same list minus "Local (device)". */
export function marketTimezoneOptions(
  at: Date = new Date(),
): { value: MarketTimezonePref; label: string }[] {
  return timezoneOptions(at).filter(
    (o): o is { value: MarketTimezonePref; label: string } => o.value !== TIMEZONE_LOCAL,
  );
}

/**
 * Format an hour bucket key (`"14:00"`) for display. The API buckets hours in
 * the market timezone, so keys are already on the market clock — this only
 * applies the 12/24-hour preference.
 */
export function formatHourKeyLabel(hourKey: string): string {
  const hour = Number.parseInt(hourKey.slice(0, 2), 10);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return hourKey;
  if (getPrefs().timeFormat === 'h23') return `${String(hour).padStart(2, '0')}:00`;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
}

/** Account ledger currency — source of truth for stored amounts / forms. */
export function accountBaseCurrency(
  accounts: readonly { id: string; base_currency: string }[] | undefined,
  accountId?: string | null,
  fallback = 'USD',
): string {
  if (!accounts || accounts.length === 0) return fallback;
  if (!accountId) return accounts[0].base_currency || fallback;
  return accounts.find((a) => a.id === accountId)?.base_currency ?? fallback;
}
