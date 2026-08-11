import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReportsDuration, ReportsSide } from "@/components/ReportsControlBar";
import type { AvgMode, PnlMode, UnitMode } from "@/components/ReportsDisplayContext";
import { preferencesApi, type PreferencesResponse } from "@/lib/api/preferences";
import { computePresetRange, presetFromRange, type DateRangePreset } from "./dateRangePresets";
import { preferencesQueryKey } from "./prefsSync";
import { REPORT_TAB_IDS, sanitizeCardIds, type ReportsTab } from "./reportCards";
import type { ReportsCardLayout } from "./reportsView";
import type { TradeStatusFilter } from "./tradeFilters";

/** The URL-search slice of the Reports view a preset captures. */
export interface ReportsSearchState {
  tab: ReportsTab;
  side: ReportsSide;
  dur: ReportsDuration;
  pnl: PnlMode;
  unit: UnitMode;
  avg: AvgMode;
}

/** The filters-store slice a preset captures. */
export interface ReportsFilterState {
  from?: string;
  to?: string;
  symbols?: string[];
  tagIds?: string[];
  markets?: string[];
  tradeStatus?: TradeStatusFilter;
}

export interface ReportsViewPreset extends ReportsSearchState {
  id: string;
  name: string;
  /** A named range key ("7d", "mtd", …) stays relative — "Morning review"
   *  saved in July still means "last 7 days" in August. A custom range pins
   *  its literal dates. */
  range: DateRangePreset | { from?: string; to?: string };
  symbols?: string[];
  tagIds?: string[];
  markets?: string[];
  tradeStatus?: TradeStatusFilter;
  /** Ordered visible cards per tab; a missing tab means the default set. */
  cards?: ReportsCardLayout;
}

/** Single key inside the user_preferences blob (16 KiB server cap → one key,
 *  bounded count, bounded names — not one key per preset). */
export const PRESETS_PREF_KEY = "reportsViewPresets";
export const MAX_PRESETS = 20;
export const MAX_PRESET_NAME_LENGTH = 60;

const SIDE_VALUES: ReportsSide[] = ["all", "long", "short"];
const DUR_VALUES: ReportsDuration[] = ["all", "scalp", "day", "swing"];
const PNL_VALUES: PnlMode[] = ["net", "gross"];
const UNIT_VALUES: UnitMode[] = ["abs", "pct"];
const AVG_VALUES: AvgMode[] = ["mean", "median"];
const RANGE_KEYS: DateRangePreset[] = ["7d", "30d", "90d", "mtd", "ytd", "all"];
const STATUS_VALUES: TradeStatusFilter[] = ["win", "loss", "open", "wash"];

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((v): v is string => typeof v === "string");
  return out.length > 0 ? out : undefined;
}

function parseRange(value: unknown): ReportsViewPreset["range"] {
  if (typeof value === "string") return oneOf(value, RANGE_KEYS, "all");
  if (value && typeof value === "object") {
    const { from, to } = value as { from?: unknown; to?: unknown };
    return {
      from: typeof from === "string" ? from : undefined,
      to: typeof to === "string" ? to : undefined,
    };
  }
  return "all";
}

function parseCards(value: unknown): ReportsCardLayout | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: ReportsCardLayout = {};
  for (const tab of REPORT_TAB_IDS) {
    const ids = (value as Record<string, unknown>)[tab];
    if (Array.isArray(ids)) out[tab] = sanitizeCardIds(tab, ids);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parsePreset(raw: unknown): ReportsViewPreset | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id === "") return null;
  if (typeof r.name !== "string" || r.name.trim() === "") return null;
  const preset: ReportsViewPreset = {
    id: r.id,
    name: r.name.trim().slice(0, MAX_PRESET_NAME_LENGTH),
    tab: oneOf(r.tab, REPORT_TAB_IDS, "overview"),
    side: oneOf(r.side, SIDE_VALUES, "all"),
    dur: oneOf(r.dur, DUR_VALUES, "all"),
    pnl: oneOf(r.pnl, PNL_VALUES, "net"),
    unit: oneOf(r.unit, UNIT_VALUES, "abs"),
    avg: oneOf(r.avg, AVG_VALUES, "mean"),
    range: parseRange(r.range),
  };
  const symbols = stringArray(r.symbols);
  if (symbols) preset.symbols = symbols;
  const tagIds = stringArray(r.tagIds);
  if (tagIds) preset.tagIds = tagIds;
  const markets = stringArray(r.markets);
  if (markets) preset.markets = markets;
  if (STATUS_VALUES.includes(r.tradeStatus as TradeStatusFilter)) {
    preset.tradeStatus = r.tradeStatus as TradeStatusFilter;
  }
  const cards = parseCards(r.cards);
  if (cards) preset.cards = cards;
  return preset;
}

/** Defensive parse of the stored blob value — the server stores whatever any
 *  client sent it, so every field is validated and bad entries are dropped. */
export function parseReportsPresets(raw: unknown): ReportsViewPreset[] {
  if (!Array.isArray(raw)) return [];
  const out: ReportsViewPreset[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const preset = parsePreset(item);
    if (!preset || seen.has(preset.id)) continue;
    seen.add(preset.id);
    out.push(preset);
    if (out.length >= MAX_PRESETS) break;
  }
  return out;
}

/** Snapshot the current Reports view as a preset. */
export function captureReportsPreset(input: {
  name: string;
  search: ReportsSearchState;
  filters: ReportsFilterState;
  cards: ReportsCardLayout;
  id?: string;
}): ReportsViewPreset {
  const { name, search, filters, cards } = input;
  const rangeKey = presetFromRange(filters.from, filters.to);
  const preset: ReportsViewPreset = {
    id: input.id ?? crypto.randomUUID(),
    name: name.trim().slice(0, MAX_PRESET_NAME_LENGTH),
    ...search,
    range: rangeKey === "custom" ? { from: filters.from, to: filters.to } : rangeKey,
  };
  if (filters.symbols?.length) preset.symbols = filters.symbols;
  if (filters.tagIds?.length) preset.tagIds = filters.tagIds;
  if (filters.markets?.length) preset.markets = filters.markets;
  if (filters.tradeStatus) preset.tradeStatus = filters.tradeStatus;
  if (Object.keys(cards).length > 0) preset.cards = cards;
  return preset;
}

/** Turn a stored range back into filter bounds (relative keys re-anchor to today). */
export function resolvePresetRange(range: ReportsViewPreset["range"]): {
  from?: string;
  to?: string;
} {
  if (typeof range === "string") {
    return range === "custom" ? {} : computePresetRange(range);
  }
  return { from: range.from, to: range.to };
}

/**
 * Saved presets, read off the shared preferences query (same key usePrefsSync
 * pulls, so this costs no extra request once the shell has mounted).
 */
export function useReportsPresets(): { presets: ReportsViewPreset[]; isLoading: boolean } {
  const q = useQuery({
    queryKey: preferencesQueryKey,
    queryFn: () => preferencesApi.get(),
  });
  return {
    presets: parseReportsPresets(q.data?.prefs?.[PRESETS_PREF_KEY]),
    isLoading: q.isLoading,
  };
}

/**
 * Replace the whole preset list. Presets are written on explicit user actions
 * (save / update / delete), so this patches the server directly rather than
 * riding the debounced prefs auto-push — whose `!==` diffing would re-send a
 * fresh array object on every check anyway.
 */
export function useSaveReportsPresets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (presets: ReportsViewPreset[]) =>
      preferencesApi.patch({ [PRESETS_PREF_KEY]: presets }),
    onSuccess: (res: PreferencesResponse) => {
      queryClient.setQueryData(preferencesQueryKey, res);
    },
  });
}
