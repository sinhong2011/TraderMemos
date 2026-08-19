/**
 * Shared chrome and data plumbing for the Reports sections: the per-page
 * scroll scaffold, and the hooks that combine the global scope with the
 * reports controls into query filters + money helpers. The segmented
 * switcher and the pager live on the index screen — each section is one
 * pager page wrapping its own ScrollView.
 */

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useRef, type ReactNode } from 'react';
import { Animated, RefreshControl, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { useAccounts, useCash } from '@/api/hooks';
import type { Filters } from '@/api/types';
import type { ReportsSection } from '@/app/(tabs)/(dashboard)/reports';
import { useSelectedAccountId } from '@/lib/account-store';
import { netDeposits } from '@/lib/cash';
import { useGlobalFilters } from '@/lib/filters';
import { useFormatters } from '@/lib/format';
import { useMoneyFx } from '@/lib/money';
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
 * The segmented switcher floats above the pages and slides out of the way as
 * you read, so every section reports its scroll to one shared value instead of
 * carrying its own copy of the bar.
 */
export type ReportsScroll = {
  /**
   * Live offset of whichever page is on screen. RN's `Animated` rather than
   * Reanimated: the value is written by a native-driven scroll event, so no
   * component ever assigns to it — which is the only form the React Compiler
   * accepts for a value handed down through context. (The one place in this
   * app core `Animated` is still right: it is a scroll-offset carrier shared
   * with the Reports index, not an animation driver.)
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
  // The page fill has to be a JS value: `Animated.ScrollView` is a wrapper,
  // not a core component Uniwind can take a `className` on.
  const [background] = useCSSVariable(['--color-background']) as [string];
  const reportsScroll = useContext(ReportsScrollContext);
  const headerHeight = reportsScroll?.headerHeight ?? 0;
  // Nested in the pager, `automatic` never gets the tab-bar bottom inset
  // (see lib/pager-insets.ts) — the last card needs explicit clearance.
  const bottomInset = usePagerBottomInset();
  const softTopEdge = useSoftTopEdge();

  const scrollNode = useRef<unknown>(null);
  const onScroll = reportsScroll
    ? // eslint-disable-next-line react-hooks/refs -- the ref is only read inside the scroll listener, never during render
      Animated.event([{ nativeEvent: { contentOffset: { y: reportsScroll.offset } } }], {
        useNativeDriver: true,
        // Same boolean the index has always used for its title; setState with
        // an unchanged value is a no-op, so it needn't be de-duped here.
        listener: (event) => {
          const { y } = (event.nativeEvent as { contentOffset: { y: number } }).contentOffset;
          onScrolledChange?.(y > 24);
          // Whichever page the user drags is the one the header should track
          // (large-title collapse + soft edge) — repeat nominations dedupe.
          nominateSoftTopEdge(scrollNode.current);
        },
      })
    : undefined;

  return (
    <Animated.ScrollView
      // The screens-level scrollEdgeEffects can't reach a list nested in the
      // pager — nominate this scroll view for the soft top fade explicitly.
      ref={(node: unknown) => {
        scrollNode.current = node;
        softTopEdge(node);
      }}
      style={{ flex: 1, backgroundColor: background }}
      contentContainerStyle={{ paddingBottom: 48 + bottomInset }}
      // No top padding, and both inset mechanisms off: once the scroll view is
      // associated with the nav bar (lib/soft-scroll-edge), UIKit positions the
      // content below the expanded large title itself, and the switcher rides
      // in that same band. Adding either the manual switcher inset or an
      // automatic one on top of that reopens a large-title-sized gap under the
      // switcher. Bottom clearance stays explicit — `automatic` never
      // delivered the tab-bar inset inside the pager (see lib/pager-insets.ts).
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
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
      <View className="gap-4 p-4 pt-2">{children}</View>
    </Animated.ScrollView>
  );
}
