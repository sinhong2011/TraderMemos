import { forwardRef } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { TradeDetail } from '@/api/types';
import { Pill } from '@/components/pill';
import { t } from '@lingui/core/macro';
import { formatPercentPoints, useFormatters } from '@/lib/format';
import { tradeRMultiple, tradeStatus } from '@/lib/trades';
import { pnlColor, PnlFill } from '@/styles/unistyles';

/** Card width in points — the capture scales it up, so this is the layout unit. */
export const SHARE_CARD_WIDTH = 340;

function statusLabel(label: ReturnType<typeof tradeStatus>['label']): string {
  switch (label) {
    case 'WIN':
      return t`WIN`;
    case 'LOSS':
      return t`LOSS`;
    case 'OPEN':
      return t`OPEN`;
    default:
      return t`BE`;
  }
}

/**
 * Shareable result card (web TradeShareCard). Privacy-first like the web
 * default: the hero is the R multiple, falling back to return %, then the
 * W/L status — dollar amounts only appear when the sharer opts in.
 */
export const ShareCardView = forwardRef<View, { trade: TradeDetail; showAmounts: boolean }>(
  function ShareCardView({ trade, showAmounts }, ref) {
    const { theme } = useUnistyles();
    // Formatters bound to the display prefs (see lib/format.ts).
    const { formatDate, formatPnl } = useFormatters();
    const r = trade.r_multiple ?? tradeRMultiple(trade);
    const status = tradeStatus(trade);
    const isLong = trade.direction === 'long';
    const net = trade.net_pnl ?? 0;

    const hero =
      r != null
        ? `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`
        : trade.return_pct != null
          ? formatPercentPoints(trade.return_pct)
          : statusLabel(status.label);
    const sub =
      r != null && trade.return_pct != null ? formatPercentPoints(trade.return_pct) : null;

    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.symbol}>{trade.symbol}</Text>
          <Pill tone={isLong ? 'pos' : 'neg'}>{isLong ? t`LONG` : t`SHORT`}</Pill>
        </View>
        <View style={styles.heroWrap}>
          <Text style={[styles.hero, { color: pnlColor(theme.colors, net) }]}>{hero}</Text>
          {sub ? <Text style={styles.heroSub}>{sub}</Text> : null}
          {showAmounts ? (
            <Text style={[styles.amount, { color: pnlColor(theme.colors, net) }]}>
              {formatPnl(net, trade.pnl_currency)}
            </Text>
          ) : null}
        </View>
        <View style={styles.cardFoot}>
          <Text style={styles.date}>{formatDate(trade.closed_at ?? trade.opened_at)}</Text>
          {/* Wordmark, not a logo asset — keeps the capture self-contained. */}
          <Text style={styles.brand}>
            Trader<Text style={{ color: PnlFill.open }}>Memos</Text>
          </Text>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  card: {
    width: SHARE_CARD_WIDTH,
    gap: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg + 6,
    borderCurve: 'continuous',
    padding: theme.spacing.xl,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  symbol: { fontSize: 24, fontWeight: '700', color: theme.colors.foreground },
  heroWrap: { alignItems: 'center', gap: theme.spacing.xs, paddingVertical: theme.spacing.lg },
  hero: { fontSize: 56, fontWeight: '700', letterSpacing: -2, ...theme.numeric },
  heroSub: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  amount: { fontSize: 20, fontWeight: '600', ...theme.numeric },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: 13, color: theme.colors.mutedForeground, ...theme.numeric },
  brand: { fontSize: 13, fontWeight: '700', color: theme.colors.foreground },
}));
