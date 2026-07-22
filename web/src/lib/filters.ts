import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useDisplayPrefs } from "./displayPrefs";
import type { TradeStatusFilter } from "./tradeFilters";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** API filter dates must be RFC3339; accept legacy YYYY-MM-DD from the picker. */
export function normalizeFilterDate(
  v: string | undefined,
  bound: "start" | "end",
): string | undefined {
  if (!v) return undefined;
  if (DATE_ONLY.test(v)) {
    return bound === "start" ? `${v}T00:00:00Z` : `${v}T23:59:59Z`;
  }
  return v;
}

export function filterDatePart(iso?: string): string | undefined {
  if (!iso) return undefined;
  return iso.slice(0, 10);
}

interface FilterState {
  accountId?: string;
  from?: string;
  to?: string;
  symbol?: string;
  tradeStatus?: TradeStatusFilter;
  /** Multi-select tag ids — trade matches if it has any selected tag. */
  tagIds?: string[];
  /** Multi-select instrument types — trade matches if type is selected. */
  markets?: string[];
  setAccount: (id?: string) => void;
  setRange: (from?: string, to?: string) => void;
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

export const useFilters = create<FilterState>((set, get) => ({
  setAccount: (accountId) => set({ accountId }),
  setRange: (from, to) => set({ from, to }),
  setSymbol: (symbol) => set({ symbol }),
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
      symbol: undefined,
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
      symbol: s.symbol,
    };
  },
}));

// useFilterParams returns the shared filter query params with a SHALLOW-stable
// reference. Selecting `s.toParams()` directly returns a fresh object every
// render, which under Zustand v5's Object.is comparison causes an infinite
// render loop. useShallow fixes that by comparing the object's keys.
export function useFilterParams() {
  const tradeDateBasis = useDisplayPrefs((s) => s.tradeDateBasis);
  return useFilters(
    useShallow((s) => ({
      account_id: s.accountId,
      from: normalizeFilterDate(s.from, "start"),
      to: normalizeFilterDate(s.to, "end"),
      symbol: s.symbol,
      date_basis: tradeDateBasis,
    })),
  );
}
