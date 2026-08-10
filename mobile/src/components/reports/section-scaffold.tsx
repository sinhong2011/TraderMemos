/**
 * Shared chrome and data plumbing for the Reports sections: the per-page
 * scroll scaffold, and the hooks that combine the global scope with the
 * reports controls into query filters + money helpers. The segmented
 * switcher and the pager live on the index screen — each section is one
 * pager page wrapping its own ScrollView.
 */

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { Animated, RefreshControl, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useAccounts, useCash } from '@/api/hooks';
import type { Filters } from '@/api/types';
import type { ReportsSection } from '@/app/(tabs)/(dashboard)/reports';
import { useSelectedAccountId } from '@/lib/account-store';
import { netDeposits } from '@/lib/cash';
import { useGlobalFilters } from '@/lib/filters';
import { useFormatters } from '@/lib/format';
import { useMoneyFx } from '@/lib/money';
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
 * The segmented switcher floats above the pages and slides out of the way as
 * you read, so every section reports its scroll to one shared value instead of
 * carrying its own copy of the bar.
 */
export type ReportsScroll = {
  /**
   * Live offset of whichever page is on screen. RN's `Animated` rather than
   * Reanimated: the value is written by a native-driven scroll event, so no
   * component ever assigns to it — which is the only form the React Compiler
   * accepts for a value handed down through context.
   */
  offset: Animated.Value;
  /** Measured height of the floating switcher — the pages' top inset. */
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
  const reportsScroll = useContext(ReportsScrollContext);
  const headerHeight = reportsScroll?.headerHeight ?? 0;

  const onScroll = reportsScroll
    ? Animated.event([{ nativeEvent: { contentOffset: { y: reportsScroll.offset } } }], {
        useNativeDriver: true,
        // Same boolean the index has always used for its title; setState with
        // an unchanged value is a no-op, so it needn't be de-duped here.
        listener: (event) => {
          const { y } = (event.nativeEvent as { contentOffset: { y: number } }).contentOffset;
          onScrolledChange?.(y > 24);
        },
      })
    : undefined;

  return (
    <Animated.ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: headerHeight }]}
      contentInsetAdjustmentBehavior="automatic"
      scrollEventThrottle={16}
      onScroll={onScroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          // Clears the switcher instead of spinning behind it.
          progressViewOffset={headerHeight}
          onRefresh={() => void queryClient.invalidateQueries()}
        />
      }
    >
      <View style={styles.stack}>{children}</View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: theme.spacing.xl * 2 },
  stack: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.lg,
  },
}));
