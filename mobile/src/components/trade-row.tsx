import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Trade } from '@/api/types';
import { t } from '@lingui/core/macro';
import { formatDuration, useFormatters } from '@/lib/format';
import { PnlFill } from '@/styles/unistyles';
import { marketLabel, tradePriceLine, tradeStatus } from '@/lib/trades';

/** Shared with the trade form's directional toggles — see `PnlFill`. */
const BadgeColor = PnlFill;

/**
 * Stocks-style outcome badge: the row's single colored element. Return % for
 * closed trades, "Open" for open ones — the sign already lives in the number.
 */
function OutcomeBadge({ trade }: { trade: Trade }) {
  const status = tradeStatus(trade);
  const tone =
    status.label === 'OPEN'
      ? 'open'
      : status.label === 'WIN'
        ? 'pos'
        : status.label === 'LOSS'
          ? 'neg'
          : 'flat';
  const label =
    status.label === 'OPEN'
      ? t`Open`
      : trade.return_pct != null
        ? `${trade.return_pct >= 0 ? '+' : ''}${trade.return_pct.toFixed(2)}%`
        : '0.00%';

  return (
    <View style={[styles.badge, { backgroundColor: BadgeColor[tone] }]}>
      <Text style={styles.badgeText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * One trade as an iOS-native, typography-first row (Stocks-style): identity and
 * prices on the left, plain P&L over a single colored outcome badge on the
 * right. Everything else rides in one quiet meta line — chips stay on detail.
 */
export function TradeRow({ trade, showDate = true }: { trade: Trade; showDate?: boolean }) {
  const { theme } = useUnistyles();
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatDate, formatPnl } = useFormatters();
  const currency = trade.pnl_currency;
  const money = (v: number) => formatCurrency(v, currency);
  const hold = trade.time_in_trade_secs != null ? formatDuration(trade.time_in_trade_secs) : null;
  const firstTag = trade.tags[0]?.name;
  const hasNotes = trade.notes.trim().length > 0;

  const meta = [
    trade.direction === 'long' ? t`Long` : t`Short`,
    marketLabel(trade.instrument_type),
    ...(showDate ? [formatDate(trade.opened_at)] : []),
    ...(hold ? [hold] : []),
    ...(firstTag ? [firstTag] : []),
  ].join(' · ');

  return (
    <Link href={`/(tabs)/(trades)/${trade.id}`} asChild>
      {/* Link.Trigger clones its child and overwrites `style`, so the Pressable
          stays bare and an inner View carries the row's surface and layout. */}
      <Link.Trigger>
        <Pressable>
          <View style={styles.row}>
            <View style={styles.left}>
              <Text selectable style={styles.symbol} numberOfLines={1}>
                {trade.symbol}
              </Text>
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
              <Text
                selectable
                style={[styles.pnl, trade.net_pnl == null && styles.pnlMuted]}
                numberOfLines={1}
              >
                {formatPnl(trade.net_pnl, currency)}
              </Text>
              <OutcomeBadge trade={trade} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md + 2,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
    boxShadow: theme.shadows.card,
  },
  left: { flex: 1, gap: 3 },
  symbol: { fontSize: 17, fontWeight: '600', color: theme.colors.foreground },
  prices: { fontSize: 14, color: theme.colors.mutedForeground, ...theme.numeric },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs + 1 },
  meta: { flexShrink: 1, fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  right: { alignItems: 'flex-end', gap: 5 },
  pnl: { fontSize: 17, fontWeight: '600', color: theme.colors.foreground, ...theme.numeric },
  pnlMuted: { color: theme.colors.mutedForeground },
  badge: {
    minWidth: 72,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.sm + 1,
    borderCurve: 'continuous',
  },
  badgeText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', ...theme.numeric },
}));
