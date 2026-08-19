import { useRouter } from 'expo-router';
import { AreaChart, LineChart, Skeleton } from 'panelui-native';
import { useMemo } from 'react';
import { useCSSVariable } from 'uniwind';
import { Text, View } from 'react-native';

import { useCompliance, useEquityCurve, useMonteCarlo, useTrades } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { InlineError } from '@/components/error-state';
import { StatBar } from '@/components/stat-bar';
import { EventRow, MicroHeading } from '@/components/reports/shared';
import {
  SectionScaffold,
  useReportsFilters,
  useReportsMoney,
  type ReportsMoneyContext,
} from '@/components/reports/section-scaffold';
import { t } from '@lingui/core/macro';
import { formatPercent, formatPercentPoints } from '@/lib/format';
import { avgRiskPerTrade, drawdownDepthSeries } from '@/lib/reports-analytics';
import { pnlColor, usePnlPalette } from '@/styles/pnl';

/** Downsampling cap for the drawdown curve. */
const MAX_POINTS = 120;

export function RiskSection({
  onScrolledChange,
}: {
  onScrolledChange?: (scrolled: boolean) => void;
}) {
  const palette = usePnlPalette();
  const router = useRouter();
  const filters = useReportsFilters();
  const ctx = useReportsMoney();
  const { money } = ctx;

  const equity = useEquityCurve(filters);
  const trades = useTrades(filters);
  const compliance = useCompliance(filters);

  const points = useMemo(() => equity.data?.points ?? [], [equity.data]);
  // Dollar depth, not percent-of-peak: a range-scoped curve's early peak is
  // tiny, and dividing by it turned ordinary dips into "-257%". Money runs
  // through the reports unit toggle for a percentage with a real base.
  const fullSeries = useMemo(() => drawdownDepthSeries(points), [points]);
  const ddSeries = useMemo(() => {
    if (fullSeries.length <= MAX_POINTS) return fullSeries;
    const step = fullSeries.length / MAX_POINTS;
    const sampled = [];
    for (let i = 0; i < MAX_POINTS - 1; i++) sampled.push(fullSeries[Math.floor(i * step)]);
    sampled.push(fullSeries[fullSeries.length - 1]);
    return sampled;
  }, [fullSeries]);

  const maxDd = fullSeries.reduce((min, point) => Math.min(min, point.depth), 0);
  const currentDd = fullSeries.length > 0 ? fullSeries[fullSeries.length - 1].depth : 0;
  const risk = avgRiskPerTrade(trades.data ?? []);

  // Plotted as *depth* (a positive number below the peak) rather than the
  // signed value: an area band fills from the baseline up, so signed values
  // would draw the biggest wash at the flattest stretch and nothing at the
  // worst of it. The axis and the readout put the minus sign back.
  const ddData = ddSeries.map((point, index) => ({
    i: index,
    depth: -point.depth,
  }));

  const report = compliance.data;
  const scoredDays = report ? report.compliant_days + report.breach_days : 0;
  const adherence = report && scoredDays > 0 ? report.compliant_days / scoredDays : null;
  const totalViolations = report
    ? report.risk_violations +
      report.daily_loss_breaches +
      report.trade_limit_breaches +
      report.loss_streak_breaches
    : 0;
  // Only the rules actually broken get named — four zero-count segments would
  // truncate the tile's one-line sub before it said anything. With a single
  // kind the count would just repeat the value above it ("58, 58 over-traded"),
  // so the sub keeps the kind alone.
  const violationKinds = report
    ? [
        { count: report.risk_violations, label: t`over-risked` },
        { count: report.daily_loss_breaches, label: t`daily-loss` },
        { count: report.trade_limit_breaches, label: t`over-traded` },
        { count: report.loss_streak_breaches, label: t`loss-streak` },
      ].filter((kind) => kind.count > 0)
    : [];
  const violationsSub =
    violationKinds.length === 0
      ? undefined
      : violationKinds.length === 1
        ? violationKinds[0].label
        : violationKinds.map((kind) => `${kind.count} ${kind.label}`).join(' · ');
  const recentBreaches = report
    ? report.days.filter((day) => !day.compliant).slice(-6).reverse()
    : [];

  return (
    <SectionScaffold
      refreshing={equity.isRefetching || compliance.isRefetching}
      onScrolledChange={onScrolledChange}
    >
      <DashboardCard title={t`Drawdown`}>
        {equity.isLoading ? (
          <Skeleton className="h-[170px] rounded-lg" label={t`Loading drawdown`} />
        ) : equity.error && equity.data == null ? (
          <InlineError error={equity.error} onRetry={() => void equity.refetch()} />
        ) : points.length === 0 ? (
          <Text className="py-2 text-[13px] text-muted-foreground">{t`No equity data in this range.`}</Text>
        ) : (
          <>
            <View className="flex-row flex-wrap gap-2">
              {/* The card title already says "Drawdown" — repeating it in the
                  labels reads as a stutter. */}
              <StatBar
                plain
                label={t`Max`}
                value={money.formatCompact(maxDd)}
                tone={maxDd < 0 ? 'neg' : 'muted'}
              />
              <StatBar
                plain
                label={t`Current`}
                value={money.formatCompact(currentDd)}
                sub={currentDd >= 0 ? t`at the highs` : undefined}
                tone={currentDd < 0 ? 'neg' : 'pos'}
              />
              <StatBar
                plain
                label={t`Avg risk / trade`}
                value={risk.avg != null ? money.formatCompact(risk.avg) : money.formatCompact(0)}
                sub={
                  risk.included > 0
                    ? t`${risk.included} of ${risk.included + risk.excluded} trades`
                    : t`no stops recorded`
                }
                tone={risk.avg != null ? 'accent' : 'muted'}
              />
            </View>
            <AreaChart data={ddData} xDataKey="i" aspectRatio={2.1}>
              <AreaChart.Grid />
              <AreaChart.Area dataKey="depth" color={palette.loss} />
              <AreaChart.YAxis ticks={3} format={(v) => money.formatCompact(-v)} />
              <AreaChart.Tooltip
                color={palette.loss}
                formatValue={(v) => money.formatCompact(-v)}
                formatX={() => t`Below peak`}
              />
            </AreaChart>
            <Text className="text-xs text-muted-foreground">
              {t`Distance below the running equity peak.`}
            </Text>
          </>
        )}
      </DashboardCard>

      <DashboardCard title={t`Rule compliance`}>
        {compliance.isLoading ? (
          <Skeleton className="h-[200px] rounded-lg" label={t`Loading compliance`} />
        ) : compliance.error && compliance.data == null ? (
          <InlineError error={compliance.error} onRetry={() => void compliance.refetch()} />
        ) : !report?.rules_configured ? (
          <>
            <Text className="py-2 text-[13px] text-muted-foreground">
              {t`No risk rules configured — set max risk per trade and max daily loss to score every trading day against your own process.`}
            </Text>
            <Text
              className="text-[13px] font-medium text-foreground"
              onPress={() => router.navigate('/(tabs)/(settings)/risk-rules')}
            >
              {t`Open risk rules`} ›
            </Text>
          </>
        ) : (
          <>
            <View className="flex-row flex-wrap gap-2">
              <StatBar
                plain
                label={t`Adherence`}
                value={adherence != null ? formatPercentPoints(adherence * 100, 0) : '0%'}
                sub={t`${report.compliant_days} of ${scoredDays} days`}
                tone={adherence != null && adherence >= 0.8 ? 'pos' : 'amber'}
              />
              <StatBar
                plain
                label={t`P&L, rules followed`}
                value={money.formatCompact(report.compliant_pnl)}
                tone={report.compliant_pnl >= 0 ? 'pos' : 'neg'}
              />
              <StatBar
                plain
                label={t`P&L, rules broken`}
                value={money.formatCompact(report.breach_pnl)}
                tone={report.breach_pnl >= 0 ? 'pos' : 'neg'}
              />
              <StatBar
                plain
                label={t`Violations`}
                value={String(totalViolations)}
                sub={violationsSub}
                tone={totalViolations > 0 ? 'neg' : 'pos'}
              />
            </View>

            {report.unknown_risk > 0 ? (
              <Text className="text-xs text-muted-foreground">
                {t`${report.unknown_risk} trades had no recorded initial risk and could not be scored against the per-trade rule.`}
              </Text>
            ) : null}

            {recentBreaches.length > 0 ? (
              <View className="gap-1">
                <MicroHeading>{t`Recent breach days`}</MicroHeading>
                {recentBreaches.map((day) => (
                  <EventRow
                    key={day.date}
                    date={day.date}
                    title={t`${day.trades} trades`}
                    pill={
                      day.daily_loss_breach
                        ? t`daily loss`
                        : day.trade_limit_breach
                          ? t`over-traded`
                          : day.loss_streak_breach
                            ? t`loss streak`
                            : t`over-risked ×${day.risk_violations}`
                    }
                    pillTone="neg"
                    value={money.formatCompact(day.net_pnl)}
                    valueTint={pnlColor(palette, day.net_pnl)}
                    onPress={() => router.push(`/(tabs)/(calendar)/day/${day.date}`)}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
      </DashboardCard>

      <MonteCarloCard ctx={ctx} />
    </SectionScaffold>
  );
}

/**
 * Bootstrap-resampled equity fan (web ReportsMonteCarlo parity). PanelUI has
 * no band/range area, so the p05–p95 envelope draws as dashed percentile
 * lines around the solid median instead of filled bands.
 */
function MonteCarloCard({ ctx }: { ctx: ReportsMoneyContext }) {
  const filters = useReportsFilters();
  const mc = useMonteCarlo(filters);
  const { money } = ctx;
  const [primary, mutedForeground] = useCSSVariable([
    '--color-primary',
    '--color-muted-foreground',
  ]) as [string, string];

  const sim = mc.data;
  const fan = (sim?.steps ?? []).map((band) => ({
    n: band.n,
    p05: money.display(band.p05),
    p25: money.display(band.p25),
    median: money.display(band.p50),
    p75: money.display(band.p75),
    p95: money.display(band.p95),
  }));

  return (
    <DashboardCard title={t`Monte Carlo`}>
      {mc.isLoading ? (
        <Skeleton className="h-[240px] rounded-lg" />
      ) : mc.error && sim == null ? (
        <InlineError error={mc.error} onRetry={() => void mc.refetch()} />
      ) : !sim || sim.insufficient_data ? (
        <Text className="py-4 text-[13px] text-muted-foreground">
          {t`The simulation needs at least 10 closed trades to resample.`}
        </Text>
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2">
            <StatBar
              plain
              label={t`Median outcome`}
              value={money.format(sim.terminal.p50)}
              sub={t`over the next ${sim.horizon} trades`}
              tone={sim.terminal.p50 >= 0 ? 'pos' : 'neg'}
            />
            <StatBar
              plain
              label={t`Best case`}
              value={money.format(sim.terminal.p95)}
              sub={t`95th percentile`}
              tone={sim.terminal.p95 > 0 ? 'pos' : 'muted'}
            />
            <StatBar
              plain
              label={t`Worst case`}
              value={money.format(sim.terminal.p05)}
              sub={t`5th percentile`}
              tone={sim.terminal.p05 < 0 ? 'neg' : 'muted'}
            />
            <StatBar
              plain
              label={t`Typical max drawdown`}
              value={money.format(-sim.max_drawdown.p50)}
              sub={t`1 in 20 worse than ${money.formatCompact(-sim.max_drawdown.p95)}`}
              tone="neg"
            />
            <StatBar
              plain
              label={t`Chance of profit`}
              value={formatPercent(1 - sim.terminal.prob_negative)}
              sub={t`paths ending above zero`}
              tone={sim.terminal.prob_negative > 0.25 ? 'neg' : 'pos'}
            />
            <StatBar
              plain
              label={t`Risk of ruin`}
              value={formatPercent(sim.risk_of_ruin)}
              sub={t`drawdown ≥ ${money.formatCompact(-sim.ruin_threshold)}`}
              tone={sim.risk_of_ruin > 0.1 ? 'neg' : 'muted'}
            />
          </View>

          {fan.length > 1 ? (
            <LineChart data={fan} xDataKey="n" aspectRatio={1.9}>
              <LineChart.Grid />
              <LineChart.Line dataKey="p95" color={mutedForeground} strokeWidth={1} dashArray="4,4" />
              <LineChart.Line dataKey="p75" color={mutedForeground} strokeWidth={1} />
              <LineChart.Line dataKey="median" color={primary} strokeWidth={1.5} />
              <LineChart.Line dataKey="p25" color={mutedForeground} strokeWidth={1} />
              <LineChart.Line dataKey="p05" color={mutedForeground} strokeWidth={1} dashArray="4,4" />
            </LineChart>
          ) : null}

          <Text className="text-[11px] leading-relaxed text-muted-foreground">
            {t`${sim.paths} resamples of your ${sim.trades} closed trades' net P&L — assumes each trade is an independent draw from your history, so streaks and changing conditions are understated.`}
          </Text>
        </>
      )}
    </DashboardCard>
  );
}
