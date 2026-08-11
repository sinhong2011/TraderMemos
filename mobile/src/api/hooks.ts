/**
 * TanStack Query hooks over the TraderMemos API.
 *
 * Every hook is gated on an active session, so screens can render without null-checking
 * the session themselves — the root layout already redirects unauthenticated users.
 */

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { request, requestRaw, type QueryParams, type RequestOptions } from './client';
import { useSession } from './session';
import type {
  AccessToken,
  AccessTokenUse,
  Account,
  AdminUser,
  AlertSettings,
  AnnualGoal,
  ApiHealth,
  BehaviorReport,
  BreakGroup,
  ComplianceReport,
  DailyPnl,
  EconomicEvent,
  EquityCurve,
  Filters,
  FlexSyncSettings,
  FxRate,
  Note,
  PropStatusResponse,
  RiskRules,
  RSummary,
  Summary,
  SystemInfo,
  BarInterval,
  CashTransaction,
  ChecklistTemplate,
  LlmApiSettings,
  MarketBarsResponse,
  Me,
  PropSettings,
  Setup,
  Tag,
  Trade,
  TradeAttachment,
  TradeDetail,
} from './types';

/** All breakdown dimensions GET /analytics/breakdown accepts (breakdown_handler.go). */
export type BreakdownDim =
  | 'symbol'
  | 'setup'
  | 'day_of_week'
  | 'hour_of_day'
  | 'session'
  | 'tag'
  | 'mistake'
  | 'trade_quality';

export const queryKeys = {
  summary: (filters: Filters) => ['analytics', 'summary', filters] as const,
  equityCurve: (filters: Filters) => ['analytics', 'equity-curve', filters] as const,
  daily: (filters: Filters) => ['analytics', 'daily', filters] as const,
  breakdown: (by: BreakdownDim, filters: Filters) =>
    ['analytics', 'breakdown', by, filters] as const,
  rSummary: (filters: Filters) => ['analytics', 'r-summary', filters] as const,
  compliance: (filters: Filters) => ['analytics', 'compliance', filters] as const,
  behavior: (filters: Filters) => ['analytics', 'behavior', filters] as const,
  trades: (filters: Filters) => ['trades', filters] as const,
  trade: (id: string) => ['trades', id] as const,
  attachments: (tradeId: string) => ['trades', tradeId, 'attachments'] as const,
  accounts: () => ['accounts'] as const,
  setups: () => ['setups'] as const,
  tags: () => ['tags'] as const,
  notes: (filters: Pick<Filters, 'from' | 'to'>) => ['notes', filters] as const,
  note: (id: string) => ['notes', id] as const,
  economicEvents: (from: string, to: string) => ['economic-events', from, to] as const,
  fxRate: (from: string, to: string) => ['market', 'fx', from, to] as const,
  marketBars: (symbol: string, instrumentType: string, interval: string, from: string, to: string) =>
    ['market', 'bars', symbol, instrumentType, interval, from, to] as const,
  annualGoal: (year: number) => ['settings', 'annual-goal', year] as const,
  riskRules: () => ['settings', 'risk-rules'] as const,
  alertSettings: () => ['settings', 'alerts'] as const,
  cash: (filters: Filters) => ['cash', filters] as const,
  checklistTemplate: () => ['settings', 'checklist-template'] as const,
  llmSettings: (kind: LlmKind) => ['settings', kind] as const,
  accessTokens: () => ['access-tokens'] as const,
  accessTokenUses: (id: string) => ['access-tokens', id, 'uses'] as const,
  me: () => ['me'] as const,
  adminUsers: () => ['admin', 'users'] as const,
  propSettings: (accountId: string) => ['accounts', accountId, 'prop-settings'] as const,
  propStatus: (accountId: string, filters: Filters) =>
    ['accounts', accountId, 'prop-status', filters] as const,
  flexSync: (accountId: string) => ['accounts', accountId, 'flex-sync'] as const,
  health: () => ['health'] as const,
  systemInfo: () => ['system-info'] as const,
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
  options?: {
    enabled?: boolean;
    staleTime?: number;
    retry?: number | boolean;
    /** Hold the last result while a new key loads — for keys that change as you
     *  page through a range and shouldn't blank the screen on every step. */
    keepPrevious?: boolean;
  },
): UseQueryResult<T> {
  const { session, signIn } = useSession();
  return useQuery({
    queryKey: key,
    enabled: session != null && (options?.enabled ?? true),
    staleTime: options?.staleTime,
    retry: options?.retry,
    // Cast: TanStack's NonFunctionGuard can't see that no API response type is
    // itself a function, so the generic helper never type-checks against it.
    placeholderData: options?.keepPrevious ? (keepPreviousData as never) : undefined,
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

export function useAlertSettings() {
  return useApiQuery<AlertSettings>(queryKeys.alertSettings(), '/settings/alerts');
}

export function useTrades(filters: Filters = {}, options?: { enabled?: boolean }) {
  return useApiQuery<Trade[]>(queryKeys.trades(filters), '/trades', filters, options);
}

export function useTrade(id: string) {
  return useApiQuery<TradeDetail>(queryKeys.trade(id), `/trades/${id}`, undefined, {
    // An id-less quick-journal launch passes '' while it resolves the latest
    // trade from the list — don't fire a request at `/trades/`.
    enabled: id !== '',
  });
}

/**
 * The list row for a trade, if any cached `['trades', filters]` list still
 * holds it — everything a detail screen shows above its journal is already on
 * that row, so the screen can paint itself instead of a wall of skeletons while
 * `/trades/{id}` is in flight. The list caches are MMKV-persisted, so this
 * survives a cold start too. Resolved once per mount: the row you tapped is in
 * the cache before the screen exists.
 */
export function useCachedTradeRow(id: string): Trade | undefined {
  const queryClient = useQueryClient();
  return useMemo(() => {
    // ['trades', ...] also covers the detail and attachment caches, hence the
    // shape check — an array of objects carrying a symbol is a trade list.
    for (const [, cached] of queryClient.getQueriesData({ queryKey: ['trades'] })) {
      if (!Array.isArray(cached)) continue;
      const hit = (cached as Trade[]).find(
        (row) => row?.id === id && typeof row?.symbol === 'string',
      );
      if (hit) return hit;
    }
    return undefined;
  }, [queryClient, id]);
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

/** The signed-in account. Cheap and rarely changes — the settings hub, the
 *  profile screen and anything gating on `is_admin` all read this one query. */
export function useMe() {
  return useApiQuery<Me>(queryKeys.me(), '/me');
}

/**
 * Every account on the server. Owner-only — the API answers 403 to anyone
 * else, so callers gate on `me.is_admin` rather than firing a request that
 * can only fail.
 */
export function useAdminUsers(enabled = true) {
  return useApiQuery<AdminUser[]>(queryKeys.adminUsers(), '/admin/users', undefined, { enabled });
}

export function useAccessTokens() {
  return useApiQuery<AccessToken[]>(queryKeys.accessTokens(), '/access-tokens');
}

export function useAccessTokenUses(id: string) {
  return useApiQuery<AccessTokenUse[]>(
    queryKeys.accessTokenUses(id),
    `/access-tokens/${id}/uses`,
  );
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

/** Server capability probe — feature gates (e.g. share_links) ride `features`. */
export function useSystemInfo() {
  return useApiQuery<SystemInfo>(queryKeys.systemInfo(), '/system/info', undefined, {
    staleTime: 30_000,
    retry: 1,
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

// ---------------------------------------------------------------------------
// Analytics: R-summary, compliance, behavior
// ---------------------------------------------------------------------------

export function useRSummary(filters: Filters = {}) {
  return useApiQuery<RSummary>(queryKeys.rSummary(filters), '/analytics/r-summary', filters);
}

export function useCompliance(filters: Filters = {}) {
  return useApiQuery<ComplianceReport>(
    queryKeys.compliance(filters),
    '/analytics/compliance',
    filters,
  );
}

export function useBehavior(filters: Filters = {}) {
  return useApiQuery<BehaviorReport>(queryKeys.behavior(filters), '/analytics/behavior', filters);
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

/** GET /notes only filters by occurred_at range — type filtering is client-side. */
export function useNotes(filters: Pick<Filters, 'from' | 'to'> = {}) {
  return useApiQuery<Note[]>(queryKeys.notes(filters), '/notes', filters);
}

export function useNote(id: string) {
  return useApiQuery<Note>(queryKeys.note(id), `/notes/${id}`, undefined, {
    enabled: id.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Markets: economic events, FX
// ---------------------------------------------------------------------------

/**
 * GET /economic-events — `from`/`to` are required (max 366 days); impact and
 * currency filtering is client-side so one fetch serves every filter combo.
 * 503 means the server has no calendar provider configured.
 */
export function useEconomicEvents(from: string, to: string) {
  return useApiQuery<EconomicEvent[]>(
    queryKeys.economicEvents(from, to),
    '/economic-events',
    { from, to },
    {
      enabled: from.length > 0 && to.length > 0,
      staleTime: 5 * 60_000,
      retry: false,
      // Stepping the week changes the range, and so the key: without this the
      // calendar drops to skeletons mid-transition and the week animation plays
      // against an empty screen.
      keepPrevious: true,
    },
  );
}

/** Latest FX: 1 `from` = `rate` `to`. Skips the network when currencies match. */
export function useFxRate(from: string, to: string) {
  const base = from.trim().toUpperCase();
  const quote = to.trim().toUpperCase();
  const same = base.length > 0 && base === quote;
  return useApiQuery<FxRate>(
    queryKeys.fxRate(base, quote),
    '/market/fx',
    { from: base, to: quote },
    { enabled: base.length > 0 && quote.length > 0 && !same, staleTime: 15 * 60_000, retry: 1 },
  );
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export function useAttachments(tradeId: string) {
  return useApiQuery<TradeAttachment[]>(
    queryKeys.attachments(tradeId),
    `/trades/${tradeId}/attachments`,
    undefined,
    { enabled: tradeId.length > 0 },
  );
}

// ---------------------------------------------------------------------------
// Prop mode + Flex sync (per account)
// ---------------------------------------------------------------------------

export function usePropSettings(accountId: string, enabled = true) {
  return useApiQuery<PropSettings>(
    queryKeys.propSettings(accountId),
    `/accounts/${accountId}/prop-settings`,
    undefined,
    { enabled: enabled && accountId.length > 0 },
  );
}

/** Server-computed prop evaluation; only the `tz` filter matters. */
export function usePropStatus(accountId: string, filters: Filters = {}, enabled = true) {
  return useApiQuery<PropStatusResponse>(
    queryKeys.propStatus(accountId, filters),
    `/accounts/${accountId}/prop-status`,
    filters,
    { enabled: enabled && accountId.length > 0 },
  );
}

export function useFlexSync(accountId: string, enabled = true) {
  return useApiQuery<FlexSyncSettings>(
    queryKeys.flexSync(accountId),
    `/accounts/${accountId}/flex-sync`,
    undefined,
    { enabled: enabled && accountId.length > 0 },
  );
}
