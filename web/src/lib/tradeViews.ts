import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { preferencesApi, type PreferencesResponse } from "@/lib/api/preferences";
import { presetFromRange, type DateRangePreset } from "./dateRangePresets";
import { preferencesQueryKey } from "./prefsSync";
import { MAX_PRESET_NAME_LENGTH, MAX_PRESETS, resolvePresetRange } from "./reportsPresets";
import type { SortingState, VisibilityState } from "./table";
import type { TradeStatusFilter } from "./tradeFilters";

export { MAX_PRESET_NAME_LENGTH as MAX_VIEW_NAME_LENGTH, MAX_PRESETS as MAX_VIEWS };

/** Everything on the Trades page a saved view restores. */
export interface TradesViewState {
  from?: string;
  to?: string;
  symbols?: string[];
  tagIds?: string[];
  markets?: string[];
  tradeStatus?: TradeStatusFilter;
  sorting: SortingState;
  columnVisibility: VisibilityState;
}

export interface TradesSavedView {
  id: string;
  name: string;
  /** Named range keys stay relative ("last 30 days" re-anchors to today);
   *  a custom range pins its literal dates — same rule as Reports presets. */
  range: DateRangePreset | { from?: string; to?: string };
  symbols?: string[];
  tagIds?: string[];
  markets?: string[];
  tradeStatus?: TradeStatusFilter;
  sorting?: SortingState;
  /** Column ids the view hides. */
  hidden?: string[];
}

/** One key inside the user_preferences blob (16 KiB server cap), separate from
 *  `reportsViewPresets` because the two pages capture different state. */
export const TRADES_VIEWS_PREF_KEY = "tradesSavedViews";

const RANGE_KEYS: DateRangePreset[] = ["7d", "30d", "90d", "mtd", "ytd", "all"];
const STATUS_VALUES: TradeStatusFilter[] = ["win", "loss", "open", "wash"];

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((v): v is string => typeof v === "string" && v !== "");
  return out.length > 0 ? out : undefined;
}

function parseRange(value: unknown): TradesSavedView["range"] {
  if (typeof value === "string") {
    return RANGE_KEYS.includes(value as DateRangePreset) ? (value as DateRangePreset) : "all";
  }
  if (value && typeof value === "object") {
    const { from, to } = value as { from?: unknown; to?: unknown };
    return {
      from: typeof from === "string" ? from : undefined,
      to: typeof to === "string" ? to : undefined,
    };
  }
  return "all";
}

function parseSorting(value: unknown): SortingState | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: SortingState = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { id, desc } = item as { id?: unknown; desc?: unknown };
    if (typeof id === "string" && id !== "") out.push({ id, desc: desc === true });
  }
  return out.length > 0 ? out : undefined;
}

function parseView(raw: unknown): TradesSavedView | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id === "") return null;
  if (typeof r.name !== "string" || r.name.trim() === "") return null;
  const view: TradesSavedView = {
    id: r.id,
    name: r.name.trim().slice(0, MAX_PRESET_NAME_LENGTH),
    range: parseRange(r.range),
  };
  const symbols = stringArray(r.symbols);
  if (symbols) view.symbols = symbols;
  const tagIds = stringArray(r.tagIds);
  if (tagIds) view.tagIds = tagIds;
  const markets = stringArray(r.markets);
  if (markets) view.markets = markets;
  if (STATUS_VALUES.includes(r.tradeStatus as TradeStatusFilter)) {
    view.tradeStatus = r.tradeStatus as TradeStatusFilter;
  }
  const sorting = parseSorting(r.sorting);
  if (sorting) view.sorting = sorting;
  const hidden = stringArray(r.hidden);
  if (hidden) view.hidden = hidden;
  return view;
}

/** Defensive parse of the stored blob value: every field is validated and bad
 *  entries dropped, since the server keeps whatever any client sent. */
export function parseTradesViews(raw: unknown): TradesSavedView[] {
  if (!Array.isArray(raw)) return [];
  const out: TradesSavedView[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const view = parseView(item);
    if (!view || seen.has(view.id)) continue;
    seen.add(view.id);
    out.push(view);
    if (out.length >= MAX_PRESETS) break;
  }
  return out;
}

function sortedCopy(values?: string[]): string[] | undefined {
  return values?.length ? [...values].sort() : undefined;
}

/** Snapshot the current Trades page as a saved view. */
export function captureTradesView(input: {
  name: string;
  state: TradesViewState;
  id?: string;
}): TradesSavedView {
  const { state } = input;
  const rangeKey = presetFromRange(state.from, state.to);
  const view: TradesSavedView = {
    id: input.id ?? crypto.randomUUID(),
    name: input.name.trim().slice(0, MAX_PRESET_NAME_LENGTH),
    range: rangeKey === "custom" ? { from: state.from, to: state.to } : rangeKey,
  };
  const symbols = sortedCopy(state.symbols);
  if (symbols) view.symbols = symbols;
  const tagIds = sortedCopy(state.tagIds);
  if (tagIds) view.tagIds = tagIds;
  const markets = sortedCopy(state.markets);
  if (markets) view.markets = markets;
  if (state.tradeStatus) view.tradeStatus = state.tradeStatus;
  if (state.sorting.length > 0) view.sorting = state.sorting.map(({ id, desc }) => ({ id, desc }));
  const hidden = Object.entries(state.columnVisibility)
    .filter(([, visible]) => visible === false)
    .map(([id]) => id)
    .sort();
  if (hidden.length > 0) view.hidden = hidden;
  return view;
}

/** The page state a saved view restores (relative ranges re-anchor to today). */
export function resolveTradesView(view: TradesSavedView): TradesViewState {
  const { from, to } = resolvePresetRange(view.range);
  return {
    from,
    to,
    symbols: view.symbols,
    tagIds: view.tagIds,
    markets: view.markets,
    tradeStatus: view.tradeStatus,
    sorting: view.sorting ?? [],
    columnVisibility: Object.fromEntries((view.hidden ?? []).map((id) => [id, false])),
  };
}

function viewKey(view: TradesSavedView): string {
  return JSON.stringify([
    view.range,
    view.symbols ?? null,
    view.tagIds ?? null,
    view.markets ?? null,
    view.tradeStatus ?? null,
    view.sorting ?? null,
    view.hidden ?? null,
  ]);
}

/**
 * Whether the page currently shows exactly what `view` restores. Comparing
 * captures — rather than remembering "last applied" — keeps the menu honest
 * when a filter is changed by hand after applying: the check mark drops.
 */
export function viewMatches(view: TradesSavedView, state: TradesViewState): boolean {
  const current = captureTradesView({ name: view.name, id: view.id, state });
  return viewKey(current) === viewKey(view);
}

/** Session-only memory of the view last applied, so "Update" knows its target
 *  after the page has drifted from it. Not persisted: a reload starts clean. */
export const useTradesViewSession = create<{
  lastAppliedId?: string;
  setLastApplied: (id?: string) => void;
}>()((set) => ({
  lastAppliedId: undefined,
  setLastApplied: (lastAppliedId) => set({ lastAppliedId }),
}));

/** Saved views off the shared preferences query (same key usePrefsSync pulls). */
export function useTradesViews(): { views: TradesSavedView[]; isLoading: boolean } {
  const q = useQuery({
    queryKey: preferencesQueryKey,
    queryFn: () => preferencesApi.get(),
  });
  return {
    views: parseTradesViews(q.data?.prefs?.[TRADES_VIEWS_PREF_KEY]),
    isLoading: q.isLoading,
  };
}

/** Replace the whole list — written on explicit actions, patched directly. */
export function useSaveTradesViews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (views: TradesSavedView[]) =>
      preferencesApi.patch({ [TRADES_VIEWS_PREF_KEY]: views }),
    onSuccess: (res: PreferencesResponse) => {
      queryClient.setQueryData(preferencesQueryKey, res);
    },
  });
}
