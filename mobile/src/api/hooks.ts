/**
 * TanStack Query hooks over the TraderMemos API.
 *
 * Every hook is gated on an active session, so screens can render without null-checking
 * the session themselves — the root layout already redirects unauthenticated users.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';

import { request, requestRaw, type QueryParams, type RequestOptions } from './client';
import { useSession } from './session';
import type {
  AccessToken,
  Account,
  AnnualGoal,
  ApiHealth,
  BreakGroup,
  DailyPnl,
  EquityCurve,
  Filters,
  RiskRules,
  Summary,
  BarInterval,
  CashTransaction,
  ChecklistTemplate,
  LlmApiSettings,
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
  cash: (filters: Filters) => ['cash', filters] as const,
  checklistTemplate: () => ['settings', 'checklist-template'] as const,
  llmSettings: (kind: LlmKind) => ['settings', kind] as const,
  accessTokens: () => ['access-tokens'] as const,
  health: () => ['health'] as const,
};

/** The two LLM integrations share one settings shape and endpoint family. */
export type LlmKind = 'ocr' | 'coach';

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

/**
 * Session-bound raw request (returns the `Response`) — for multipart uploads
 * and downloads that need response headers (import preview/commit, exports).
 */
export function useApiRaw() {
  const { session, signIn } = useSession();
  return useCallback(
    (path: string, options?: RequestOptions) =>
      requestRaw(session!, path, options, (tokens) => {
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

export function useLlmSettings(kind: LlmKind) {
  return useApiQuery<LlmApiSettings>(queryKeys.llmSettings(kind), `/settings/${kind}`);
}

export function useAccessTokens() {
  return useApiQuery<AccessToken[]>(queryKeys.accessTokens(), '/access-tokens');
}

/**
 * Unauthenticated server probe — /healthz lives at the server root, outside
 * /api/v1, so it bypasses the session-bound `request` plumbing.
 */
export function useApiHealth() {
  const { session } = useSession();
  const serverUrl = session?.serverUrl;
  return useQuery({
    queryKey: queryKeys.health(),
    enabled: serverUrl != null,
    staleTime: 60_000,
    queryFn: async (): Promise<ApiHealth> => {
      const response = await fetch(new URL('/healthz', serverUrl).toString());
      if (!response.ok) throw new Error(`Health check failed (${response.status})`);
      return (await response.json()) as ApiHealth;
    },
  });
}

export function useCash(filters: Filters = {}) {
  return useApiQuery<CashTransaction[]>(queryKeys.cash(filters), '/cash-transactions', filters);
}

export function useChecklistTemplate() {
  return useApiQuery<ChecklistTemplate>(
    queryKeys.checklistTemplate(),
    '/settings/checklist-template',
  );
}
