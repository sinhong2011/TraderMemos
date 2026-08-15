import { useRouter } from 'expo-router';
import { BarChart, cn, Skeleton } from 'panelui-native';
import { Pressable, Text, View } from 'react-native';

import { useBreakdown, type BreakdownDim } from '@/api/hooks';
import type { BreakGroup } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { InlineError } from '@/components/error-state';
import { PnlHeatmapCard } from '@/components/reports/pnl-heatmap-card';
import { MagnitudeRow, signedBars } from '@/components/reports/shared';
import {
  SectionScaffold,
  useReportsFilters,
  useReportsMoney,
  type ReportsMoneyContext,
} from '@/components/reports/section-scaffold';
import { t } from '@lingui/core/macro';
import { formatPercent, formatRatio, useFormatters } from '@/lib/format';
import { pnlClass, usePnlPalette } from '@/styles/pnl';

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
  onPressRow,
}: {
  title: string;
  dim: BreakdownDim;
  ctx: ReportsMoneyContext;
  emptyLabel: string;
  labelFor?: (key: string) => string;
  /** Makes each row tappable — the Symbols card opens the symbol journal. */
  onPressRow?: (key: string) => void;
}) {
  const filters = useReportsFilters();
  const breakdown = useBreakdown(dim, filters);
  const { money } = ctx;

  if (breakdown.isLoading) {
    return (
      <DashboardCard title={title}>
        <Skeleton className="h-[220px] rounded-lg" />
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
        <Text className="py-4 text-[13px] text-muted-foreground">{emptyLabel}</Text>
      </DashboardCard>
    );
  }

  const shown = groups.slice(0, MAX_ROWS);
  const maxAbs = Math.max(...shown.map((g) => Math.abs(money.pnl(g.summary))), 1);

  return (
    <DashboardCard title={title}>
      <View className="gap-3">
        {shown.map((group) => {
          const value = money.pnl(group.summary);
          const row = (
            <MagnitudeRow
              key={group.key}
              label={labelFor ? labelFor(group.key) : group.key}
              meta={`${group.summary.total_trades} · ${formatPercent(group.summary.win_rate, 0)}`}
              value={money.formatCompact(value)}
              rawValue={value}
              maxAbs={maxAbs}
            />
          );
          return onPressRow ? (
            <Pressable
              key={group.key}
              onPress={() => onPressRow(group.key)}
              accessibilityRole="button"
              className="active:opacity-60"
            >
              {row}
            </Pressable>
          ) : (
            row
          );
        })}
      </View>
      {groups.length > MAX_ROWS ? (
        <Text className="text-xs text-muted-foreground">{t`Top ${MAX_ROWS} of ${groups.length} by magnitude.`}</Text>
      ) : null}
    </DashboardCard>
  );
}

/** Mon–Sun vertical bars — seven categories is exactly a bar chart's width. */
function DayOfWeekCard({ ctx }: { ctx: ReportsMoneyContext }) {
  const palette = usePnlPalette();
  const filters = useReportsFilters();
  const breakdown = useBreakdown('day_of_week', filters);
  const { money } = ctx;

  if (breakdown.isLoading) {
    return (
      <DashboardCard title={t`Day of week`}>
        <Skeleton className="h-[200px] rounded-lg" />
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
        <Text className="py-4 text-[13px] text-muted-foreground">{t`No trades in this range.`}</Text>
      </DashboardCard>
    );
  }

  // The API sorts by P&L; a weekday chart wants calendar order.
  const ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const ordered = [...groups].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  const data = ordered.map((group) =>
    signedBars(group.key.slice(0, 3), money.display(money.pnl(group.summary))),
  );

  return (
    <DashboardCard title={t`Day of week`}>
      <BarChart data={data} xDataKey="name" stacked aspectRatio={2} cornerRadius={2}>
        <BarChart.Grid />
        <BarChart.Bar dataKey="gain" color={palette.profit} />
        <BarChart.Bar dataKey="loss" color={palette.loss} />
        <BarChart.XAxis />
      </BarChart>
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
  const filters = useReportsFilters();
  const breakdown = useBreakdown('session', filters);
  const { money } = ctx;

  if (breakdown.isLoading) {
    return (
      <DashboardCard title={t`Sessions`}>
        <Skeleton className="h-[220px] rounded-lg" />
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
        <Text className="py-4 text-[13px] text-muted-foreground">{t`No trades in this range.`}</Text>
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
      <View key={group.key} className="gap-0.5">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-sm font-semibold text-foreground">{sessionLabel(group.key)}</Text>
          <Text className={cn('text-sm font-semibold tabular-nums', pnlClass(value))}>
            {money.formatCompact(value)}
          </Text>
        </View>
        <Text className="text-xs tabular-nums text-muted-foreground">
          {t`${group.summary.total_trades} trades`} · {formatPercent(group.summary.win_rate, 0)} ·{' '}
          {t`avg`} {money.formatCompact(group.summary.avg_trade)} · PF{' '}
          {formatRatio(group.summary.profit_factor)}
        </Text>
      </View>
    );
  };

  return (
    <DashboardCard title={t`Sessions`}>
      <View className="gap-3">{groups.map(row)}</View>
      <Text className="text-xs text-muted-foreground">{t`Sessions follow the New York clock.`}</Text>
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
  const router = useRouter();
  // One representative query drives the pull-to-refresh spinner.
  const symbols = useBreakdown('symbol', filters);

  return (
    <SectionScaffold refreshing={symbols.isRefetching} onScrolledChange={onScrolledChange}>
      <RankedBreakdownCard
        title={t`Symbols`}
        dim="symbol"
        ctx={ctx}
        emptyLabel={t`No trades in this range.`}
        // A symbol row answers "how did I do on X?" — the journal shows where.
        onPressRow={(symbol) =>
          router.push({ pathname: '/(tabs)/(dashboard)/symbol-journal', params: { symbol } })
        }
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
