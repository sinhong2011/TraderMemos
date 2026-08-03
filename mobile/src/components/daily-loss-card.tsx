import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useRiskRules } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { t } from '@lingui/core/macro';
import { formatCurrency, formatPnl } from '@/lib/format';
import { useDisplayPrefs } from '@/lib/prefs';
import { pnlColor } from '@/styles/unistyles';

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
  const { theme } = useUnistyles();
  useDisplayPrefs();
  const riskRules = useRiskRules();
  const cap = riskRules.data?.max_daily_loss;
  if (cap == null || cap <= 0) return null;

  const spent = todayNetPnl < 0 ? -todayNetPnl : 0;
  const usedPct = Math.min(100, (spent / cap) * 100);
  const breached = spent >= cap;
  const warning = !breached && usedPct >= 70;

  return (
    <DashboardCard title={t`Daily loss limit`}>
      <View style={styles.row}>
        <Text
          selectable
          style={[styles.today, { color: pnlColor(theme.colors, todayNetPnl) }]}
        >
          {formatPnl(todayNetPnl * fxRate, currency)}
        </Text>
        <Text style={styles.cap}>{t`limit ${formatCurrency(cap * fxRate, currency)}`}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max(usedPct, spent > 0 ? 3 : 0)}%`,
              backgroundColor: breached
                ? theme.colors.loss
                : warning
                  ? theme.colors.accent
                  : theme.colors.primary,
            },
          ]}
        />
      </View>
      <Text
        style={[
          styles.caption,
          breached ? { color: theme.colors.loss, fontWeight: '600' } : null,
        ]}
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

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm },
  today: { fontSize: 22, fontWeight: '600', ...theme.numeric },
  cap: { fontSize: 13, color: theme.colors.mutedForeground, ...theme.numeric },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.muted,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  caption: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
}));
