/**
 * Shared chrome and data plumbing for the Reports sections: the horizontal
 * section chip switcher, the page scroll scaffold, and the hooks that combine
 * the global scope with the reports controls into query filters + money
 * helpers. Each section is its own ScrollView so switching stays cheap.
 */

import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
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

/** Horizontal single-select chip rail — the section switcher. */
function SectionChips({
  sections,
  section,
  onSection,
}: {
  sections: SectionOption[];
  section: ReportsSection;
  onSection: (section: ReportsSection) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      style={styles.chipRail}
    >
      {sections.map((option) => {
        const active = option.value === section;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSection(option.value)}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Page scaffold: chip rail on top of a pull-to-refresh card stack. */
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
      <SectionChips sections={sections} section={section} onSection={onSection} />
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
  // The rail bleeds to the screen edge; chips keep the page gutter.
  chipRail: { flexGrow: 0 },
  chipRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.input,
  },
  pressed: { opacity: 0.6 },
  chipLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.mutedForeground },
  chipLabelActive: { color: theme.colors.foreground, fontWeight: '600' },
  stack: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.lg,
  },
}));
