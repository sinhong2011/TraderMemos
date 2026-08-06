/**
 * Display preferences — privacy mode, display currency override, timezones,
 * clock format, trade date basis. MMKV-persisted zustand store, mirroring
 * web/src/lib/displayPrefs.ts. Formatting only: the screenshots cap is a
 * journaling rule and lives in journal-prefs.ts, so the reset here can take
 * the whole store.
 *
 * Two clocks, two jobs: the *market* timezone owns everything date-shaped
 * (calendar day attribution, filter boundaries, the API `tz` bucketing param);
 * the *display* timezone only formats clock times.
 */

import { UnistylesRuntime, useUnistyles } from 'react-native-unistyles';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DISPLAY_PERSIST_KEY, migrateLegacyPrefs } from '@/lib/prefs-migration';
import { mmkvStorage } from '@/storage/zustand-mmkv';

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

/**
 * Curated IANA zones (plus Local). `name` mirrors the web catalog; `short` is
 * the phone label — a picker row shows label *and* value on one line, and
 * "UTC-04 Eastern (New York)" wraps onto a second line at body size.
 * Labels omit offsets — use timezoneOptions().
 */
export const TIMEZONE_CHOICES = [
  { value: TIMEZONE_LOCAL, name: 'Local (device)', short: 'Local' },
  { value: 'America/New_York', name: 'Eastern (New York)', short: 'New York' },
  { value: 'America/Chicago', name: 'Central (Chicago)', short: 'Chicago' },
  { value: 'America/Denver', name: 'Mountain (Denver)', short: 'Denver' },
  { value: 'America/Los_Angeles', name: 'Pacific (Los Angeles)', short: 'Los Angeles' },
  { value: 'Europe/London', name: 'London', short: 'London' },
  { value: 'Europe/Berlin', name: 'Berlin', short: 'Berlin' },
  { value: 'Asia/Hong_Kong', name: 'Hong Kong', short: 'Hong Kong' },
  { value: 'Asia/Taipei', name: 'Taipei', short: 'Taipei' },
  { value: 'Asia/Shanghai', name: 'Shanghai', short: 'Shanghai' },
  { value: 'Asia/Singapore', name: 'Singapore', short: 'Singapore' },
  { value: 'Asia/Tokyo', name: 'Tokyo', short: 'Tokyo' },
  { value: 'UTC', name: 'UTC', short: 'UTC' },
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

/**
 * Light / dark / follow-iOS. `system` is the default and the only value that
 * tracks the device — the other two pin the app regardless of what iOS is
 * doing, which is the whole point of offering the control (web's ModeToggle
 * has the same three).
 */
export type AppearancePref = 'system' | 'light' | 'dark';

export const APPEARANCE_DEFAULT: AppearancePref = 'system';

/** Which timestamp attributes a trade to a calendar day / date filter. */
export type TradeDateBasis = 'close' | 'open';

export const TRADE_DATE_BASIS_DEFAULT: TradeDateBasis = 'close';

export const PRIVACY_MASK = '••••';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export type DisplayPrefs = {
  /** Light / dark / follow-iOS. */
  appearance: AppearancePref;
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
};

const DEFAULTS: DisplayPrefs = {
  appearance: APPEARANCE_DEFAULT,
  privacyMode: false,
  displayCurrency: null,
  timezone: TIMEZONE_DEFAULT,
  marketTimezone: MARKET_TIMEZONE_DEFAULT,
  timeFormat: TIME_FORMAT_DEFAULT,
  tradeDateBasis: TRADE_DATE_BASIS_DEFAULT,
};

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
function isAppearance(value: unknown): value is AppearancePref {
  return value === 'system' || value === 'light' || value === 'dark';
}

function sanitize(raw: unknown): DisplayPrefs {
  if (typeof raw !== 'object' || raw == null) return DEFAULTS;
  const r = raw as Record<string, unknown>;
  return {
    appearance: isAppearance(r.appearance) ? r.appearance : DEFAULTS.appearance,
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
  };
}

migrateLegacyPrefs();

const useDisplayStore = create<DisplayPrefs>()(
  persist((): DisplayPrefs => DEFAULTS, {
    name: DISPLAY_PERSIST_KEY,
    storage: mmkvStorage<DisplayPrefs>(),
    merge: (persisted) => sanitize(persisted),
  }),
);

function setPrefs(patch: Partial<DisplayPrefs>) {
  useDisplayStore.setState(patch);
}

/** Non-reactive read for formatters — components subscribe via useDisplayPrefs. */
export function getPrefs(): DisplayPrefs {
  return useDisplayStore.getState();
}

/**
 * Subscribe to display prefs. Under React Compiler, call this in the same
 * component that formats money/times — a parent's subscription does not
 * re-render memoized children.
 */
export function useDisplayPrefs(): DisplayPrefs {
  return useDisplayStore();
}

/**
 * Push the pref into Unistyles. `adaptiveThemes` is what makes the app follow
 * iOS, so a pinned scheme has to switch it off first — with it on, `setTheme`
 * is overridden the next time the system scheme is read.
 */
function applyAppearanceToRuntime(pref: AppearancePref) {
  // Each call is guarded on the current runtime value. Re-asserting a setting
  // Unistyles already holds re-applies the default theme rather than being a
  // no-op, which flashes the app light on every module re-evaluation — and
  // this runs at module scope, so that is every Fast Refresh.
  if (pref === 'system') {
    if (!UnistylesRuntime.hasAdaptiveThemes) UnistylesRuntime.setAdaptiveThemes(true);
    return;
  }
  if (UnistylesRuntime.hasAdaptiveThemes) UnistylesRuntime.setAdaptiveThemes(false);
  if (UnistylesRuntime.themeName !== pref) UnistylesRuntime.setTheme(pref);
}

// The stored pref only reaches Unistyles when something applies it, and the
// store is created above with whatever was persisted — so apply once on load.
applyAppearanceToRuntime(useDisplayStore.getState().appearance);

export function setAppearance(pref: AppearancePref) {
  setPrefs({ appearance: isAppearance(pref) ? pref : APPEARANCE_DEFAULT });
  applyAppearanceToRuntime(pref);
}

/**
 * The scheme actually being rendered. SwiftUI views are native and don't read
 * Unistyles, so every `Host` has to be told this explicitly — see
 * `components/app-host.tsx`. Subscribes to both the pref and the system scheme
 * because either can move it.
 */
/**
 * The scheme actually being painted, for the SwiftUI `Host`s (see
 * `components/app-host.tsx`).
 *
 * Reads Unistyles' live theme, deliberately — not the pref and not RN's
 * `useColorScheme`. Those are three separate signals: the pref is intent,
 * `useColorScheme` is the device, and Unistyles is what the RN surfaces are
 * *currently* painted with. Driving SwiftUI from either of the first two lets
 * it disagree with the background it sits on, and the result isn't subtle —
 * dark-scheme section headers land on a light background as unreadable grey.
 * Reading the applied theme makes divergence impossible by construction.
 */
export function useResolvedScheme(): 'light' | 'dark' {
  const { rt } = useUnistyles();
  return rt.themeName === 'dark' ? 'dark' : 'light';
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

/**
 * Back to the shipped defaults — the escape hatch from the Display screen.
 * Every key here is a formatting pref, so the reset can take the whole store:
 * the screenshots cap lives in `journal-prefs.ts` and is out of reach.
 */
export function resetDisplayPrefs() {
  setPrefs(DEFAULTS);
  applyAppearanceToRuntime(DEFAULTS.appearance);
}

/**
 * Pick the valid prefs out of a hand-written or cross-platform blob (an
 * app-config file). Unlike `sanitize`, absent keys are *omitted* rather than
 * defaulted — a web export only carries three of these fields, and defaulting
 * the rest would silently reset the phone's currency and market timezone.
 */
export function parseDisplayPrefsPatch(raw: unknown): Partial<DisplayPrefs> {
  if (typeof raw !== 'object' || raw == null) return {};
  const r = raw as Record<string, unknown>;
  const patch: Partial<DisplayPrefs> = {};
  if (isAppearance(r.appearance)) patch.appearance = r.appearance;
  if (typeof r.privacyMode === 'boolean') patch.privacyMode = r.privacyMode;
  if (r.displayCurrency === null || isDisplayCurrencyCode(r.displayCurrency)) {
    patch.displayCurrency = r.displayCurrency as DisplayCurrencyOverride;
  }
  if (isTimezonePref(r.timezone)) patch.timezone = r.timezone;
  if (isMarketTimezonePref(r.marketTimezone)) patch.marketTimezone = r.marketTimezone;
  if (r.timeFormat === 'h12' || r.timeFormat === 'h23') patch.timeFormat = r.timeFormat;
  if (r.tradeDateBasis === 'close' || r.tradeDateBasis === 'open') {
    patch.tradeDateBasis = r.tradeDateBasis;
  }
  return patch;
}

/** Apply a validated patch (app-config import). */
export function applyDisplayPrefs(patch: Partial<DisplayPrefs>) {
  if (Object.keys(patch).length === 0) return;
  setPrefs(patch);
  // Storing `appearance` doesn't repaint anything on its own — Unistyles has
  // to be told, exactly as `setAppearance` does.
  if (patch.appearance != null) applyAppearanceToRuntime(patch.appearance);
}

/** True when every pref still matches its default (hides the reset row). */
export function isDefaultDisplayPrefs(prefs: DisplayPrefs = getPrefs()): boolean {
  return (Object.keys(DEFAULTS) as (keyof DisplayPrefs)[]).every(
    (key) => prefs[key] === DEFAULTS[key],
  );
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
 * Zone offsets are derived arithmetically — one instant read on two clocks —
 * rather than from `timeZoneName: 'longOffset'`. Hermes' Foundation-backed Intl
 * mislabels non-numeric `formatToParts` entries (the weekday-as-literal quirk),
 * so the offset lookup silently fell through to its `GMT` fallback and every
 * zone in the settings pickers rendered as `UTC+00`.
 */

/** First number in a formatted field (`"08"`, `"08 PM"`, `":15"` → 8, 8, 15). */
function firstNumber(value: string): number | null {
  const digits = value.match(/\d+/);
  return digits ? Number(digits[0]) : null;
}

/** Hour options this engine honours, probed once against a known UTC instant. */
let hourOptions: Intl.DateTimeFormatOptions | null | undefined;

function resolveHourOptions(): Intl.DateTimeFormatOptions | null {
  if (hourOptions !== undefined) return hourOptions;
  // 13:00Z reads "13" on a 24-hour clock and "01" on a 12-hour one, so the
  // probe rejects any option set the engine quietly downgrades.
  const probe = new Date(Date.UTC(2026, 0, 1, 13, 0, 0));
  const candidates: Intl.DateTimeFormatOptions[] = [
    { hour: '2-digit', hourCycle: 'h23' },
    { hour: '2-digit', hour12: false },
    { hour: 'numeric', hour12: false },
  ];
  hourOptions =
    candidates.find((options) => {
      try {
        const formatted = new Intl.DateTimeFormat('en-US', {
          timeZone: 'UTC',
          ...options,
        }).format(probe);
        return firstNumber(formatted) === 13;
      } catch {
        return false;
      }
    }) ?? null;
  return hourOptions;
}

/** Minutes past midnight for `at` on the given zone's clock. */
function zoneClockMinutes(timeZone: string, at: Date): number | null {
  const options = resolveHourOptions();
  if (!options) return null;
  try {
    const hour = firstNumber(
      new Intl.DateTimeFormat('en-US', { timeZone, ...options }).format(at),
    );
    const minute = firstNumber(
      new Intl.DateTimeFormat('en-US', { timeZone, minute: '2-digit' }).format(at),
    );
    if (hour == null || minute == null || hour > 23 || minute > 59) return null;
    return hour * 60 + minute;
  } catch {
    return null;
  }
}

/**
 * Current offset from UTC in minutes (`-240` for New York in summer), or `null`
 * when the engine can't report the zone's clock. DST-aware for that instant.
 * Wrapped into ±12h, which covers every zone the app offers (Tokyo +9 … LA -8).
 */
export function zoneOffsetMinutes(timeZone: string, at: Date = new Date()): number | null {
  const zoneMinutes = zoneClockMinutes(timeZone, at);
  if (zoneMinutes == null) return null;
  let diff = (zoneMinutes - (at.getUTCHours() * 60 + at.getUTCMinutes())) % 1440;
  if (diff > 720) diff -= 1440;
  if (diff <= -720) diff += 1440;
  return diff;
}

/**
 * Format the current offset for an IANA zone as `UTC+08` / `UTC-05` / `UTC+05:30`.
 * DST-aware for the given instant; empty when the offset can't be determined —
 * callers drop the prefix rather than print a wrong one.
 */
export function formatUtcOffsetPrefix(timeZone: string, at: Date = new Date()): string {
  const minutes = zoneOffsetMinutes(timeZone, at);
  if (minutes == null) return '';
  const abs = Math.abs(minutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const mins = abs % 60;
  const sign = minutes < 0 ? '-' : '+';
  return mins === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${String(mins).padStart(2, '0')}`;
}

/** RFC3339 offset suffix (`"+08:00"`, `"Z"`) for a zone at a given instant. */
export function rfc3339OffsetSuffix(timeZone: string, at: Date = new Date()): string {
  const minutes = zoneOffsetMinutes(timeZone, at);
  if (!minutes) return 'Z';
  const abs = Math.abs(minutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const mins = String(abs % 60).padStart(2, '0');
  return `${minutes < 0 ? '-' : '+'}${hours}:${mins}`;
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

/**
 * Timezone options for the settings pickers, as `Tokyo · UTC+09` — place first,
 * offset second, because the place is what a trader picks by. The offset is
 * dropped rather than guessed if the engine can't report it.
 */
export function timezoneOptions(
  at: Date = new Date(),
): { value: TimezonePref; label: string }[] {
  return TIMEZONE_CHOICES.map(({ value, short }) => {
    if (value === 'UTC') return { value, label: 'UTC+00' };
    const iana = value === TIMEZONE_LOCAL ? resolveDisplayTimezone(TIMEZONE_LOCAL) : value;
    const offset = formatUtcOffsetPrefix(iana, at);
    return { value, label: offset ? `${short} · ${offset}` : short };
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
