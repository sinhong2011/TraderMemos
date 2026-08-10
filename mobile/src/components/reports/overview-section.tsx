import {
  Chart,
  Gauge,
  Text as UIText,
} from '@expo/ui/swift-ui';
import { font, gaugeStyle, tint } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  useAccounts,
  useAnnualGoal,
  useBreakdown,
  useEquityCurve,
  useRSummary,
  useSummary,
  useTrades,
  type BreakdownDim,
} from '@/api/hooks';
import type { RSummary, Summary } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { EquityCard } from '@/components/equity-card';
import { ErrorState, InlineError } from '@/components/error-state';
import { GoalCard } from '@/components/goal-card';
import { Segmented } from '@/components/segmented';
import { Skeleton } from '@/components/skeleton';
import { StatBar } from '@/components/stat-bar';
import {
  SectionScaffold,
  useReportsFilters,
  useReportsMoney,
  type ReportsMoneyContext,
} from '@/components/reports/section-scaffold';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { formatPercent, formatRatio } from '@/lib/format';
import { gradeFromInt } from '@/lib/journal';
import { buildReportsDayStrip, sqnBand } from '@/lib/reports-display';
import { pnlColor } from '@/styles/unistyles';
import { AppHost } from '@/components/app-host';

// ---------------------------------------------------------------------------
// Summary bento
// ---------------------------------------------------------------------------

function sqnBandLabel(sqn: number): string {
  switch (sqnBand(sqn)) {
    case 'superb':
      return t`superb`;
    case 'excellent':
      return t`excellent`;
    case 'good':
      return t`good`;
    case 'average':
      return t`average`;
    case 'below':
      return t`below average`;
    default:
      return t`poor`;
  }
}

/** Hero + edge quality + key stats — the web ReportsSummaryBento, tiled for a phone. */
function SummaryCard({ summary, ctx }: { summary: Summary; ctx: ReportsMoneyContext }) {
  const { theme } = useUnistyles();
  const { money } = ctx;
  const pnl = money.pnl(summary);
  const median = money.avgMode === 'median';

  const grossBasis = summary.gross_pnl ?? summary.net_pnl + summary.total_fees;
  const feePct = grossBasis !== 0 ? summary.total_fees / Math.abs(grossBasis) : 0;
  const payoff = summary.avg_loss > 0 ? summary.avg_win / summary.avg_loss : Infinity;
  const pf = summary.profit_factor;
  const winRate = summary.win_rate;

  const avgTrade = median ? summary.median_trade : summary.avg_trade;
  const avgWin = median ? summary.median_win : summary.avg_win;
  const avgLoss = median ? summary.median_loss : summary.avg_loss;

  // Half-Kelly is the actionable number — full Kelly overshoots real edges.
  const kelly = summary.kelly_pct;
  const sqn = summary.sqn;
  const sqnDefined = summary.total_trades >= 2 && sqn !== 0;

  const donutData = [
    { x: t`Wins`, y: summary.wins, color: theme.colors.profit },
    { x: t`Losses`, y: summary.losses, color: theme.colors.loss },
    ...(summary.breakeven > 0
      ? [{ x: t`Wash`, y: summary.breakeven, color: theme.colors.flat }]
      : []),
  ].filter((slice) => slice.y > 0);

  return (
    <DashboardCard
      title={money.pnlMode === 'gross' ? t`Performance — gross` : t`Performance`}
      flush
    >
      <View style={styles.hero}>
        <Text selectable style={[styles.heroValue, { color: pnlColor(theme.colors, pnl) }]}>
          {money.format(pnl)}
        </Text>
        <Text style={styles.heroCaption}>
          {t`${summary.total_trades} trades · Fees ${money.format(-summary.total_fees)} · Expectancy ${money.format(summary.expectancy)}`}
        </Text>
      </View>

      {/* Edge row: native gauge for PF, donut for the W/L split. */}
      <View style={styles.edgeRow}>
        <View style={styles.edgeCell}>
          <Text style={styles.edgeLabel}>{t`Profit factor`}</Text>
          <AppHost style={styles.donut}>
            {/* A PF of 3 fills the ring — beyond that the edge is proven. */}
            <Gauge
              value={Math.min(1, Number.isFinite(pf) ? pf / 3 : 1)}
              modifiers={[
                gaugeStyle('circularCapacity'),
                tint(pf >= 1 ? theme.colors.profit : theme.colors.loss),
              ]}
              currentValueLabel={
                <UIText modifiers={[font({ size: 15, weight: 'semibold', design: 'rounded' })]}>
                  {formatRatio(pf)}
                </UIText>
              }
            />
          </AppHost>
          <Text style={styles.edgeSubCaption}>{t`gross profit ÷ gross loss`}</Text>
        </View>
        <View style={styles.edgeCell}>
          <Text style={styles.edgeLabel}>{t`Win rate`}</Text>
          {donutData.length > 0 ? (
            <AppHost style={styles.donut}>
              <Chart data={donutData} type="pie" pieStyle={{ innerRadius: 0.62, angularInset: 1.5 }} />
            </AppHost>
          ) : (
            <View style={styles.donut} />
          )}
          <Text style={styles.edgeValue}>
            {formatPercent(winRate)}
            <Text style={styles.edgeSub}> · {t`${summary.wins}W ${summary.losses}L`}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <StatBar
          label={median ? t`Median win` : t`Avg win`}
          value={money.format(avgWin)}
          tone="pos"
        />
        <StatBar
          label={median ? t`Median loss` : t`Avg loss`}
          value={money.format(-avgLoss)}
          tone="neg"
        />
        <StatBar
          label={t`Payoff ratio`}
          value={formatRatio(payoff)}
          sub={t`win ÷ loss`}
          tone={payoff >= 1 ? 'pos' : 'neg'}
        />
        <StatBar
          label={median ? t`Median trade` : t`Avg trade`}
          value={money.format(avgTrade)}
          tone={avgTrade >= 0 ? 'pos' : 'neg'}
        />
        <StatBar
          label={t`Largest win`}
          value={money.format(summary.largest_win)}
          tone="pos"
        />
        <StatBar
          label={t`Largest loss`}
          value={money.format(-summary.largest_loss)}
          tone="neg"
        />
        <StatBar
          label={t`Kelly (half)`}
          value={formatPercent(kelly / 2)}
          sub={t`suggested risk`}
          tone={kelly > 0 ? 'accent' : 'muted'}
        />
        <StatBar
          label={t`SQN`}
          value={sqnDefined ? sqn.toFixed(2) : '0.00'}
          sub={sqnDefined ? sqnBandLabel(sqn) : t`needs 2+ trades`}
          tone={sqn >= 2 ? 'pos' : sqn >= 1 ? 'amber' : 'muted'}
        />
        <StatBar
          label={t`Fees`}
          value={money.format(-summary.total_fees)}
          sub={formatPercent(feePct)}
          tone="muted"
        />
        <StatBar label={t`Wash`} value={String(summary.breakeven)} tone="muted" />
      </View>
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------
// Day strip
// ---------------------------------------------------------------------------

function DayStripCard({ ctx }: { ctx: ReportsMoneyContext }) {
  const { theme } = useUnistyles();
  const filters = useReportsFilters();
  const trades = useTrades(filters);
  const days = buildReportsDayStrip(trades.data ?? [], ctx.money.tradePnl);

  if (trades.isLoading) return <Skeleton style={styles.stripSkeleton} />;
  // Ahead of the `days.length === 0` bail-out: this card hides itself when there
  // is genuinely nothing to strip, which would swallow the failure whole. With
  // trades in the cache the strip still draws, so only a bare failure surfaces.
  if (trades.error && trades.data == null) {
    return (
      <DashboardCard title={t`Trading days`}>
        <InlineError error={trades.error} onRetry={() => void trades.refetch()} />
      </DashboardCard>
    );
  }
  if (days.length === 0) return null;

  return (
    <DashboardCard title={t`Trading days`}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        style={styles.stripRail}
      >
        {days.map((day) => {
          const dow = new Date(`${day.date}T12:00:00Z`).getUTCDay();
          const isWeekend = dow === 0 || dow === 6;
          const label = new Date(`${day.date}T12:00:00Z`).toLocaleDateString(locale, {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          });
          return (
            <View key={day.date} style={[styles.dayCell, isWeekend && styles.dayCellWeekend]}>
              <Text style={styles.dayLabel}>{label}</Text>
              <Text
                style={[styles.dayPnl, { color: pnlColor(theme.colors, day.pnl) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {ctx.money.formatCompact(day.pnl)}
              </Text>
              <Text style={styles.dayTrades}>{t`${day.trades} trades`}</Text>
            </View>
          );
        })}
      </ScrollView>
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------
// Playbook & leaks breakdown
// ---------------------------------------------------------------------------

const MAX_BARS = 8;
const MAX_ROWS = 6;

function BreakdownRows({
  dim,
  ctx,
  emptyLabel,
}: {
  dim: BreakdownDim;
  ctx: ReportsMoneyContext;
  emptyLabel: string;
}) {
  const { theme } = useUnistyles();
  const filters = useReportsFilters();
  const breakdown = useBreakdown(dim, filters);
  const { money } = ctx;

  if (breakdown.isLoading) return <Skeleton style={styles.chart} />;
  if (breakdown.error && breakdown.data == null) {
    return <InlineError error={breakdown.error} onRetry={() => void breakdown.refetch()} />;
  }

  const groups = breakdown.data ?? [];
  if (groups.length === 0) return <Text style={styles.empty}>{emptyLabel}</Text>;

  const chartData = groups.slice(0, MAX_BARS).map((group) => {
    const value = money.display(money.pnl(group.summary));
    return {
      x: group.key.length > 8 ? `${group.key.slice(0, 7)}…` : group.key,
      y: value,
      color: value >= 0 ? theme.colors.profit : theme.colors.loss,
    };
  });

  return (
    <>
      <AppHost style={styles.chart}>
        <Chart data={chartData} type="bar" showGrid animate barStyle={{ cornerRadius: 2 }} />
      </AppHost>
      <View style={styles.rows}>
        {groups.slice(0, MAX_ROWS).map((group) => {
          const value = money.pnl(group.summary);
          return (
            <View key={group.key} style={styles.row}>
              <Text style={styles.rowKey} numberOfLines={1}>
                {group.key}
              </Text>
              <Text style={styles.rowMeta}>
                {t`${group.summary.total_trades} trades`} ·{' '}
                {formatPercent(group.summary.win_rate)}
              </Text>
              <Text style={[styles.rowValue, { color: pnlColor(theme.colors, value) }]}>
                {money.formatCompact(value)}
              </Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

function PlaybookCard({ ctx }: { ctx: ReportsMoneyContext }) {
  const [dim, setDim] = useState<BreakdownDim>('setup');
  const dims = [
    { value: 'setup' as const, label: t`Setup` },
    { value: 'mistake' as const, label: t`Mistake` },
  ];
  return (
    <DashboardCard
      title={t`Playbook & leaks`}
      control={<Segmented options={dims} value={dim} onChange={setDim} />}
    >
      <BreakdownRows
        dim={dim}
        ctx={ctx}
        emptyLabel={dim === 'setup' ? t`No setups traded in this range.` : t`No mistakes tagged.`}
      />
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------
// R-multiple performance
// ---------------------------------------------------------------------------

function fmtR(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}R`;
}

function RMultipleCard({ rSummary }: { rSummary: RSummary }) {
  const { theme } = useUnistyles();
  const included = rSummary.total_trades;
  const total = included + rSummary.excluded;

  if (included === 0) {
    return (
      <DashboardCard title={t`R-multiple`}>
        <Text style={styles.empty}>
          {t`No trades with a knowable initial risk — set stops to unlock R analytics.`}
        </Text>
      </DashboardCard>
    );
  }

  const distribution = rSummary.distribution.map((bucket) => ({
    x: bucket.label,
    y: bucket.count,
    color: bucket.from < 0 ? theme.colors.loss : theme.colors.profit,
  }));

  return (
    <DashboardCard title={t`R-multiple`} flush>
      <View style={styles.grid}>
        <StatBar
          label={t`Avg R / trade`}
          value={fmtR(rSummary.avg_r)}
          sub={t`${included} of ${total} trades`}
          tone={rSummary.avg_r >= 0 ? 'pos' : 'neg'}
        />
        <StatBar label={t`Avg winning R`} value={fmtR(rSummary.avg_win_r)} tone="pos" />
        <StatBar label={t`Avg losing R`} value={fmtR(-rSummary.avg_loss_r)} tone="neg" />
        <StatBar
          label={t`Best / worst`}
          value={fmtR(rSummary.best_r)}
          sub={fmtR(rSummary.worst_r)}
        />
      </View>
      <AppHost style={styles.chart}>
        <Chart data={distribution} type="bar" showGrid animate barStyle={{ cornerRadius: 2 }} />
      </AppHost>
      {rSummary.excluded > 0 ? (
        <Text style={styles.footnote}>
          {t`${rSummary.excluded} closed trades excluded (no stop recorded).`}
        </Text>
      ) : null}
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------
// Execution grade
// ---------------------------------------------------------------------------

function ExecutionGradeCard({ ctx }: { ctx: ReportsMoneyContext }) {
  const { theme } = useUnistyles();
  const filters = useReportsFilters();
  const breakdown = useBreakdown('trade_quality', filters);
  const { money } = ctx;

  if (breakdown.isLoading) return <Skeleton style={styles.gradeSkeleton} />;
  // Split from the length check below: hiding the card is right for "nobody
  // grades their trades", wrong for "the grades didn't load and weren't cached".
  if (breakdown.error && breakdown.data == null) {
    return (
      <DashboardCard title={t`Execution grade`}>
        <InlineError error={breakdown.error} onRetry={() => void breakdown.refetch()} />
      </DashboardCard>
    );
  }
  if ((breakdown.data ?? []).length === 0) return null;

  // A+ first, unrated last — grade rank, not P&L, orders this card.
  const rank = (key: string) => {
    const n = Number(key);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? 5 - n : 6;
  };
  const groups = [...(breakdown.data ?? [])].sort((a, b) => rank(a.key) - rank(b.key));
  const maxAbs = Math.max(...groups.map((g) => Math.abs(money.pnl(g.summary))), 1);

  return (
    <DashboardCard title={t`Execution grade`}>
      <View style={styles.rows}>
        {groups.map((group) => {
          const value = money.pnl(group.summary);
          const grade = gradeFromInt(Number(group.key));
          return (
            <View key={group.key} style={styles.gradeRow}>
              <Text style={styles.gradeLabel}>{grade || t`Unrated`}</Text>
              <View style={styles.gradeBarTrack}>
                <View
                  style={[
                    styles.gradeBarFill,
                    {
                      width: `${Math.max(4, (Math.abs(value) / maxAbs) * 100)}%`,
                      backgroundColor: pnlColor(theme.colors, value),
                    },
                  ]}
                />
              </View>
              <View style={styles.gradeMeta}>
                <Text style={[styles.rowValue, { color: pnlColor(theme.colors, value) }]}>
                  {money.formatCompact(value)}
                </Text>
                <Text style={styles.rowMeta}>
                  {t`${group.summary.wins}W ${group.summary.losses}L`} · PF{' '}
                  {formatRatio(group.summary.profit_factor)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export function OverviewSection({
  onScrolledChange,
}: {
  onScrolledChange?: (scrolled: boolean) => void;
}) {
  const filters = useReportsFilters();
  const ctx = useReportsMoney();
  const summary = useSummary(filters);
  const rSummary = useRSummary(filters);
  const equity = useEquityCurve(filters);
  const accounts = useAccounts();
  const year = new Date().getFullYear();
  const goal = useAnnualGoal(year);
  const ytd = useSummary({ ...filters, from: `${year}-01-01T00:00:00Z` });
  void accounts;

  const refreshing = summary.isRefetching || equity.isRefetching;

  return (
    <SectionScaffold refreshing={refreshing} onScrolledChange={onScrolledChange}>
      {summary.isLoading ? (
        <>
          <Skeleton style={styles.skeletonTall} />
          <Skeleton style={styles.skeletonCard} />
        </>
      ) : summary.error && summary.data == null ? (
        // Boxed rather than flexed: the scaffold's scroll content has no height
        // of its own, so a `flex: 1` failure state would collapse to nothing.
        <View style={styles.errorHost}>
          <ErrorState
            error={summary.error}
            onRetry={() => void summary.refetch()}
            retrying={summary.isRefetching}
          />
        </View>
      ) : summary.data ? (
        <>
          {/* The curve leads, as on Home: the shape of the account answers
              "how am I doing" faster than the aggregates below it. */}
          {equity.data ? (
            <EquityCard curve={equity.data} currency={ctx.currency} fxRate={ctx.fxRate} />
          ) : equity.isLoading ? (
            <Skeleton style={styles.skeletonCard} />
          ) : null}

          <SummaryCard summary={summary.data} ctx={ctx} />

          <DayStripCard ctx={ctx} />

          {goal.data?.amount != null && ytd.data ? (
            <GoalCard
              year={year}
              goalAmount={goal.data.amount}
              ytdNetPnl={ytd.data.net_pnl}
              currency={ctx.currency}
              fxRate={ctx.fxRate}
            />
          ) : null}

          <PlaybookCard ctx={ctx} />

          {rSummary.data ? <RMultipleCard rSummary={rSummary.data} /> : null}

          <ExecutionGradeCard ctx={ctx} />

          <ExploreCard />
        </>
      ) : null}
    </SectionScaffold>
  );
}

/** Deep-dive screens pushed from Reports — one row each, App Store style. */
function ExploreCard() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const links = [
    // The economic calendar lives on the Home tools menu — it's a start-of-day
    // lookup, not a review of what already happened.
    {
      href: '/(tabs)/(dashboard)/wrapped' as const,
      icon: 'sparkles' as const,
      label: t`Year Wrapped`,
    },
  ];
  return (
    <DashboardCard title={t`Explore`}>
      <View style={styles.exploreRows}>
        {links.map((link) => (
          <Pressable
            key={link.href}
            onPress={() => router.push(link.href)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.exploreRow, pressed && styles.explorePressed]}
          >
            <SymbolView name={link.icon} size={18} tintColor={theme.colors.accent} />
            <Text style={styles.exploreLabel}>{link.label}</Text>
            <SymbolView name="chevron.right" size={12} tintColor={theme.colors.mutedForeground} />
          </Pressable>
        ))}
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  // Own surface: the card around it is `flush` so the tiles below sit on the
  // page, but the headline is a statement rather than a tile.
  hero: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
    boxShadow: theme.shadows.card,
  },
  heroValue: { fontSize: 34, fontWeight: '600', letterSpacing: -1, ...theme.numeric },
  heroCaption: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  edgeRow: { flexDirection: 'row', gap: theme.spacing.sm },
  // Same surface as StatBar — these sit in the same grid, and a grey fill here
  // against white tiles below split the screen down the middle.
  edgeCell: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.card,
    boxShadow: theme.shadows.card,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  edgeLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.mutedForeground,
    letterSpacing: 0.3,
  },
  edgeValue: { fontSize: 16, fontWeight: '600', color: theme.colors.foreground, ...theme.numeric },
  edgeSub: { fontSize: 12, fontWeight: '400', color: theme.colors.mutedForeground },
  edgeSubCaption: { fontSize: 10, color: theme.colors.mutedForeground },
  donut: { width: 84, height: 84 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chart: { height: 200 },
  rows: { gap: theme.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm },
  rowKey: { flexShrink: 1, fontSize: 14, fontWeight: '500', color: theme.colors.foreground },
  rowMeta: { flex: 1, fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  rowValue: { fontSize: 14, fontWeight: '600', ...theme.numeric },
  footnote: { fontSize: 12, color: theme.colors.mutedForeground },
  empty: { fontSize: 13, color: theme.colors.mutedForeground, paddingVertical: theme.spacing.lg },
  stripRail: { flexGrow: 0, marginHorizontal: -theme.spacing.lg },
  strip: { gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg },
  stripSkeleton: { height: 96, borderRadius: theme.radius.lg },
  dayCell: {
    width: 92,
    gap: 2,
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.sm + 2,
  },
  dayCellWeekend: { opacity: 0.6 },
  dayLabel: { fontSize: 10, fontWeight: '500', color: theme.colors.mutedForeground },
  dayPnl: { fontSize: 14, fontWeight: '600', ...theme.numeric },
  dayTrades: { fontSize: 10, color: theme.colors.mutedForeground, ...theme.numeric },
  gradeRow: { gap: theme.spacing.xs },
  gradeLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.foreground },
  gradeBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.muted,
    overflow: 'hidden',
  },
  gradeBarFill: { height: '100%', borderRadius: 3 },
  gradeMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  gradeSkeleton: { height: 160, borderRadius: theme.radius.lg },
  exploreRows: { gap: 2 },
  exploreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
  },
  explorePressed: { opacity: 0.6 },
  exploreLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.foreground },
  skeletonTall: { height: 320, borderRadius: theme.radius.lg + 4 },
  skeletonCard: { height: 200, borderRadius: theme.radius.lg + 4 },
  errorHost: { minHeight: 320 },
}));
