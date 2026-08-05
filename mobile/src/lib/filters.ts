/**
 * Global query scope — the mobile analog of web's `useFilterParams()`.
 *
 * Every data screen spreads this into its API filters so the selected account,
 * the market timezone (which owns day/hour bucketing), and the trade date
 * basis apply everywhere at once. Screen-local filters (date range, status…)
 * layer on top: `{ ...useGlobalFilters(), from, to }`.
 */

import type { Filters } from '@/api/types';
import { useSelectedAccountId } from '@/lib/account-store';
import { resolveMarketTimezone, rfc3339OffsetSuffix, useDisplayPrefs } from '@/lib/prefs';

export function useGlobalFilters(): Filters {
  const accountId = useSelectedAccountId();
  const { marketTimezone, tradeDateBasis } = useDisplayPrefs();
  return {
    ...(accountId ? { account_id: accountId } : {}),
    tz: resolveMarketTimezone(marketTimezone),
    date_basis: tradeDateBasis,
  };
}

/**
 * RFC3339 bounds for one `YYYY-MM-DD` in the market timezone (web
 * `normalizeFilterDate`) — "June 1" has to mean the market's June 1, since
 * that's how the API attributes trades to calendar days.
 */
export function dayBounds(date: string, tz: string): { from: string; to: string } {
  // Offset in effect around midday of that date (DST transitions run at night).
  const offset = rfc3339OffsetSuffix(tz, new Date(`${date}T12:00:00Z`));
  return { from: `${date}T00:00:00${offset}`, to: `${date}T23:59:59${offset}` };
}
