/**
 * Shared chrome and data plumbing for the Reports sections: the per-page
 * scroll scaffold, and the hooks that combine the global scope with the
 * reports controls into query filters + money helpers. The segmented
 * switcher and the pager live on the index screen — each section is one
 * pager page wrapping its own ScrollView.
 */

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useRef, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { useAccounts, useCash } from '@/api/hooks';
import type { Filters } from '@/api/types';
import type { ReportsSection } from '@/app/(tabs)/(dashboard)/reports';
import { useSelectedAccountId } from '@/lib/account-store';
import { netDeposits } from '@/lib/cash';
import { useGlobalFilters } from '@/lib/filters';
import { useFormatters } from '@/lib/format';
import { useMoneyFx } from '@/lib/money';
import { PagerTabs } from '@/components/pager-tabs';
import { nominateSoftTopEdge, useSoftTopEdge } from '@/lib/soft-scroll-edge';
import { usePagerBottomInset } from '@/lib/pager-insets';
import { accountBaseCurrency } from '@/lib/prefs';
import {
  reportsMoney,
  useReportsControls,
  type ReportsMoney,
} from '@/lib/reports-display';

/** Query filters for reports = global scope + the side/duration controls. */
export function useReportsFilters(): Filters {
  const global = useGlobalFilters();
  const { side, duration } = useReportsControls();
  return {
    ...global,
    ...(side !== 'all' ? { side } : {}),
    ...(duration !== 'all' ? { duration } : {}),
  };
}

export type ReportsMoneyContext = {
  money: ReportsMoney;
  currency: string;
  fxRate: number;
  /** %-basis: net deposits on the scoped account (or all accounts summed). */
  denominator: number;
};

export function useReportsMoney(): ReportsMoneyContext {
  // Privacy flips and control changes both re-render money surfaces from here.
  // The formatters have to travel *into* reportsMoney: subscribing alone leaves
  // the memoized `money` object holding pre-flip closures (see lib/format.ts).
  const fmt = useFormatters();
  const controls = useReportsControls();
  const accounts = useAccounts();
  const selectedId = useSelectedAccountId();
  const cash = useCash();
  const denominator = netDeposits(accounts.data ?? [], selectedId, cash.data ?? []);
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedId));
  const fxRate = fx.rate ?? 1;
  return {
    money: reportsMoney(controls, fx.currency, fxRate, denominator, fmt),
    currency: fx.currency,
    fxRate,
    denominator,
  };
}

export type SectionOption = { value: ReportsSection; label: string };

/**
 * The section switcher is rendered by each page at the top of its own scroll
 * content (see the note on the index screen), so the pages need the strip's
 * options and the index's change handler.
 */
export type ReportsScroll = {
  sections: readonly SectionOption[];
  section: ReportsSection;
  onChange: (value: ReportsSection) => void;
  /** Expanded header height — the pages' manual top inset (see the index). */
  headerHeight: number;
};

const ReportsScrollContext = createContext<ReportsScroll | null>(null);
export const ReportsScrollProvider = ReportsScrollContext.Provider;

/** One pager page: a pull-to-refresh card stack under the floating switcher. */
export function SectionScaffold({
  refreshing,
  onScrolledChange,
  children,
}: {
  refreshing: boolean;
  /** Fires when content crosses under the bar — the index shows the title then. */
  onScrolledChange?: (scrolled: boolean) => void;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  // The page fill has to be a JS value: `ScrollView`'s style is not a place
  // Uniwind can take a `className`.
  const [background] = useCSSVariable(['--color-background']) as [string];
  const switcher = useContext(ReportsScrollContext);
  // Nested in the pager, `automatic` never gets the tab-bar bottom inset
  // (see lib/pager-insets.ts) — the last card needs explicit clearance.
  const bottomInset = usePagerBottomInset();
  const softTopEdge = useSoftTopEdge();

  const scrollNode = useRef<unknown>(null);

  return (
    <ScrollView
      // Neither UIKit's nor screens' own discovery reaches a list this deep
      // (floating pager root), so nominate it: that is what gives this screen
      // the blurred header its content scrolls under, plus the native
      // large-title collapse. See lib/soft-scroll-edge.
      ref={(node: unknown) => {
        scrollNode.current = node;
        softTopEdge(node);
      }}
      style={{ flex: 1, backgroundColor: background }}
      // Both insets are manual here: the pager hides this scroll view from
      // UIKit's automatic adjustment (see lib/pager-insets.ts), so `automatic`
      // would leave the content under the transparent bar entirely.
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: switcher?.headerHeight ?? 0, paddingBottom: 48 + bottomInset }}
      scrollEventThrottle={16}
      onScroll={() => {
        // Whichever page the user drags is the one the header should track —
        // repeat nominations dedupe natively.
        nominateSoftTopEdge(scrollNode.current);
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void queryClient.invalidateQueries()}
        />
      }
    >
      {switcher ? (
        <View className="px-4 pt-1">
          <PagerTabs
            options={switcher.sections}
            value={switcher.section}
            onChange={switcher.onChange}
          />
        </View>
      ) : null}
      <View className="gap-4 p-4 pt-3">{children}</View>
    </ScrollView>
  );
}
