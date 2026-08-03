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
import { resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';

export function useGlobalFilters(): Filters {
  const accountId = useSelectedAccountId();
  const { marketTimezone, tradeDateBasis } = useDisplayPrefs();
  return {
    ...(accountId ? { account_id: accountId } : {}),
    tz: resolveMarketTimezone(marketTimezone),
    date_basis: tradeDateBasis,
  };
}
