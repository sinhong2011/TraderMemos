import { cn } from 'panelui-native';
import { Text, View } from 'react-native';

import { DashboardCard } from '@/components/dashboard-card';
import { GoalTicks } from '@/components/goal-ticks';
import { t } from '@lingui/core/macro';
import { formatPercent, useFormatters } from '@/lib/format';
import { pnlClass } from '@/styles/pnl';

type PaceStatus = 'over' | 'ahead' | 'behind' | 'on_track';

function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

function dayOfYear(now: Date): number {
  const start = Date.UTC(now.getFullYear(), 0, 1);
  return Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - start) / 86_400_000) + 1;
}

/**
 * Pace against the calendar (web `computeAnnualGoalProgress`): the goal
 * pro-rated to today's day-of-year, with a 2% dead band so the card doesn't
 * flap between ahead and behind on quiet days.
 */
function paceStatus(year: number, goal: number, ytdNetPnl: number): PaceStatus {
  if (ytdNetPnl >= goal) return 'over';
  const now = new Date();
  const diy = daysInYear(year);
  const doy = year === now.getFullYear() ? dayOfYear(now) : diy;
  const delta = ytdNetPnl - goal * (doy / diy);
  const band = Math.max(goal * 0.02, 1);
  if (delta >= band) return 'ahead';
  if (delta <= -band) return 'behind';
  return 'on_track';
}

function paceLabel(status: PaceStatus): string {
  switch (status) {
    case 'over':
      return t`Goal reached`;
    case 'ahead':
      return t`Ahead of pace`;
    case 'behind':
      return t`Behind pace`;
    default:
      return t`On track`;
  }
}

/** Web `paceTone` — behind reads in the loss hue, not the error red. */
function paceToneClass(status: PaceStatus): string {
  switch (status) {
    case 'over':
    case 'ahead':
      return 'text-profit';
    case 'behind':
      return 'text-loss';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Annual goal progress (web `AnnualGoalCard`, display-only — the goal itself is
 * managed on the web app). The bar is the web's segmented energy-bar comb,
 * plus the two states the web only spoke about in text: a gold second lap
 * past 100%, and red drawdown ticks when the year is under water.
 */
export function GoalCard({
  year,
  goalAmount,
  ytdNetPnl,
  currency,
  fxRate = 1,
}: {
  year: number;
  goalAmount: number;
  ytdNetPnl: number;
  currency: string;
  /** Base→display conversion applied before formatting (1 = account currency). */
  fxRate?: number;
}) {
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatPnl } = useFormatters();
  const progress = goalAmount > 0 ? ytdNetPnl / goalAmount : 0;
  const status = paceStatus(year, goalAmount, ytdNetPnl);
  const overBy = Math.max(0, ytdNetPnl - goalAmount);
  const remaining = Math.max(0, goalAmount - ytdNetPnl);

  return (
    <DashboardCard title={t`${year} goal`}>
      <View className="flex-row items-baseline gap-2">
        <Text selectable className={cn('text-[22px] font-semibold tabular-nums', pnlClass(ytdNetPnl))}>
          {formatPnl(ytdNetPnl * fxRate, currency)}
        </Text>
        <Text className="text-[13px] text-muted-foreground tabular-nums">
          {t`of ${formatCurrency(goalAmount * fxRate, currency)}`}
        </Text>
      </View>
      <GoalTicks
        progress={progress}
        // Web parity: falling behind the calendar pace warms the fill.
        fillClassName={status === 'behind' && progress < 1 ? 'bg-warning' : 'bg-profit'}
        accessibilityLabel={t`Goal progress`}
      />
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className={cn('text-xs font-medium tabular-nums', paceToneClass(status))}>
          {formatPercent(progress, 0)} · {paceLabel(status)}
        </Text>
        <Text className="text-xs text-muted-foreground tabular-nums">
          {overBy > 0
            ? t`Over by ${formatCurrency(overBy * fxRate, currency)}`
            : t`Left ${formatCurrency(remaining * fxRate, currency)}`}
        </Text>
      </View>
    </DashboardCard>
  );
}
