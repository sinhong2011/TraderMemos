import { Card, cn } from 'panelui-native';
import { Text, View, type TextStyle } from 'react-native';

import type { Summary, Trade } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { RollingNumber } from '@/components/rolling-number';
import { StatBar } from '@/components/stat-bar';
import { t } from '@lingui/core/macro';
import { formatPercent, formatRatio, useFormatters } from '@/lib/format';
import { pnlClass, pnlColor, usePnlPalette } from '@/styles/pnl';

/** The rolling hero is a `Text` style, so its hue has to be a JS value. */
const HERO_TEXT: TextStyle = {
  fontSize: 34,
  fontWeight: '600',
  letterSpacing: -1,
  fontVariant: ['tabular-nums'],
};

function Meta({ label, value, tintClass }: { label: string; value: string; tintClass?: string }) {
  return (
    <View className="flex-row items-baseline gap-1.5">
      <Text className="text-[13px] font-medium text-muted-foreground">{label}</Text>
      <Text className={cn('text-[13px] font-medium text-foreground tabular-nums', tintClass)}>
        {value}
      </Text>
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
  const palette = usePnlPalette();
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatPnl } = useFormatters();
  const fx = (v: number) => v * fxRate;
  // gross_profit/gross_loss are net-based buckets; real gross adds back fees.
  const gross = summary.net_pnl + summary.total_fees;
  const total = Math.max(summary.total_trades, 1);
  const allTotal = Math.max(trades.length, 1);
  const openCount = trades.filter((trade) => trade.status === 'open').length;

  return (
    <DashboardCard title={t`Performance`} flush>
      {/* The Net headline keeps a card of its own — it is the one block on Home
          that is a statement rather than a tile, so it gets the full-width
          surface the tiles below sit apart from. */}
      <Card className="items-center gap-2 rounded-lg border-0 p-4">
        <Text className="self-start text-xs font-medium tracking-wide text-muted-foreground">
          {t`Net`}
        </Text>
        {/* 42 for a 34pt line: enough to clear the glyph box so a rolling digit
            isn't clipped standing still. */}
        <RollingNumber
          value={formatPnl(fx(summary.net_pnl), currency)}
          style={[HERO_TEXT, { color: pnlColor(palette, summary.net_pnl) }]}
          cellHeight={42}
        />
        <View className="flex-row flex-wrap justify-center gap-x-4 gap-y-1">
          <Meta label={t`Gross`} value={formatPnl(fx(gross), currency)} tintClass={pnlClass(gross)} />
          <Meta label={t`Fees`} value={formatCurrency(fx(summary.total_fees), currency)} />
          <Meta label={t`PF`} value={formatRatio(summary.profit_factor)} />
          <Meta
            label={t`Expect`}
            value={formatPnl(fx(summary.expectancy), currency)}
            tintClass={pnlClass(summary.expectancy)}
          />
        </View>
      </Card>

      <View className="flex-row flex-wrap gap-2">
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

      <View className="flex-row flex-wrap gap-2">
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
