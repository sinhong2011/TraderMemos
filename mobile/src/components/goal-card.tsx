import { Progress, cn } from 'panelui-native';
import { Text, View } from 'react-native';

import { DashboardCard } from '@/components/dashboard-card';
import { t } from '@lingui/core/macro';
import { formatPercent, useFormatters } from '@/lib/format';
import { pnlClass } from '@/styles/pnl';

/**
 * Annual goal progress (web `AnnualGoalCard`, display-only — the goal itself is
 * managed on the web app).
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
  const clamped = Math.min(1, Math.max(0, progress));

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
      <Progress value={clamped * 100} size="sm" />
      <Text className="text-xs text-muted-foreground tabular-nums">
        {t`${formatPercent(progress, 0)} of goal · YTD net P&L`}
      </Text>
    </DashboardCard>
  );
}
