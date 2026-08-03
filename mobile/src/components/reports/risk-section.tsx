import { Chart, Host } from '@expo/ui/swift-ui';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useCompliance, useEquityCurve, useTrades } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { Skeleton } from '@/components/skeleton';
import { StatBar } from '@/components/stat-bar';
import { EventRow, MicroHeading } from '@/components/reports/shared';
import {
  SectionScaffold,
  useReportsFilters,
  useReportsMoney,
  type SectionOption,
} from '@/components/reports/section-scaffold';
import { t } from '@lingui/core/macro';
import type { ReportsSection } from '@/app/(tabs)/(reports)/index';
import { formatPercentPoints } from '@/lib/format';
import {
  avgRiskPerTrade,
  currentDrawdownPct,
  drawdownSeries,
  maxDrawdownPct,
} from '@/lib/reports-analytics';
import { pnlColor } from '@/styles/unistyles';

/** Downsampling cap for the drawdown curve. */
const MAX_POINTS = 120;

export function RiskSection({
  sections,
  section,
  onSection,
}: {
  sections: SectionOption[];
  section: ReportsSection;
  onSection: (section: ReportsSection) => void;
}) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const filters = useReportsFilters();
  const ctx = useReportsMoney();
  const { money } = ctx;

  const equity = useEquityCurve(filters);
  const trades = useTrades(filters);
  const compliance = useCompliance(filters);

  const points = useMemo(() => equity.data?.points ?? [], [equity.data]);
  const ddSeries = useMemo(() => {
    const series = drawdownSeries(points);
    if (series.length <= MAX_POINTS) return series;
    const step = series.length / MAX_POINTS;
    const sampled = [];
    for (let i = 0; i < MAX_POINTS - 1; i++) sampled.push(series[Math.floor(i * step)]);
    sampled.push(series[series.length - 1]);
    return sampled;
  }, [points]);

  const maxDd = maxDrawdownPct(points);
  const currentDd = currentDrawdownPct(points);
  const risk = avgRiskPerTrade(trades.data ?? []);

  const ddData = ddSeries.map((point, index) => ({ x: index, y: point.drawdownPct * 100 }));

  const report = compliance.data;
  const scoredDays = report ? report.compliant_days + report.breach_days : 0;
  const adherence = report && scoredDays > 0 ? report.compliant_days / scoredDays : null;
  const recentBreaches = report
    ? report.days.filter((day) => !day.compliant).slice(-6).reverse()
    : [];

  return (
    <SectionScaffold
      sections={sections}
      section={section}
      onSection={onSection}
      refreshing={equity.isRefetching || compliance.isRefetching}
    >
      <DashboardCard title={t`Drawdown`}>
        {equity.isLoading ? (
          <Skeleton style={styles.chart} />
        ) : points.length === 0 ? (
          <Text style={styles.empty}>{t`No equity data in this range.`}</Text>
        ) : (
          <>
            <View style={styles.grid}>
              <StatBar
                label={t`Max drawdown`}
                value={formatPercentPoints(maxDd * 100, 1)}
                tone={maxDd < 0 ? 'neg' : 'muted'}
              />
              <StatBar
                label={t`Current drawdown`}
                value={formatPercentPoints(currentDd * 100, 1)}
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
            <Host style={styles.chart}>
              <Chart
                data={ddData}
                type="area"
                animate
                lineStyle={{ color: theme.colors.loss, width: 2 }}
              />
            </Host>
            <Text style={styles.footnote}>
              {t`Distance from the running equity peak, as a percentage.`}
            </Text>
          </>
        )}
      </DashboardCard>

      <DashboardCard title={t`Rule compliance`}>
        {compliance.isLoading ? (
          <Skeleton style={styles.listSkeleton} />
        ) : compliance.error ? (
          <Text style={styles.empty}>{t`Failed to load compliance.`}</Text>
        ) : !report?.rules_configured ? (
          <>
            <Text style={styles.empty}>
              {t`No risk rules configured — set max risk per trade and max daily loss to score every trading day against your own process.`}
            </Text>
            <Text style={styles.link} onPress={() => router.navigate('/(tabs)/(settings)/risk-rules')}>
              {t`Open risk rules`} ›
            </Text>
          </>
        ) : (
          <>
            <View style={styles.grid}>
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
                value={String(report.risk_violations + report.daily_loss_breaches)}
                sub={t`${report.risk_violations} over-risked · ${report.daily_loss_breaches} daily-loss`}
                tone={report.risk_violations + report.daily_loss_breaches > 0 ? 'neg' : 'pos'}
              />
            </View>

            {report.unknown_risk > 0 ? (
              <Text style={styles.footnote}>
                {t`${report.unknown_risk} trades had no recorded initial risk and could not be scored against the per-trade rule.`}
              </Text>
            ) : null}

            {recentBreaches.length > 0 ? (
              <View style={styles.rows}>
                <MicroHeading>{t`Recent breach days`}</MicroHeading>
                {recentBreaches.map((day) => (
                  <EventRow
                    key={day.date}
                    date={day.date}
                    title={t`${day.trades} trades`}
                    pill={
                      day.daily_loss_breach
                        ? t`daily loss`
                        : t`over-risked ×${day.risk_violations}`
                    }
                    pillTone="neg"
                    value={money.formatCompact(day.net_pnl)}
                    valueTint={pnlColor(theme.colors, day.net_pnl)}
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

const styles = StyleSheet.create((theme) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chart: { height: 170 },
  rows: { gap: theme.spacing.xs },
  listSkeleton: { height: 200, borderRadius: theme.radius.lg },
  empty: { fontSize: 13, color: theme.colors.mutedForeground, paddingVertical: theme.spacing.sm },
  footnote: { fontSize: 12, color: theme.colors.mutedForeground },
  link: { fontSize: 13, fontWeight: '500', color: theme.colors.foreground },
}));
