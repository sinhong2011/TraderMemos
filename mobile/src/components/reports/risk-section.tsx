import { useRouter } from 'expo-router';
import { AreaChart, Skeleton } from 'panelui-native';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { useCompliance, useEquityCurve, useTrades } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { InlineError } from '@/components/error-state';
import { StatBar } from '@/components/stat-bar';
import { EventRow, MicroHeading } from '@/components/reports/shared';
import {
  SectionScaffold,
  useReportsFilters,
  useReportsMoney,
} from '@/components/reports/section-scaffold';
import { t } from '@lingui/core/macro';
import { formatPercentPoints } from '@/lib/format';
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
              <StatBar
                label={t`Max drawdown`}
                value={money.formatCompact(maxDd)}
                tone={maxDd < 0 ? 'neg' : 'muted'}
              />
              <StatBar
                label={t`Current drawdown`}
                value={money.formatCompact(currentDd)}
                sub={currentDd >= 0 ? t`at the highs` : undefined}
                tone={currentDd < 0 ? 'neg' : 'pos'}
              />
              <StatBar
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
                label={t`Adherence`}
                value={adherence != null ? formatPercentPoints(adherence * 100, 0) : '0%'}
                sub={t`${report.compliant_days} of ${scoredDays} days`}
                tone={adherence != null && adherence >= 0.8 ? 'pos' : 'amber'}
              />
              <StatBar
                label={t`P&L, rules followed`}
                value={money.formatCompact(report.compliant_pnl)}
                tone={report.compliant_pnl >= 0 ? 'pos' : 'neg'}
              />
              <StatBar
                label={t`P&L, rules broken`}
                value={money.formatCompact(report.breach_pnl)}
                tone={report.breach_pnl >= 0 ? 'pos' : 'neg'}
              />
              <StatBar
                label={t`Violations`}
                value={String(
                  report.risk_violations +
                    report.daily_loss_breaches +
                    report.trade_limit_breaches,
                )}
                sub={t`${report.risk_violations} over-risked · ${report.daily_loss_breaches} daily-loss · ${report.trade_limit_breaches} over-traded`}
                tone={
                  report.risk_violations +
                    report.daily_loss_breaches +
                    report.trade_limit_breaches >
                  0
                    ? 'neg'
                    : 'pos'
                }
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
    </SectionScaffold>
  );
}
