/**
 * The trader's "today", derived once for every surface that leaves the app:
 * the Home/Lock Screen widget snapshot (`widget-snapshot.ts`) and the
 * trading-session Live Activity (`live-activity.ts`) both render exactly
 * these numbers, so they must come from one derivation.
 *
 * Reuses the dashboard's own queries — same keys, same cache — and
 * FX-converts money into the display currency here, so the native sides only
 * format.
 */

import { useAccounts, useDaily, useRiskRules, useTrades } from '@/api/hooks';
import { useSelectedAccountId } from '@/lib/account-store';
import { dayKeyInTz } from '@/lib/events';
import { useGlobalFilters } from '@/lib/filters';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency, resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';

export type TodayState = {
  /** Daily P&L and open positions have loaded — safe to publish. */
  ready: boolean;
  /** Market-timezone day key ("2026-08-09") the numbers belong to. */
  todayKey: string;
  /** Resolved IANA identifier the trading day is bucketed by. */
  marketTz: string;
  /** Display currency every money field below is converted into. */
  currency: string;
  todayNetPnl: number;
  openPositions: number;
  /** Trades opened today on the market clock; null until the list loads. */
  tradesToday: number | null;
  dailyLossLimit: number | null;
  maxRiskPerTrade: number | null;
  privacyMode: boolean;
};

export function useTodayState(): TodayState {
  const filters = useGlobalFilters();
  const { privacyMode, marketTimezone } = useDisplayPrefs();

  // Identical `from` string to the dashboard's daily query so the two share
  // one cache entry.
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00Z`;
  const daily = useDaily({ ...filters, from: monthStart });
  // Positions, not a daily figure — status-scoped, never date-scoped.
  const openTrades = useTrades({ ...filters, status: 'open' });
  // The dashboard's own trade list, for "trades taken today".
  const trades = useTrades(filters);
  const riskRules = useRiskRules();
  const accounts = useAccounts();
  const selectedAccountId = useSelectedAccountId();
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedAccountId));

  const marketTz = resolveMarketTimezone(marketTimezone);
  const todayKey = dayKeyInTz(new Date().toISOString(), marketTz);
  const cap = riskRules.data?.max_daily_loss;
  const risk = riskRules.data?.max_risk_per_trade;

  return {
    ready: daily.data != null && openTrades.data != null,
    todayKey,
    marketTz,
    currency: fx.currency,
    // Converted during render so effects downstream depend on stable
    // primitives, not on the fresh `toDisplay` closure useMoneyFx returns
    // each render.
    todayNetPnl: fx.toDisplay(daily.data?.[todayKey] ?? 0),
    openPositions: openTrades.data?.length ?? 0,
    tradesToday:
      trades.data == null
        ? null
        : trades.data.filter((trade) => dayKeyInTz(trade.opened_at, marketTz) === todayKey).length,
    dailyLossLimit: cap != null && cap > 0 ? fx.toDisplay(cap) : null,
    maxRiskPerTrade: risk != null && risk > 0 ? fx.toDisplay(risk) : null,
    privacyMode,
  };
}
