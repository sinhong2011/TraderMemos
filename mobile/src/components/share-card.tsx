import { forwardRef } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { TradeDetail } from '@/api/types';
import { t } from '@lingui/core/macro';
import { formatPercentPoints, useFormatters } from '@/lib/format';
import { tradeRMultiple, tradeStatus } from '@/lib/trades';
import { pnlColor, PnlFill } from '@/styles/unistyles';
import type { AppTheme } from '@/styles/unistyles';

/** Card width in points — the capture scales it up, so this is the layout unit. */
export const SHARE_CARD_WIDTH = 340;

export const SHARE_CARD_STYLES = ['classic', 'midnight', 'paper', 'signal'] as const;
export type ShareCardStyleId = (typeof SHARE_CARD_STYLES)[number];

export function shareCardStyleLabel(id: ShareCardStyleId): string {
  switch (id) {
    case 'classic':
      return t`Classic`;
    case 'midnight':
      return t`Midnight`;
    case 'paper':
      return t`Paper`;
    default:
      return t`Signal`;
  }
}

/**
 * Everything a card style controls. Fixed styles carry their own palette so a
 * midnight card stays midnight in light mode; `classic` mirrors the app theme.
 * `chipBg`/`chipFg` null → derive the direction chip from the pos/neg tone
 * (the translucent Pill recipe); set → a single fixed chip surface (signal).
 */
type CardPalette = {
  bg: string;
  fg: string;
  mutedFg: string;
  pos: string;
  neg: string;
  flat: string;
  /** Hero/amount color override — null derives from P&L tone. */
  heroFg: string | null;
  chipBg: string | null;
  chipFg: string | null;
  /** "Memos" half of the wordmark. */
  brandAccent: string;
};

function cardPalette(id: ShareCardStyleId, theme: AppTheme, net: number, open: boolean): CardPalette {
  switch (id) {
    case 'midnight':
      return {
        bg: '#0E1116',
        fg: '#F5F5F5',
        mutedFg: '#9BA1A6',
        pos: '#54BF5C',
        neg: '#FF6467',
        flat: '#A1A1A1',
        heroFg: null,
        chipBg: null,
        chipFg: null,
        brandAccent: PnlFill.open,
      };
    case 'paper':
      return {
        bg: '#FFFFFF',
        fg: '#171717',
        mutedFg: '#737373',
        pos: '#098926',
        neg: '#E7000B',
        flat: '#737373',
        heroFg: null,
        chipBg: null,
        chipFg: null,
        brandAccent: PnlFill.open,
      };
    case 'signal': {
      const fill = open ? PnlFill.open : net > 0 ? PnlFill.pos : net < 0 ? PnlFill.neg : PnlFill.flat;
      return {
        bg: fill,
        fg: '#FFFFFF',
        mutedFg: 'rgba(255, 255, 255, 0.72)',
        pos: '#FFFFFF',
        neg: '#FFFFFF',
        flat: '#FFFFFF',
        heroFg: '#FFFFFF',
        chipBg: 'rgba(255, 255, 255, 0.18)',
        chipFg: '#FFFFFF',
        brandAccent: '#FFFFFF',
      };
    }
    default:
      return {
        bg: theme.colors.background,
        fg: theme.colors.foreground,
        mutedFg: theme.colors.mutedForeground,
        pos: theme.colors.profit,
        neg: theme.colors.loss,
        flat: theme.colors.flat,
        heroFg: null,
        chipBg: null,
        chipFg: null,
        brandAccent: PnlFill.open,
      };
  }
}

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
export const ShareCardView = forwardRef<
  View,
  { trade: TradeDetail; showAmounts: boolean; cardStyle?: ShareCardStyleId; showMark?: boolean }
>(function ShareCardView({ trade, showAmounts, cardStyle = 'classic', showMark = true }, ref) {
  const { theme } = useUnistyles();
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatDate, formatPnl } = useFormatters();
  const r = trade.r_multiple ?? tradeRMultiple(trade);
  const status = tradeStatus(trade);
  const isLong = trade.direction === 'long';
  const net = trade.net_pnl ?? 0;
  const palette = cardPalette(cardStyle, theme, net, status.label === 'OPEN');

  const hero =
    r != null
      ? `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`
      : trade.return_pct != null
        ? formatPercentPoints(trade.return_pct)
        : statusLabel(status.label);
  const sub = r != null && trade.return_pct != null ? formatPercentPoints(trade.return_pct) : null;

  const heroColor =
    palette.heroFg ??
    pnlColor({ ...theme.colors, profit: palette.pos, loss: palette.neg, flat: palette.flat }, net);
  const chipTone = isLong ? palette.pos : palette.neg;

  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: palette.bg }]}>
      <View style={styles.cardHead}>
        <Text style={[styles.symbol, { color: palette.fg }]}>{trade.symbol}</Text>
        <View
          style={[styles.chip, { backgroundColor: palette.chipBg ?? `${chipTone}1F` }]}
        >
          <Text style={[styles.chipText, { color: palette.chipFg ?? chipTone }]}>
            {isLong ? t`LONG` : t`SHORT`}
          </Text>
        </View>
      </View>
      <View style={styles.heroWrap}>
        <Text style={[styles.hero, { color: heroColor }]}>{hero}</Text>
        {sub ? <Text style={[styles.heroSub, { color: palette.mutedFg }]}>{sub}</Text> : null}
        {showAmounts ? (
          <Text style={[styles.amount, { color: heroColor }]}>
            {formatPnl(net, trade.pnl_currency)}
          </Text>
        ) : null}
      </View>
      <View style={styles.cardFoot}>
        <Text style={[styles.date, { color: palette.mutedFg }]}>
          {formatDate(trade.closed_at ?? trade.opened_at)}
        </Text>
        {showMark ? (
          // Wordmark, not a logo asset — keeps the capture self-contained.
          <Text style={[styles.brand, { color: palette.fg }]}>
            Trader<Text style={{ color: palette.brandAccent }}>Memos</Text>
          </Text>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create((theme) => ({
  card: {
    width: SHARE_CARD_WIDTH,
    gap: theme.spacing.lg,
    borderRadius: theme.radius.lg + 6,
    borderCurve: 'continuous',
    padding: theme.spacing.xl,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  symbol: { fontSize: 24, fontWeight: '700' },
  // Palette-aware sibling of Pill — the theme Pill would tint from the app
  // scheme, which breaks on the fixed midnight/paper/signal grounds.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
  },
  chipText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  heroWrap: { alignItems: 'center', gap: theme.spacing.xs, paddingVertical: theme.spacing.lg },
  hero: { fontSize: 56, fontWeight: '700', letterSpacing: -2, ...theme.numeric },
  heroSub: { fontSize: 16, fontWeight: '500', ...theme.numeric },
  amount: { fontSize: 20, fontWeight: '600', ...theme.numeric },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: 13, ...theme.numeric },
  brand: { fontSize: 13, fontWeight: '700' },
}));
