import { Chart } from '@expo/ui/swift-ui';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useBreakdown, type BreakdownDim } from '@/api/hooks';
import type { BreakGroup } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { InlineError } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { PnlHeatmapCard } from '@/components/reports/pnl-heatmap-card';
import { MagnitudeRow } from '@/components/reports/shared';
import {
  SectionScaffold,
  useReportsFilters,
  useReportsMoney,
  type ReportsMoneyContext,
} from '@/components/reports/section-scaffold';
import { t } from '@lingui/core/macro';
import { formatPercent, formatRatio, useFormatters } from '@/lib/format';
import { pnlColor } from '@/styles/unistyles';
import { AppHost } from '@/components/app-host';

const MAX_ROWS = 10;

/**
 * Ranked magnitude list — the phone's answer to web's horizontal bar charts
 * and the symbol treemap in one visual: label, share-of-|P&L| bar, amount.
 */
function RankedBreakdownCard({
  title,
  dim,
  ctx,
  emptyLabel,
  labelFor,
}: {
  title: string;
  dim: BreakdownDim;
  ctx: ReportsMoneyContext;
  emptyLabel: string;
  labelFor?: (key: string) => string;
}) {
  const filters = useReportsFilters();
  const breakdown = useBreakdown(dim, filters);
  const { money } = ctx;

  if (breakdown.isLoading) {
    return (
      <DashboardCard title={title}>
        <Skeleton style={styles.listSkeleton} />
      </DashboardCard>
    );
  }
  if (breakdown.error && breakdown.data == null) {
    return (
      <DashboardCard title={title}>
        <InlineError error={breakdown.error} onRetry={() => void breakdown.refetch()} />
      </DashboardCard>
    );
  }

  // API sorts by net P&L; magnitude ranking reads better for "where's the action".
  const groups = [...(breakdown.data ?? [])].sort(
    (a, b) => Math.abs(money.pnl(b.summary)) - Math.abs(money.pnl(a.summary)),
  );
  if (groups.length === 0) {
    return (
      <DashboardCard title={title}>
        <Text style={styles.empty}>{emptyLabel}</Text>
      </DashboardCard>
    );
  }

  const shown = groups.slice(0, MAX_ROWS);
  const maxAbs = Math.max(...shown.map((g) => Math.abs(money.pnl(g.summary))), 1);

  return (
    <DashboardCard title={title}>
      <View style={styles.rows}>
        {shown.map((group) => {
          const value = money.pnl(group.summary);
          return (
            <MagnitudeRow
              key={group.key}
              label={labelFor ? labelFor(group.key) : group.key}
              meta={`${group.summary.total_trades} · ${formatPercent(group.summary.win_rate, 0)}`}
              value={money.formatCompact(value)}
              rawValue={value}
              maxAbs={maxAbs}
            />
          );
        })}
      </View>
      {groups.length > MAX_ROWS ? (
        <Text style={styles.footnote}>{t`Top ${MAX_ROWS} of ${groups.length} by magnitude.`}</Text>
      ) : null}
    </DashboardCard>
  );
}

/** Mon–Sun vertical bars — weekday count is exactly what Swift Charts likes. */
function DayOfWeekCard({ ctx }: { ctx: ReportsMoneyContext }) {
  const { theme } = useUnistyles();
  const filters = useReportsFilters();
  const breakdown = useBreakdown('day_of_week', filters);
  const { money } = ctx;

  if (breakdown.isLoading) {
    return (
      <DashboardCard title={t`Day of week`}>
        <Skeleton style={styles.chart} />
      </DashboardCard>
    );
  }
  if (breakdown.error && breakdown.data == null) {
    return (
      <DashboardCard title={t`Day of week`}>
        <InlineError error={breakdown.error} onRetry={() => void breakdown.refetch()} />
      </DashboardCard>
    );
  }
  const groups = breakdown.data ?? [];
  if (groups.length === 0) {
    return (
      <DashboardCard title={t`Day of week`}>
        <Text style={styles.empty}>{t`No trades in this range.`}</Text>
      </DashboardCard>
    );
  }

  // The API sorts by P&L; a weekday chart wants calendar order.
  const ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const ordered = [...groups].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  const data = ordered.map((group) => {
    const value = money.display(money.pnl(group.summary));
    return {
      x: group.key.slice(0, 3),
      y: value,
      color: value >= 0 ? theme.colors.profit : theme.colors.loss,
    };
  });

  return (
    <DashboardCard title={t`Day of week`}>
      <AppHost style={styles.chart}>
        <Chart data={data} type="bar" showGrid animate barStyle={{ cornerRadius: 2 }} />
      </AppHost>
    </DashboardCard>
  );
}

/** Hour buckets ranked by magnitude, labels honoring the 12/24-hour pref. */
function HourOfDayCard({ ctx }: { ctx: ReportsMoneyContext }) {
  // Bound to the clock pref, so switching 12/24-hour relabels the rows.
  const { formatHourKeyLabel } = useFormatters();
  return (
    <RankedBreakdownCard
      title={t`Hour of day`}
      dim="hour_of_day"
      ctx={ctx}
      emptyLabel={t`No trades in this range.`}
      labelFor={formatHourKeyLabel}
    />
  );
}

/** Premarket / RTH / Afterhours / Overnight stats — always on the ET clock. */
function SessionCard({ ctx }: { ctx: ReportsMoneyContext }) {
  const { theme } = useUnistyles();
  const filters = useReportsFilters();
  const breakdown = useBreakdown('session', filters);
  const { money } = ctx;

  if (breakdown.isLoading) {
    return (
      <DashboardCard title={t`Sessions`}>
        <Skeleton style={styles.listSkeleton} />
      </DashboardCard>
    );
  }
  if (breakdown.error && breakdown.data == null) {
    return (
      <DashboardCard title={t`Sessions`}>
        <InlineError error={breakdown.error} onRetry={() => void breakdown.refetch()} />
      </DashboardCard>
    );
  }
  const groups = breakdown.data ?? [];
  if (groups.length === 0) {
    return (
      <DashboardCard title={t`Sessions`}>
        <Text style={styles.empty}>{t`No trades in this range.`}</Text>
      </DashboardCard>
    );
  }

  const sessionLabel = (key: string) => {
    switch (key) {
      case 'Premarket':
        return t`Premarket`;
      case 'RTH':
        return t`Regular hours`;
      case 'Afterhours':
        return t`After hours`;
      case 'Overnight':
        return t`Overnight`;
      default:
        return key;
    }
  };

  const row = (group: BreakGroup) => {
    const value = money.pnl(group.summary);
    return (
      <View key={group.key} style={styles.sessionRow}>
        <View style={styles.sessionHead}>
          <Text style={styles.sessionName}>{sessionLabel(group.key)}</Text>
          <Text style={[styles.sessionPnl, { color: pnlColor(theme.colors, value) }]}>
            {money.formatCompact(value)}
          </Text>
        </View>
        <Text style={styles.sessionMeta}>
          {t`${group.summary.total_trades} trades`} · {formatPercent(group.summary.win_rate, 0)} ·{' '}
          {t`avg`} {money.formatCompact(group.summary.avg_trade)} · PF{' '}
          {formatRatio(group.summary.profit_factor)}
        </Text>
      </View>
    );
  };

  return (
    <DashboardCard title={t`Sessions`}>
      <View style={styles.rows}>{groups.map(row)}</View>
      <Text style={styles.footnote}>{t`Sessions follow the New York clock.`}</Text>
    </DashboardCard>
  );
}

export function DetailedSection({
  onScrolledChange,
}: {
  onScrolledChange?: (scrolled: boolean) => void;
}) {
  const ctx = useReportsMoney();
  const filters = useReportsFilters();
  // One representative query drives the pull-to-refresh spinner.
  const symbols = useBreakdown('symbol', filters);

  return (
    <SectionScaffold refreshing={symbols.isRefetching} onScrolledChange={onScrolledChange}>
      <RankedBreakdownCard
        title={t`Symbols`}
        dim="symbol"
        ctx={ctx}
        emptyLabel={t`No trades in this range.`}
      />
      <RankedBreakdownCard
        title={t`Tags`}
        dim="tag"
        ctx={ctx}
        emptyLabel={t`No tagged trades in this range.`}
      />
      <DayOfWeekCard ctx={ctx} />
      <HourOfDayCard ctx={ctx} />
      <PnlHeatmapCard ctx={ctx} />
      <SessionCard ctx={ctx} />
    </SectionScaffold>
  );
}

const styles = StyleSheet.create((theme) => ({
  rows: { gap: theme.spacing.md },
  chart: { height: 200 },
  listSkeleton: { height: 220, borderRadius: theme.radius.lg },
  empty: { fontSize: 13, color: theme.colors.mutedForeground, paddingVertical: theme.spacing.lg },
  footnote: { fontSize: 12, color: theme.colors.mutedForeground },
  sessionRow: { gap: 2 },
  sessionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sessionName: { fontSize: 14, fontWeight: '600', color: theme.colors.foreground },
  sessionPnl: { fontSize: 14, fontWeight: '600', ...theme.numeric },
  sessionMeta: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
}));
