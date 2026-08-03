import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { TradeDetail } from '@/api/types';
import { Pill } from '@/components/pill';
import { t } from '@lingui/core/macro';
import { formatDate, formatPercentPoints } from '@/lib/format';
import { tradeRMultiple, tradeStatus } from '@/lib/trades';
import { pnlColor, PnlFill } from '@/styles/unistyles';

/**
 * Shareable result card (web TradeShareCard, captured natively). Privacy-first
 * like the web default: the hero is the R multiple, falling back to return %,
 * then the W/L status — dollar amounts never leave the device.
 */
function ShareCardView({ trade }: { trade: TradeDetail }) {
  const { theme } = useUnistyles();
  const r = trade.r_multiple ?? tradeRMultiple(trade);
  const status = tradeStatus(trade);
  const isLong = trade.direction === 'long';
  const net = trade.net_pnl ?? 0;

  const hero =
    r != null
      ? `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`
      : trade.return_pct != null
        ? formatPercentPoints(trade.return_pct)
        : status.label;
  const sub =
    r != null && trade.return_pct != null ? formatPercentPoints(trade.return_pct) : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.symbol}>{trade.symbol}</Text>
        <Pill tone={isLong ? 'pos' : 'neg'}>{isLong ? t`LONG` : t`SHORT`}</Pill>
      </View>
      <View style={styles.heroWrap}>
        <Text style={[styles.hero, { color: pnlColor(theme.colors, net) }]}>{hero}</Text>
        {sub ? <Text style={styles.heroSub}>{sub}</Text> : null}
      </View>
      <View style={styles.cardFoot}>
        <Text style={styles.date}>
          {formatDate(trade.closed_at ?? trade.opened_at)}
        </Text>
        {/* Wordmark, not a logo asset — keeps the capture self-contained. */}
        <Text style={styles.brand}>
          Trader<Text style={{ color: PnlFill.open }}>Memos</Text>
        </Text>
      </View>
    </View>
  );
}

/**
 * Off-screen capture plumbing: `share()` mounts the card outside the viewport,
 * snapshots it at 3× once laid out, and hands the PNG to the system share
 * sheet. Render `shareView` anywhere inside the screen.
 */
export function useTradeShare(trade: TradeDetail): {
  shareView: React.ReactNode;
  share: () => void;
} {
  const [rendering, setRendering] = useState(false);
  const cardRef = useRef<View>(null);

  async function capture() {
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Sharing.shareAsync(`file://${uri.replace(/^file:\/\//, '')}`, {
        mimeType: 'image/png',
        dialogTitle: t`Share trade`,
      });
    } catch (err) {
      Alert.alert(t`Could not share`, err instanceof Error ? err.message : String(err));
    } finally {
      setRendering(false);
    }
  }

  const shareView = rendering ? (
    <View style={styles.offscreen} pointerEvents="none">
      <View ref={cardRef} collapsable={false} onLayout={() => void capture()}>
        <ShareCardView trade={trade} />
      </View>
    </View>
  ) : null;

  return { shareView, share: () => setRendering(true) };
}

const styles = StyleSheet.create((theme) => ({
  offscreen: { position: 'absolute', left: -9999, top: 0 },
  card: {
    width: 340,
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
  heroSub: { fontSize: 16, fontWeight: '500', color: theme.colors.mutedForeground, ...theme.numeric },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: 13, color: theme.colors.mutedForeground, ...theme.numeric },
  brand: { fontSize: 13, fontWeight: '700', color: theme.colors.foreground },
}));
