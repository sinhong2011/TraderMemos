/**
 * TanStack Query hooks over the TraderMemos API.
 *
 * Every hook is gated on an active session, so screens can render without null-checking
 * the session themselves — the root layout already redirects unauthenticated users.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';

import { request, type QueryParams, type RequestOptions } from './client';
import { useSession } from './session';
import type {
  Account,
  AnnualGoal,
  BreakGroup,
  DailyPnl,
  EquityCurve,
  Filters,
  RiskRules,
  Summary,
  BarInterval,
  MarketBarsResponse,
  Setup,
  Tag,
  Trade,
  TradeDetail,
} from './types';

/** The breakdown dimensions the dashboard offers (the API accepts more). */
export type BreakdownDim = 'day_of_week' | 'setup' | 'symbol';

export const queryKeys = {
  summary: (filters: Filters) => ['analytics', 'summary', filters] as const,
  equityCurve: (filters: Filters) => ['analytics', 'equity-curve', filters] as const,
  daily: (filters: Filters) => ['analytics', 'daily', filters] as const,
  breakdown: (by: BreakdownDim, filters: Filters) =>
    ['analytics', 'breakdown', by, filters] as const,
  trades: (filters: Filters) => ['trades', filters] as const,
  trade: (id: string) => ['trades', id] as const,
  accounts: () => ['accounts'] as const,
  setups: () => ['setups'] as const,
  tags: () => ['tags'] as const,
  marketBars: (symbol: string, instrumentType: string, interval: string, from: string, to: string) =>
    ['market', 'bars', symbol, instrumentType, interval, from, to] as const,
  annualGoal: (year: number) => ['settings', 'annual-goal', year] as const,
  riskRules: () => ['settings', 'risk-rules'] as const,
};

/**
 * Session-bound request for mutations — same token-rotation plumbing as
 * `useApiQuery`, for use as a TanStack `mutationFn`.
 */
export function useApiRequest() {
  const { session, signIn } = useSession();
  return useCallback(
    <T>(path: string, options?: RequestOptions) =>
      request<T>(session!, path, options, (tokens) => {
        void signIn({
          ...session!,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        });
      }),
    [session, signIn],
  );
}

/** Shared plumbing: binds a request to the current session and adopts rotated tokens. */
function useApiQuery<T>(
  key: readonly unknown[],
  path: string,
  params?: QueryParams,
): UseQueryResult<T> {
  const { session, signIn } = useSession();
  return useQuery({
    queryKey: key,
    enabled: session != null,
    queryFn: () =>
      request<T>(session!, path, { params }, (tokens) => {
        void signIn({
          ...session!,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        });
      }),
  });
}

export function useSummary(filters: Filters = {}) {
  return useApiQuery<Summary>(queryKeys.summary(filters), '/analytics/summary', filters);
}

export function useEquityCurve(filters: Filters = {}) {
  return useApiQuery<EquityCurve>(
    queryKeys.equityCurve(filters),
    '/analytics/equity-curve',
    filters,
  );
}

export function useDaily(filters: Filters = {}) {
  return useApiQuery<DailyPnl>(queryKeys.daily(filters), '/analytics/daily', filters);
}

export function useBreakdown(by: BreakdownDim, filters: Filters = {}) {
  return useApiQuery<BreakGroup[]>(queryKeys.breakdown(by, filters), '/analytics/breakdown', {
    ...filters,
    by,
  });
}

export function useAnnualGoal(year: number) {
  return useApiQuery<AnnualGoal>(queryKeys.annualGoal(year), '/settings/annual-goal', { year });
}

export function useRiskRules() {
  return useApiQuery<RiskRules>(queryKeys.riskRules(), '/settings/risk-rules');
}

export function useTrades(filters: Filters = {}) {
  return useApiQuery<Trade[]>(queryKeys.trades(filters), '/trades', filters);
}

export function useTrade(id: string) {
  return useApiQuery<TradeDetail>(queryKeys.trade(id), `/trades/${id}`);
}

/**
 * OHLC candles for the trade chart, proxied+cached by the Go API (market_handlers.go).
 * `from`/`to` should be minute-snapped ISO strings so the query key stays stable;
 * the server pads the window per interval. Empty symbol disables the query.
 */
export function useMarketBars(params: {
  symbol: string;
  instrumentType: string;
  interval: BarInterval;
  from: string;
  to: string;
}) {
  const { session, signIn } = useSession();
  const { symbol, instrumentType, interval, from, to } = params;
  return useQuery({
    queryKey: queryKeys.marketBars(symbol, instrumentType, interval, from, to),
    enabled: session != null && symbol.trim().length > 0,
    staleTime: 5 * 60_000,
    queryFn: () =>
      request<MarketBarsResponse>(
        session!,
        '/market/bars',
        { params: { symbol, instrument_type: instrumentType, interval, from, to } },
        (tokens) => {
          void signIn({
            ...session!,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          });
        },
      ),
  });
}

export function useSetups() {
  return useApiQuery<Setup[]>(queryKeys.setups(), '/setups');
}

export function useTags() {
  return useApiQuery<Tag[]>(queryKeys.tags(), '/tags');
}

export function useAccounts() {
  return useApiQuery<Account[]>(queryKeys.accounts(), '/accounts');
}
