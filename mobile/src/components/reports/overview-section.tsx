import { useRouter } from 'expo-router';
import {
  BarChart,
  cn,
  LineChart,
  Meter,
  RadarChart,
  PieChart,
  RingChart,
  ScrollFade,
  Skeleton,
  Table,
  WaterfallChart,
  type PieDatum,
  type WaterfallDatum,
} from 'panelui-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import {
  useAccounts,
  useAnnualGoal,
  useBreakdown,
  useEquityCurve,
  useExecutionScore,
  useRSummary,
  useSummary,
  useTrades,
  type BreakdownDim,
} from '@/api/hooks';
import { Icon } from '@/components/icon';
import type { ExecScoreReport, RSummary, Summary } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { EquityCard } from '@/components/equity-card';
import { ErrorState, InlineError } from '@/components/error-state';
import { GoalCard } from '@/components/goal-card';
import { Segmented } from '@/components/segmented';
import { StatBar } from '@/components/stat-bar';
import { signedBars } from '@/components/reports/shared';
import { periodReturns } from '@/lib/reports-analytics';
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
import { pnlClass, pnlColor, usePnlPalette } from '@/styles/pnl';

// ---------------------------------------------------------------------------
// Summary bento
// ---------------------------------------------------------------------------

/** Diameter of the two edge dials — they sit side by side in one card row. */
const DIAL_SIZE = 84;
/** A PF of 3 fills the ring — beyond that the edge is proven. */
const PF_FULL = 3;

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
  const palette = usePnlPalette();
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

  const donutData: PieDatum[] = [
    { label: t`Wins`, value: summary.wins, color: palette.profit },
    { label: t`Losses`, value: summary.losses, color: palette.loss },
    ...(summary.breakeven > 0
      ? [{ label: t`Wash`, value: summary.breakeven, color: palette.flat }]
      : []),
  ].filter((slice) => slice.value > 0);

  return (
    <DashboardCard title={money.pnlMode === 'gross' ? t`Performance — gross` : t`Performance`} flush>
      {/* Own surface: the card around it is `flush` so the tiles below sit on
          the page, but the headline is a statement rather than a tile. */}
      <View className="items-center gap-1 rounded-lg bg-card p-4">
        <Text
          selectable
          className={cn('text-[34px] font-semibold tracking-[-1px] tabular-nums', pnlClass(pnl))}
        >
          {money.format(pnl)}
        </Text>
        <Text className="text-xs tabular-nums text-muted-foreground">
          {t`${summary.total_trades} trades · Fees ${money.format(-summary.total_fees)} · Expectancy ${money.format(summary.expectancy)}`}
        </Text>
      </View>

      {/* Edge row: a gauge for PF, a donut for the W/L split. Same `card`
          surface as StatBar — these sit in the same grid, and a grey fill here
          against white tiles below split the screen down the middle. */}
      <View className="flex-row gap-2">
        <View className="flex-1 items-center gap-1 rounded-md bg-card px-2 py-3">
          <Text className="text-[11px] font-medium tracking-[0.3px] text-muted-foreground">
            {t`Profit factor`}
          </Text>
          <RingChart
            data={[
              {
                label: t`Profit factor`,
                value: Math.min(PF_FULL, Number.isFinite(pf) ? pf : PF_FULL),
                maxValue: PF_FULL,
                color: pf >= 1 ? palette.profit : palette.loss,
              },
            ]}
            size={DIAL_SIZE}
            strokeWidth={10}
          >
            <RingChart.Ring index={0} />
            <RingChart.Center>
              {() => (
                <Text className="text-[15px] font-semibold tabular-nums text-foreground">
                  {formatRatio(pf)}
                </Text>
              )}
            </RingChart.Center>
          </RingChart>
          <Text className="text-[10px] text-muted-foreground">{t`gross profit ÷ gross loss`}</Text>
        </View>
        <View className="flex-1 items-center gap-1 rounded-md bg-card px-2 py-3">
          <Text className="text-[11px] font-medium tracking-[0.3px] text-muted-foreground">
            {t`Win rate`}
          </Text>
          {donutData.length > 0 ? (
            <PieChart data={donutData} size={DIAL_SIZE} innerRadius={0.62} padAngle={1.5}>
              <PieChart.Slices />
            </PieChart>
          ) : (
            <View style={{ width: DIAL_SIZE, height: DIAL_SIZE }} />
          )}
          <Text className="text-base font-semibold tabular-nums text-foreground">
            {formatPercent(winRate)}
            <Text className="text-xs font-normal text-muted-foreground">
              {' '}
              · {t`${summary.wins}W ${summary.losses}L`}
            </Text>
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <StatBar label={median ? t`Median win` : t`Avg win`} value={money.format(avgWin)} tone="pos" />
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
        <StatBar label={t`Largest win`} value={money.format(summary.largest_win)} tone="pos" />
        <StatBar label={t`Largest loss`} value={money.format(-summary.largest_loss)} tone="neg" />
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
  const filters = useReportsFilters();
  const trades = useTrades(filters);
  const days = buildReportsDayStrip(trades.data ?? [], ctx.money.tradePnl);
  // The strip sits on the card surface, so the edge fades must resolve to it —
  // ScrollFade's default is the page background.
  const [card] = useCSSVariable(['--color-card']) as [string];

  if (trades.isLoading) return <Skeleton className="h-24 rounded-lg" />;
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
      {/* The end fade doubles as the "there's more" affordance the cut-off
          tile used to carry alone. */}
      <ScrollFade orientation="horizontal" color={card} size={24} className="-mx-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Bleeds to the card edges so the rail reads as scrollable content.
          className="grow-0"
          contentContainerClassName="gap-2 px-4"
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
              <View
                key={day.date}
                className={cn(
                  'w-[92px] gap-0.5 rounded-md bg-muted px-2.5 py-2.5',
                  isWeekend && 'opacity-60',
                )}
              >
                <Text className="text-[10px] font-medium text-muted-foreground">{label}</Text>
                <Text
                  className={cn('text-sm font-semibold tabular-nums', pnlClass(day.pnl))}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {ctx.money.formatCompact(day.pnl)}
                </Text>
                <Text className="text-[10px] tabular-nums text-muted-foreground">{t`${day.trades} trades`}</Text>
              </View>
            );
          })}
        </ScrollView>
      </ScrollFade>
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------
// Monthly P&L bridge
// ---------------------------------------------------------------------------

/**
 * Bars a phone plot fits before the axis labels collide: the XAxis tiles one
 * label box per band, so past ~10 bands even "Oct" ellipsizes.
 */
const MAX_BRIDGE_BUCKETS = 8;

/** How the period's P&L was built period by period, as a waterfall. */
function PnlBridgeCard({ ctx }: { ctx: ReportsMoneyContext }) {
  const palette = usePnlPalette();
  // Anchored totals are a verdict, not a win or a loss — brand blue, not P&L.
  const [totalColor] = useCSSVariable(['--color-chart-1']) as [string];
  const filters = useReportsFilters();
  const trades = useTrades(filters);
  const { money } = ctx;

  if (trades.isLoading) return <Skeleton className="h-[220px] rounded-lg" />;
  // Quiet on failure: DayStripCard above surfaces this same query's error.
  if (trades.data == null) return null;

  // Via the day strip so the bars follow the gross/net toggle (tradePnl is
  // mode-aware), which /analytics/daily is not.
  const days = buildReportsDayStrip(trades.data, money.tradePnl);
  const monthly = new Map<string, number>();
  // The strip arrives newest → oldest; a bridge reads oldest → newest.
  for (const day of [...days].reverse()) {
    const month = day.date.slice(0, 7);
    monthly.set(month, (monthly.get(month) ?? 0) + day.pnl);
  }
  const months = [...monthly.entries()];
  // One month has no bridge to draw.
  if (months.length < 2) return null;

  // Longer ranges step up to quarters instead of thinning month labels — the
  // period keeps its full shape and the labels stay short enough for a band.
  const byQuarter = months.length > MAX_BRIDGE_BUCKETS;
  let buckets = months;
  if (byQuarter) {
    const quarterly = new Map<string, number>();
    for (const [month, pnl] of months) {
      const quarter = `${month.slice(0, 4)}-Q${Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1}`;
      quarterly.set(quarter, (quarterly.get(quarter) ?? 0) + pnl);
    }
    buckets = [...quarterly.entries()];
  }

  const shown = buckets.slice(-MAX_BRIDGE_BUCKETS);
  const prior = buckets.slice(0, buckets.length - shown.length);
  const priorSum = prior.reduce((sum, [, pnl]) => sum + pnl, 0);

  const multiYear = new Set(shown.map(([key]) => key.slice(0, 4))).size > 1;
  // Years only where the bands have room for them — a truncated "Sep…" says
  // less than a bare "Sep".
  const withYear = multiYear && shown.length <= 6;
  const bucketLabel = (key: string) =>
    byQuarter
      ? `${key.slice(5)}${withYear ? ` ${key.slice(2, 4)}` : ''}`
      : new Date(`${key}-01T12:00:00Z`).toLocaleDateString(locale, {
          month: 'short',
          ...(withYear ? { year: '2-digit' as const } : {}),
          timeZone: 'UTC',
        });

  const data: WaterfallDatum[] = [
    // Older periods roll into one anchored opening bar rather than vanishing.
    ...(prior.length > 0 ? [{ label: t`Prior`, value: priorSum, total: true }] : []),
    ...shown.map(([key, pnl]) => ({ label: bucketLabel(key), value: pnl })),
    { label: t`Total`, value: 0, total: true },
  ];

  return (
    <DashboardCard title={t`P&L bridge`}>
      <WaterfallChart
        data={data}
        aspectRatio={1.7}
        riseColor={palette.profit}
        fallColor={palette.loss}
        totalColor={totalColor}
      >
        <WaterfallChart.Grid />
        <WaterfallChart.Connectors />
        <WaterfallChart.Bars />
        <WaterfallChart.XAxis />
        <WaterfallChart.Tooltip
          // An anchored bar's own `value` is its delta-from-zero bookkeeping;
          // the reading a finger wants there is the running total it stands at.
          formatValue={(step) => money.formatCompact(step.datum.total ? step.end : step.value)}
        />
      </WaterfallChart>
      {prior.length > 0 ? (
        <Text className="text-xs text-muted-foreground">
          {t`Earlier periods are rolled into Prior.`}
        </Text>
      ) : null}
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
  const palette = usePnlPalette();
  const filters = useReportsFilters();
  const breakdown = useBreakdown(dim, filters);
  const { money } = ctx;

  if (breakdown.isLoading) return <Skeleton className="h-[200px] rounded-lg" />;
  if (breakdown.error && breakdown.data == null) {
    return <InlineError error={breakdown.error} onRetry={() => void breakdown.refetch()} />;
  }

  const groups = breakdown.data ?? [];
  if (groups.length === 0) {
    return <Text className="py-4 text-[13px] text-muted-foreground">{emptyLabel}</Text>;
  }

  const chartData = groups
    .slice(0, MAX_BARS)
    .map((group) =>
      signedBars(
        group.key.length > 8 ? `${group.key.slice(0, 7)}…` : group.key,
        money.display(money.pnl(group.summary)),
      ),
    );

  return (
    <>
      <BarChart data={chartData} xDataKey="name" stacked aspectRatio={1.9} cornerRadius={2}>
        <BarChart.Grid />
        <BarChart.Bar dataKey="gain" color={palette.profit} />
        <BarChart.Bar dataKey="loss" color={palette.loss} />
        <BarChart.XAxis />
      </BarChart>
      {/* A column model, not per-row flex guessing: the trades·WR column had
          floated wherever each row's name let it, so nothing lined up. */}
      <Table size="sm" columns={[{ flex: 1.2 }, { flex: 1 }, { flex: 1, align: 'end' }]}>
        <Table.Body>
          {groups.slice(0, MAX_ROWS).map((group, index, rows) => {
            const value = money.pnl(group.summary);
            return (
              <Table.Row key={group.key} last={index === rows.length - 1}>
                <Table.Cell labelClassName="text-sm font-medium text-foreground">
                  {group.key}
                </Table.Cell>
                <Table.Cell labelClassName="tabular-nums text-muted-foreground">
                  {`${t`${group.summary.total_trades} trades`} · ${formatPercent(group.summary.win_rate)}`}
                </Table.Cell>
                <Table.Cell
                  labelClassName={cn('text-sm font-semibold tabular-nums', pnlClass(value))}
                >
                  {money.formatCompact(value)}
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
    </>
  );
}

// ---------------------------------------------------------------------------
// Period returns strip (web ReportsPeriodReturns parity)
// ---------------------------------------------------------------------------

function PeriodReturnsCard({ ctx }: { ctx: ReportsMoneyContext }) {
  const filters = useReportsFilters();
  const trades = useTrades(filters);
  const [unit, setUnit] = useState<'abs' | 'pct'>('abs');
  const palette = usePnlPalette();

  const pctEnabled = ctx.denominator > 0;
  const usePct = unit === 'pct' && pctEnabled;
  const returns = periodReturns(trades.data ?? [], ctx.money.tradePnl);
  if (trades.isLoading || returns === null) return null;

  const format = (raw: number) => {
    if (usePct) {
      const v = (raw * ctx.fxRate) / ctx.denominator;
      return `${v > 0 ? '+' : ''}${formatPercent(v)}`;
    }
    return ctx.money.formatCompact(raw);
  };

  const cells: { label: string; hint: string; value: number }[] = [
    { label: t`Daily`, hint: t`avg / traded day`, value: returns.daily },
    { label: t`Weekly`, hint: t`avg / traded week`, value: returns.weekly },
    { label: t`Monthly`, hint: t`avg / traded month`, value: returns.monthly },
    { label: t`Annualized`, hint: t`run rate / year`, value: returns.annualized },
  ];

  return (
    <DashboardCard
      title={t`Period returns`}
      control={
        pctEnabled ? (
          <Segmented
            bare
            options={[
              { value: 'abs', label: '$' },
              { value: 'pct', label: '%' },
            ]}
            value={unit}
            onChange={(v) => setUnit(v as 'abs' | 'pct')}
          />
        ) : undefined
      }
    >
      <View className="flex-row flex-wrap gap-2">
        {cells.map((cell) => (
          <View key={cell.label} className="min-w-[45%] flex-1 gap-0.5 rounded-xl bg-muted px-3 py-2.5">
            <Text className="text-[11px] font-medium text-muted-foreground">{cell.label}</Text>
            <Text
              className="text-[17px] font-semibold tabular-nums tracking-tight"
              style={{ color: pnlColor(palette, cell.value) }}
            >
              {format(cell.value)}
            </Text>
            <Text className="text-[10px] text-muted-foreground">{cell.hint}</Text>
          </View>
        ))}
      </View>
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------
// Execution score (web ReportsExecutionScore parity)
// ---------------------------------------------------------------------------

type ExecAxisKey = 'composite' | 'entry' | 'exit' | 'risk' | 'stability' | 'tempo';

function execAxes(): { key: ExecAxisKey; label: string; hint: string }[] {
  return [
    { key: 'composite', label: t`Composite`, hint: t`Weighted blend of the five axes below.` },
    {
      key: 'entry',
      label: t`Entry`,
      hint: t`How little heat entries take relative to the move they find (MAE vs MFE).`,
    },
    { key: 'exit', label: t`Exit`, hint: t`Share of each trade's peak open profit kept at the close.` },
    {
      key: 'risk',
      label: t`Risk`,
      hint: t`Risk journaled before the trade, blended with rule compliance when rules are set.`,
    },
    {
      key: 'stability',
      label: t`Stability`,
      hint: t`Consistency of results — average R per unit of variance.`,
    },
    {
      key: 'tempo',
      label: t`Tempo`,
      hint: t`Trades free of quick same-symbol re-entries and overtraded days.`,
    },
  ];
}

/** Quality band for a 0–100 score; drives the composite's caption. */
function execScoreBand(score: number): string {
  if (score >= 85) return t`excellent`;
  if (score >= 70) return t`strong`;
  if (score >= 55) return t`solid`;
  if (score >= 40) return t`uneven`;
  return t`weak`;
}

function execAxisScore(report: ExecScoreReport, key: ExecAxisKey): number | null {
  return key === 'composite' ? report.composite : report[key].score;
}

function ExecutionScoreCard() {
  const filters = useReportsFilters();
  const [bucket, setBucket] = useState<'week' | 'month'>('week');
  const [axis, setAxis] = useState<ExecAxisKey>('composite');
  const score = useExecutionScore(bucket, filters);
  const palette = usePnlPalette();
  const [primary, mutedForeground] = useCSSVariable([
    '--color-primary',
    '--color-muted-foreground',
  ]) as [string, string];

  const axes = execAxes();
  const selected = axes.find((a) => a.key === axis) ?? axes[0];
  const report = score.data;

  const tone = (value: number) =>
    value >= 70 ? palette.profit : value < 40 ? palette.loss : undefined;

  return (
    <DashboardCard
      title={t`Execution score`}
      control={
        <Segmented
          compact
          options={[
            { value: 'week', label: t`Weekly` },
            { value: 'month', label: t`Monthly` },
          ]}
          value={bucket}
          onChange={(v) => setBucket(v as 'week' | 'month')}
        />
      }
    >
      {score.isLoading ? (
        <Skeleton className="h-[260px] rounded-lg" />
      ) : score.error && report == null ? (
        <InlineError error={score.error} onRetry={() => void score.refetch()} />
      ) : !report || report.trades === 0 ? (
        <Text className="py-4 text-[13px] text-muted-foreground">
          {t`Add trades or adjust filters to see your score.`}
        </Text>
      ) : report.composite == null ? (
        <Text className="py-4 text-[13px] leading-relaxed text-muted-foreground">
          {t`Scores unlock at 5 closed trades — journaled risk and auto MAE/MFE sharpen every axis.`}
        </Text>
      ) : (
        <>
          <View className="items-center gap-0.5">
            <Text
              className="text-[40px] font-semibold tabular-nums tracking-tighter text-foreground"
              style={{ color: tone(report.composite) }}
            >
              {Math.round(report.composite)}
            </Text>
            <Text className="text-[11px] text-muted-foreground">
              {`${execScoreBand(report.composite)} · ${t`${report.trades} trades`}`}
            </Text>
          </View>

          {(() => {
            const radarData = axes
              .filter((a) => a.key !== 'composite')
              .map((a) => ({ axis: a.label, score: execAxisScore(report, a.key) }))
              .filter((d): d is { axis: string; score: number } => d.score != null);
            if (radarData.length < 3) {
              return (
                <Text className="px-4 py-2 text-center text-[11px] leading-relaxed text-muted-foreground">
                  {t`The radar needs at least three scored axes — journal initial risk and run auto MAE/MFE to light up the rest.`}
                </Text>
              );
            }
            return (
              <RadarChart data={radarData} axisKey="axis" domain={[0, 100]} aspectRatio={1.4}>
                <RadarChart.Grid />
                <RadarChart.Axis />
                <RadarChart.Series dataKey="score" showDots />
              </RadarChart>
            );
          })()}

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-1.5 py-1">
              {axes.map((a) => {
                const value = execAxisScore(report, a.key);
                const active = axis === a.key;
                return (
                  <Pressable
                    key={a.key}
                    disabled={value == null}
                    onPress={() => setAxis(a.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className={cn(
                      'flex-row items-baseline gap-1.5 rounded-lg px-2.5 py-1.5',
                      active ? 'bg-accent' : 'bg-muted',
                      value == null && 'opacity-50',
                    )}
                  >
                    <Text
                      className={cn(
                        'text-[11px] font-medium',
                        active ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {a.label}
                    </Text>
                    <Text
                      className="text-[11px] font-semibold tabular-nums text-foreground"
                      style={
                        value == null
                          ? { color: mutedForeground }
                          : tone(value) != null
                            ? { color: tone(value) }
                            : undefined
                      }
                    >
                      {value == null ? t`n/a` : String(Math.round(value))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {report.series.length > 1 ? (
            <LineChart
              data={report.series.map((point) => ({
                date: point.date,
                value: point[axis] ?? undefined,
              }))}
              xDataKey="date"
              aspectRatio={1.9}
              yDomain={[0, 100]}
            >
              <LineChart.Grid />
              <LineChart.Line dataKey="value" color={primary} />
              <LineChart.XAxis
                format={(datum) => String(datum.date ?? '').slice(5).replace('-', '/')}
              />
            </LineChart>
          ) : null}
          <Text className="text-[11px] leading-relaxed text-muted-foreground">{selected.hint}</Text>
        </>
      )}
    </DashboardCard>
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
      control={<Segmented compact options={dims} value={dim} onChange={setDim} />}
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
  const palette = usePnlPalette();
  const included = rSummary.total_trades;
  const total = included + rSummary.excluded;

  if (included === 0) {
    return (
      <DashboardCard title={t`R-multiple`}>
        <Text className="py-4 text-[13px] text-muted-foreground">
          {t`No trades with a knowable initial risk — set stops to unlock R analytics.`}
        </Text>
      </DashboardCard>
    );
  }

  // Counts are all positive, so the sign that colours a bucket is the bucket's
  // own R, not its height — hence two series rather than `signedBars`.
  const distribution = rSummary.distribution.map((bucket) => ({
    name: bucket.label,
    losing: bucket.from < 0 ? bucket.count : 0,
    winning: bucket.from < 0 ? 0 : bucket.count,
  }));

  return (
    <DashboardCard title={t`R-multiple`} flush>
      <View className="flex-row flex-wrap gap-2">
        <StatBar
          label={t`Avg R / trade`}
          value={fmtR(rSummary.avg_r)}
          sub={t`${included} of ${total} trades`}
          tone={rSummary.avg_r >= 0 ? 'pos' : 'neg'}
        />
        <StatBar label={t`Avg winning R`} value={fmtR(rSummary.avg_win_r)} tone="pos" />
        <StatBar label={t`Avg losing R`} value={fmtR(-rSummary.avg_loss_r)} tone="neg" />
        <StatBar label={t`Best / worst`} value={fmtR(rSummary.best_r)} sub={fmtR(rSummary.worst_r)} />
      </View>
      <BarChart data={distribution} xDataKey="name" stacked aspectRatio={1.9} cornerRadius={2}>
        <BarChart.Grid />
        <BarChart.Bar dataKey="losing" color={palette.loss} />
        <BarChart.Bar dataKey="winning" color={palette.profit} />
        <BarChart.XAxis />
      </BarChart>
      {rSummary.excluded > 0 ? (
        <Text className="text-xs text-muted-foreground">
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
  const filters = useReportsFilters();
  const breakdown = useBreakdown('trade_quality', filters);
  const { money } = ctx;

  if (breakdown.isLoading) return <Skeleton className="h-40 rounded-lg" />;
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
      <View className="gap-2">
        {groups.map((group) => {
          const value = money.pnl(group.summary);
          const grade = gradeFromInt(Number(group.key));
          return (
            <View key={group.key} className="gap-1">
              <Text className="text-[13px] font-semibold text-foreground">
                {grade || t`Unrated`}
              </Text>
              {/* The 4% floor keeps a near-zero grade visible; the readout row
                  below carries the value, so the bar itself stays unlabeled. */}
              <Meter
                value={Math.max(Math.abs(value), maxAbs * 0.04)}
                maxValue={maxAbs}
                size="sm"
                color="muted"
                indicatorClassName={value === 0 ? 'bg-flat' : value > 0 ? 'bg-profit' : 'bg-loss'}
              />
              <View className="flex-row items-baseline justify-between">
                <Text className={cn('text-sm font-semibold tabular-nums', pnlClass(value))}>
                  {money.formatCompact(value)}
                </Text>
                <Text className="text-xs tabular-nums text-muted-foreground">
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
          <Skeleton className="h-[320px] rounded-[18px]" label={t`Loading report`} />
          <Skeleton className="h-[200px] rounded-[18px]" />
        </>
      ) : summary.error && summary.data == null ? (
        // Boxed rather than flexed: the scaffold's scroll content has no height
        // of its own, so a `flex: 1` failure state would collapse to nothing.
        <View className="min-h-[320px]">
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
            <Skeleton className="h-[200px] rounded-[18px]" />
          ) : null}

          <SummaryCard summary={summary.data} ctx={ctx} />

          <PeriodReturnsCard ctx={ctx} />

          <DayStripCard ctx={ctx} />

          <PnlBridgeCard ctx={ctx} />

          {goal.data?.amount != null && ytd.data ? (
            <GoalCard
              year={year}
              goalAmount={goal.data.amount}
              ytdNetPnl={ytd.data.net_pnl}
              currency={ctx.currency}
              fxRate={ctx.fxRate}
            />
          ) : null}

          <ExecutionScoreCard />

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
  const router = useRouter();
  const [heading, mutedForeground] = useCSSVariable([
    '--color-heading',
    '--color-muted-foreground',
  ]) as [string, string];
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
      <View className="gap-0.5">
        {links.map((link) => (
          <Pressable
            key={link.href}
            onPress={() => router.push(link.href)}
            accessibilityRole="button"
            className="flex-row items-center gap-3 py-2.5 active:opacity-60"
          >
            <Icon name={link.icon} size={18} tintColor={heading} />
            <Text className="flex-1 text-[15px] font-medium text-foreground">{link.label}</Text>
            <Icon name="chevron.right" size={12} tintColor={mutedForeground} />
          </Pressable>
        ))}
      </View>
    </DashboardCard>
  );
}
