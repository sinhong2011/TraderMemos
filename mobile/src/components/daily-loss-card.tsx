import { Progress, cn } from 'panelui-native';
import { Text, View } from 'react-native';

import { useRiskRules } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { t } from '@lingui/core/macro';
import { useFormatters } from '@/lib/format';
import { pnlClass } from '@/styles/pnl';

/**
 * Today's realized P&L against the max-daily-loss risk rule (web
 * DailyLossCard). Renders nothing until the rule is set — the card exists to
 * enforce a limit, not to display a number.
 */
export function DailyLossCard({
  todayNetPnl,
  currency,
  fxRate = 1,
}: {
  todayNetPnl: number;
  currency: string;
  /** Base→display conversion applied before formatting (1 = account currency). */
  fxRate?: number;
}) {
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatPnl } = useFormatters();
  const riskRules = useRiskRules();
  const cap = riskRules.data?.max_daily_loss;
  if (cap == null || cap <= 0) return null;

  const spent = todayNetPnl < 0 ? -todayNetPnl : 0;
  const usedPct = Math.min(100, (spent / cap) * 100);
  const breached = spent >= cap;
  const warning = !breached && usedPct >= 70;

  return (
    <DashboardCard title={t`Daily loss limit`}>
      <View className="flex-row items-baseline gap-2">
        <Text selectable className={cn('text-[22px] font-semibold tabular-nums', pnlClass(todayNetPnl))}>
          {formatPnl(todayNetPnl * fxRate, currency)}
        </Text>
        <Text className="text-[13px] text-muted-foreground tabular-nums">
          {t`limit ${formatCurrency(cap * fxRate, currency)}`}
        </Text>
      </View>
      {/* A budget barely touched still has to read as started, so the fill
          keeps a 3% floor once anything has been spent. */}
      <Progress
        value={Math.max(usedPct, spent > 0 ? 3 : 0)}
        size="sm"
        color={breached ? 'destructive' : warning ? 'warning' : 'primary'}
      />
      <Text
        className={cn(
          'text-xs text-muted-foreground tabular-nums',
          breached && 'font-semibold text-loss',
        )}
      >
        {breached
          ? t`Limit hit — the edge is gone for today. Close the app.`
          : warning
            ? t`${usedPct.toFixed(0)}% of the daily loss budget used — tread carefully.`
            : t`${usedPct.toFixed(0)}% of the daily loss budget used.`}
      </Text>
    </DashboardCard>
  );
}
