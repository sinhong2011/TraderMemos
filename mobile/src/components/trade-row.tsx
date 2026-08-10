import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Trade } from '@/api/types';
import { t } from '@lingui/core/macro';
import { formatDuration, useFormatters } from '@/lib/format';
import { pnlColor } from '@/styles/unistyles';
import { marketLabel, tradePriceLine, tradeStatus } from '@/lib/trades';

/**
 * Stocks-style outcome line: the row's single colored element. Return % for
 * closed trades, "Open" for open ones — the sign already lives in the number.
 * Plain colored text, no fill — the color alone carries the outcome.
 */
function OutcomeText({ trade }: { trade: Trade }) {
  const { theme } = useUnistyles();
  const status = tradeStatus(trade);
  const color =
    status.label === 'OPEN'
      ? theme.colors.primary
      : status.label === 'WIN'
        ? theme.colors.profit
        : status.label === 'LOSS'
          ? theme.colors.loss
          : theme.colors.flat;
  const label =
    status.label === 'OPEN'
      ? t`Open`
      : trade.return_pct != null
        ? `${trade.return_pct >= 0 ? '+' : ''}${trade.return_pct.toFixed(2)}%`
        : '0.00%';

  return (
    <Text style={[styles.outcome, { color }]} numberOfLines={1}>
      {label}
    </Text>
  );
}

/**
 * One trade as an iOS-native, typography-first row (Stocks-style): identity
 * (symbol + direction/market capsule) and prices on the left, plain P&L over
 * the colored return % on the right. Everything else rides in one quiet meta
 * line — chips stay on detail.
 */
export function TradeRow({ trade, showDate = true }: { trade: Trade; showDate?: boolean }) {
  const { theme } = useUnistyles();
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatPnl, formatTime, formatTimestamp } = useFormatters();
  const currency = trade.pnl_currency;
  const money = (v: number) => formatCurrency(v, currency);
  const hold = trade.time_in_trade_secs != null ? formatDuration(trade.time_in_trade_secs) : null;
  const firstTag = trade.tags[0]?.name;
  const hasNotes = trade.notes.trim().length > 0;

  // Options say what the contract is (Call/Put beats the generic OPT). The
  // position chip names it the way traders do — "Long Call", "Short Put".
  const contract =
    trade.option_right === 'call' ? t`Call` : trade.option_right === 'put' ? t`Put` : null;
  // Uppercased in JS — `textTransform` breaks RN's width measurement under
  // `numberOfLines` and the chips ellipsize ("LO…").
  const position = [trade.direction === 'long' ? t`Long` : t`Short`, ...(contract ? [contract] : [])]
    .join(' ')
    .toUpperCase();
  const meta = [...(hold ? [hold] : []), ...(firstTag ? [firstTag] : [])].join(' · ');
  // Corner stamp: full timestamp normally; day sheets (showDate=false) already
  // name the day, so they carry the clock alone.
  const stamp = showDate ? formatTimestamp(trade.opened_at) : formatTime(trade.opened_at);

  return (
    <Link href={`/(tabs)/(trades)/${trade.id}`} asChild>
      {/* Link.Trigger clones its child and overwrites `style`, so the Pressable
          stays bare and an inner View carries the row's surface and layout. */}
      <Link.Trigger>
        <Pressable>
          <View style={styles.row}>
            <View style={styles.left}>
              <View style={styles.symbolLine}>
                <Text selectable style={styles.symbol} numberOfLines={1}>
                  {trade.symbol}
                </Text>
                {/* Instrument and position ride beside the symbol as two quiet
                    capsules, freeing the meta line for the when/how-long/tag. */}
                <View style={styles.kindBadge}>
                  <Text style={styles.kindBadgeText} numberOfLines={1}>
                    {marketLabel(trade.instrument_type)}
                  </Text>
                </View>
                <View style={styles.kindBadge}>
                  <Text style={styles.kindBadgeText} numberOfLines={1}>
                    <Text
                      style={{
                        color:
                          trade.direction === 'long' ? theme.colors.profit : theme.colors.loss,
                      }}
                    >
                      {trade.direction === 'long' ? '↗ ' : '↘ '}
                    </Text>
                    {position}
                  </Text>
                </View>
              </View>
              <Text style={styles.prices} numberOfLines={1}>
                {tradePriceLine(trade, money)}
              </Text>
              <View style={styles.metaLine}>
                <Text style={styles.meta} numberOfLines={1}>
                  {meta}
                </Text>
                {hasNotes ? (
                  <SymbolView
                    name="square.and.pencil"
                    size={11}
                    tintColor={theme.colors.mutedForeground}
                  />
                ) : null}
              </View>
            </View>
            <View style={styles.right}>
              <Text style={styles.stamp} numberOfLines={1}>
                {stamp}
              </Text>
              <Text
                selectable
                style={[styles.pnl, { color: pnlColor(theme.colors, trade.net_pnl) }]}
                numberOfLines={1}
              >
                {formatPnl(trade.net_pnl, currency)}
              </Text>
              <OutcomeText trade={trade} />
            </View>
          </View>
        </Pressable>
      </Link.Trigger>
      <Link.Preview />
    </Link>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
    boxShadow: theme.shadows.card,
  },
  left: { flex: 1, gap: 3 },
  symbolLine: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  symbol: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  kindBadge: {
    backgroundColor: theme.colors.fill,
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 2,
  },
  kindBadgeText: { fontSize: 11, fontWeight: '600', color: theme.colors.mutedForeground },
  prices: { fontSize: 14, color: theme.colors.mutedForeground, ...theme.numeric },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs + 1 },
  meta: { flexShrink: 1, fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  right: { alignItems: 'flex-end', gap: 4 },
  stamp: { fontSize: 11, color: theme.colors.mutedForeground, ...theme.numeric },
  pnl: { fontSize: 17, fontWeight: '600', ...theme.numeric },
  outcome: { fontSize: 13, fontWeight: '600', ...theme.numeric },
}));
