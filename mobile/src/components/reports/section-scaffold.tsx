/**
 * Shared chrome and data plumbing for the Reports sections: the horizontal
 * section chip switcher, the page scroll scaffold, and the hooks that combine
 * the global scope with the reports controls into query filters + money
 * helpers. Each section is its own ScrollView so switching stays cheap.
 */

import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useAccounts } from '@/api/hooks';
import { Segmented } from '@/components/segmented';
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

/** Page scaffold: native segmented switcher over a pull-to-refresh card stack. */
export function SectionScaffold({
  sections,
  section,
  onSection,
  refreshing,
  children,
}: {
  sections: SectionOption[];
  section: ReportsSection;
  onSection: (section: ReportsSection) => void;
  refreshing: boolean;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  return (
    <ScrollView
      style={styles.page}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void queryClient.invalidateQueries()} />
      }
    >
      {/* iOS 26 segmented control — SwiftUI compresses five labels cleanly,
          where a chip rail read as tag buttons and scrolled off-screen. */}
      <View style={styles.segment}>
        <Segmented options={sections} value={section} onChange={onSection} />
      </View>
      <View style={styles.stack}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { backgroundColor: theme.colors.background },
  content: {
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl * 2,
  },
  segment: {
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  stack: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.lg,
  },
}));
