/**
 * Shared chrome and data plumbing for the Reports sections: the per-page
 * scroll scaffold, and the hooks that combine the global scope with the
 * reports controls into query filters + money helpers. The segmented
 * switcher and the pager live on the index screen — each section is one
 * pager page wrapping its own ScrollView.
 */

import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useAccounts } from '@/api/hooks';
import type { Filters } from '@/api/types';
import type { ReportsSection } from '@/app/(tabs)/(reports)/index';
import { useSelectedAccountId } from '@/lib/account-store';
import { useGlobalFilters } from '@/lib/filters';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency, useDisplayPrefs } from '@/lib/prefs';
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
  /** %-basis: the scoped account's starting balance (or all accounts summed). */
  denominator: number;
};

export function useReportsMoney(): ReportsMoneyContext {
  // Privacy flips and control changes both re-render money surfaces from here.
  useDisplayPrefs();
  const controls = useReportsControls();
  const accounts = useAccounts();
  const selectedId = useSelectedAccountId();
  const list = accounts.data ?? [];
  const scoped = selectedId ? list.filter((account) => account.id === selectedId) : list;
  const denominator = scoped.reduce((sum, account) => sum + account.starting_balance, 0);
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedId));
  const fxRate = fx.rate ?? 1;
  return {
    money: reportsMoney(controls, fx.currency, fxRate, denominator),
    currency: fx.currency,
    fxRate,
    denominator,
  };
}

export type SectionOption = { value: ReportsSection; label: string };

/** One pager page: a pull-to-refresh card stack. */
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
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      scrollEventThrottle={32}
      onScroll={
        onScrolledChange
          ? (event) => onScrolledChange(event.nativeEvent.contentOffset.y > 24)
          : undefined
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void queryClient.invalidateQueries()}
        />
      }
    >
      <View style={styles.stack}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: theme.spacing.xl * 2 },
  stack: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.lg,
  },
}));
