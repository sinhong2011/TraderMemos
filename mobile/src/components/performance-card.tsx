import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Summary, Trade } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { StatBar } from '@/components/stat-bar';
import { t } from '@lingui/core/macro';
import { formatPercent, formatRatio, useFormatters } from '@/lib/format';
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
  fxRate = 1,
}: {
  summary: Summary;
  trades: Trade[];
  currency: string;
  /** Base→display conversion applied before formatting (1 = account currency). */
  fxRate?: number;
}) {
  const { theme } = useUnistyles();
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatPnl } = useFormatters();
  const pnl = (v: number | null | undefined) => pnlColor(theme.colors, v);
  const fx = (v: number) => v * fxRate;
  // gross_profit/gross_loss are net-based buckets; real gross adds back fees.
  const gross = summary.net_pnl + summary.total_fees;
  const total = Math.max(summary.total_trades, 1);
  const allTotal = Math.max(trades.length, 1);
  const openCount = trades.filter((trade) => trade.status === 'open').length;

  return (
    <DashboardCard title={t`Performance`} flush>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>{t`Net`}</Text>
        <Text selectable style={[styles.heroValue, { color: pnl(summary.net_pnl) }]}>
          {formatPnl(fx(summary.net_pnl), currency)}
        </Text>
        <View style={styles.metaRow}>
          <Meta label={t`Gross`} value={formatPnl(fx(gross), currency)} tint={pnl(gross)} />
          <Meta label={t`Fees`} value={formatCurrency(fx(summary.total_fees), currency)} />
          <Meta label={t`PF`} value={formatRatio(summary.profit_factor)} />
          <Meta
            label={t`Expect`}
            value={formatPnl(fx(summary.expectancy), currency)}
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
          // Breakeven is a neutral outcome, not a warning — it had been tinted
          // with the section-header hue, which read as arbitrary once that hue
          // stopped appearing anywhere else on the screen.
          tone="muted"
        />
      </View>

      <View style={styles.grid}>
        <StatBar
          label={t`Avg win`}
          value={formatCurrency(fx(summary.avg_win), currency)}
          tone="pos"
        />
        <StatBar
          label={t`Avg loss`}
          value={formatCurrency(fx(summary.avg_loss), currency)}
          tone="neg"
        />
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  // The Net headline keeps a card of its own — it is the one block on Home that
  // is a statement rather than a tile, so it gets the full-width white surface
  // the tiles below sit apart from.
  hero: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
    boxShadow: theme.shadows.card,
  },
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
