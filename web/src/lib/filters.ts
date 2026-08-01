import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { persist } from "zustand/middleware";
import { resolveDisplayTimezone, rfc3339OffsetSuffix, useDisplayPrefs } from "./displayPrefs";
import type { TradeStatusFilter } from "./tradeFilters";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const FILTERS_STORAGE_KEY = "tm_filters";

/** Resolved IANA display timezone from the current prefs. */
export function displayTz(): string {
  return resolveDisplayTimezone(useDisplayPrefs.getState().timezone);
}

/**
 * API filter dates must be RFC3339; accept legacy YYYY-MM-DD from the picker.
 * Day boundaries are built in the display timezone (pass `tz` as a resolved
 * IANA name to override) so "June 1" means the trader's June 1, not UTC's.
 */
export function normalizeFilterDate(
  v: string | undefined,
  bound: "start" | "end",
  tz?: string,
): string | undefined {
  if (!v) return undefined;
  if (DATE_ONLY.test(v)) {
    // Offset in effect around midday of that date (DST transitions run at night).
    const offset = rfc3339OffsetSuffix(tz ?? displayTz(), new Date(`${v}T12:00:00Z`));
    return bound === "start" ? `${v}T00:00:00${offset}` : `${v}T23:59:59${offset}`;
  }
  return v;
}

export function filterDatePart(iso?: string): string | undefined {
  if (!iso) return undefined;
  return iso.slice(0, 10);
}

/** Serialize selected symbols for the API `symbol` query param (comma-separated OR). */
export function symbolsToParam(symbols?: string[]): string | undefined {
  if (!symbols?.length) return undefined;
  return symbols.join(",");
}

interface FilterState {
  accountId?: string;
  from?: string;
  to?: string;
  /** Multi-select symbols — trade matches if its symbol is selected (OR). */
  symbols?: string[];
  tradeStatus?: TradeStatusFilter;
  /** Multi-select tag ids — trade matches if it has any selected tag. */
  tagIds?: string[];
  /** Multi-select instrument types — trade matches if type is selected. */
  markets?: string[];
  setAccount: (id?: string) => void;
  setRange: (from?: string, to?: string) => void;
  setSymbols: (symbols?: string[]) => void;
  /** Convenience: set a single symbol filter (or clear). */
  setSymbol: (s?: string) => void;
  setTradeStatus: (s?: TradeStatusFilter) => void;
  toggleTradeStatus: (s: TradeStatusFilter) => void;
  setTagIds: (ids?: string[]) => void;
  setMarkets: (markets?: string[]) => void;
  reset: () => void;
  toParams: () => {
    account_id?: string;
    from?: string;
    to?: string;
    symbol?: string;
  };
}

export const useFilters = create<FilterState>()(
  persist(
    (set, get) => ({
      setAccount: (accountId) => set({ accountId }),
      setRange: (from, to) => set({ from, to }),
      setSymbols: (symbols) => set({ symbols: symbols?.length ? symbols : undefined }),
      setSymbol: (symbol) => set({ symbols: symbol ? [symbol] : undefined }),
      setTradeStatus: (tradeStatus) => set({ tradeStatus }),
      toggleTradeStatus: (tradeStatus) =>
        set((s) => ({
          tradeStatus: s.tradeStatus === tradeStatus ? undefined : tradeStatus,
        })),
      setTagIds: (tagIds) => set({ tagIds: tagIds?.length ? tagIds : undefined }),
      setMarkets: (markets) => set({ markets: markets?.length ? markets : undefined }),
      reset: () =>
        set({
          accountId: undefined,
          from: undefined,
          to: undefined,
          symbols: undefined,
          tradeStatus: undefined,
          tagIds: undefined,
          markets: undefined,
        }),
      toParams: () => {
        const s = get();
        return {
          account_id: s.accountId,
          from: s.from,
          to: s.to,
          symbol: symbolsToParam(s.symbols),
        };
      },
    }),
    {
      name: FILTERS_STORAGE_KEY,
      // Persist only the account selection so refresh keeps scope
      // without unexpectedly carrying over date/symbol/search filters.
      partialize: (s) => ({ accountId: s.accountId }),
    },
  ),
);

// useFilterParams returns the shared filter query params with a SHALLOW-stable
// reference. Selecting `s.toParams()` directly returns a fresh object every
// render, which under Zustand v5's Object.is comparison causes an infinite
// render loop. useShallow fixes that by comparing the object's keys.
export function useFilterParams() {
  const tradeDateBasis = useDisplayPrefs((s) => s.tradeDateBasis);
  const timezonePref = useDisplayPrefs((s) => s.timezone);
  const tz = resolveDisplayTimezone(timezonePref);
  return useFilters(
    useShallow((s) => ({
      account_id: s.accountId,
      from: normalizeFilterDate(s.from, "start", tz),
      to: normalizeFilterDate(s.to, "end", tz),
      symbol: symbolsToParam(s.symbols),
      date_basis: tradeDateBasis,
      tz,
    })),
  );
}
