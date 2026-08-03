import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Summary, Trade } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { StatBar } from '@/components/stat-bar';
import { t } from '@lingui/core/macro';
import { formatCurrency, formatPercent, formatPnl, formatRatio } from '@/lib/format';
import { pnlColor } from '@/styles/unistyles';

function Meta({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, tint ? { color: tint } : null]}>{value}</Text>
    </View>
  );
}

/**
 * The web dashboard's signature "Performance" panel: Net P&L hero with
 * Gross / Fees / PF / Expect meta line, outcome chips, and avg edge.
 */
export function PerformanceCard({
  summary,
  trades,
  currency,
}: {
  summary: Summary;
  trades: Trade[];
  currency: string;
}) {
  const { theme } = useUnistyles();
  const pnl = (v: number | null | undefined) => pnlColor(theme.colors, v);
  // gross_profit/gross_loss are net-based buckets; real gross adds back fees.
  const gross = summary.net_pnl + summary.total_fees;
  const total = Math.max(summary.total_trades, 1);
  const allTotal = Math.max(trades.length, 1);
  const openCount = trades.filter((trade) => trade.status === 'open').length;

  return (
    <DashboardCard title={t`Performance`}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>{t`Net`}</Text>
        <Text selectable style={[styles.heroValue, { color: pnl(summary.net_pnl) }]}>
          {formatPnl(summary.net_pnl, currency)}
        </Text>
        <View style={styles.metaRow}>
          <Meta label={t`Gross`} value={formatPnl(gross, currency)} tint={pnl(gross)} />
          <Meta label={t`Fees`} value={formatCurrency(summary.total_fees, currency)} />
          <Meta label={t`PF`} value={formatRatio(summary.profit_factor)} />
          <Meta
            label={t`Expect`}
            value={formatPnl(summary.expectancy, currency)}
            tint={pnl(summary.expectancy)}
          />
        </View>
      </View>

      <View style={styles.grid}>
        <StatBar
          label={t`Wins`}
          value={String(summary.wins)}
          sub={formatPercent(summary.win_rate)}
          tone="pos"
        />
        <StatBar
          label={t`Losses`}
          value={String(summary.losses)}
          sub={formatPercent(summary.losses / total)}
          tone="neg"
        />
        <StatBar
          label={t`Open`}
          value={String(openCount)}
          sub={formatPercent(openCount / allTotal)}
          tone="accent"
        />
        <StatBar
          label={t`Wash`}
          value={String(summary.breakeven)}
          sub={formatPercent(summary.breakeven / total)}
          tone="amber"
        />
      </View>

      <View style={styles.grid}>
        <StatBar label={t`Avg win`} value={formatCurrency(summary.avg_win, currency)} tone="pos" />
        <StatBar label={t`Avg loss`} value={formatCurrency(summary.avg_loss, currency)} tone="neg" />
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  hero: { alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  heroLabel: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.mutedForeground,
    letterSpacing: 0.4,
  },
  heroValue: { fontSize: 34, fontWeight: '600', letterSpacing: -1, ...theme.numeric },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: theme.spacing.lg,
    rowGap: theme.spacing.xs,
  },
  meta: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.xs + 2 },
  metaLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.mutedForeground },
  metaValue: { fontSize: 13, fontWeight: '500', color: theme.colors.foreground, ...theme.numeric },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
}));
