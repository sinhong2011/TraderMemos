/**
 * TanStack Query hooks over the TraderMemos API.
 *
 * Every hook is gated on an active session, so screens can render without null-checking
 * the session themselves — the root layout already redirects unauthenticated users.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { request, type QueryParams } from './client';
import { useSession } from './session';
import type {
  Account,
  AnnualGoal,
  BreakGroup,
  DailyPnl,
  EquityCurve,
  Filters,
  Summary,
  Trade,
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
  annualGoal: (year: number) => ['settings', 'annual-goal', year] as const,
};

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

export function useTrades(filters: Filters = {}) {
  return useApiQuery<Trade[]>(queryKeys.trades(filters), '/trades', filters);
}

export function useTrade(id: string) {
  return useApiQuery<Trade>(queryKeys.trade(id), `/trades/${id}`);
}

export function useAccounts() {
  return useApiQuery<Account[]>(queryKeys.accounts(), '/accounts');
}
