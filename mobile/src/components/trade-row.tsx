import { Link } from 'expo-router';
import { cn } from 'panelui-native';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import type { Trade } from '@/api/types';
import { t } from '@lingui/core/macro';
import { formatDuration, useFormatters } from '@/lib/format';
import { pnlClass } from '@/styles/pnl';
import { marketLabel, tradePriceLine, tradeStatus } from '@/lib/trades';

/**
 * Stocks-style outcome line: the row's single colored element. Return % for
 * closed trades, "Open" for open ones — the sign already lives in the number.
 * Plain colored text, no fill — the color alone carries the outcome.
 */
function OutcomeText({ trade }: { trade: Trade }) {
  const status = tradeStatus(trade);
  const color =
    status.label === 'OPEN'
      ? 'text-primary'
      : status.label === 'WIN'
        ? 'text-profit'
        : status.label === 'LOSS'
          ? 'text-loss'
          : 'text-flat';
  const label =
    status.label === 'OPEN'
      ? t`Open`
      : trade.return_pct != null
        ? `${trade.return_pct >= 0 ? '+' : ''}${trade.return_pct.toFixed(2)}%`
        : '0.00%';

  return (
    <Text className={cn('text-[13px] font-semibold tabular-nums', color)} numberOfLines={1}>
      {label}
    </Text>
  );
}

/**
 * One trade as a typography-first row (Stocks-style): identity (symbol +
 * direction/market capsule) and prices on the left, plain P&L over the colored
 * return % on the right. Everything else rides in one quiet meta line — chips
 * stay on detail.
 */
export function TradeRow({ trade, showDate = true }: { trade: Trade; showDate?: boolean }) {
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
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
          <View className="flex-row items-start justify-between gap-4 rounded-lg bg-card px-3 py-2.5">
            <View className="flex-1 gap-[3px]">
              <View className="flex-row items-center gap-2">
                <Text selectable className="shrink text-[17px] font-semibold text-foreground" numberOfLines={1}>
                  {trade.symbol}
                </Text>
                {/* Instrument and position ride beside the symbol as two quiet
                    capsules, freeing the meta line for the when/how-long/tag. */}
                <View className="rounded-sm bg-fill px-1.5 py-0.5">
                  <Text className="text-[11px] font-semibold text-muted-foreground" numberOfLines={1}>
                    {marketLabel(trade.instrument_type)}
                  </Text>
                </View>
                <View className="rounded-sm bg-fill px-1.5 py-0.5">
                  <Text className="text-[11px] font-semibold text-muted-foreground" numberOfLines={1}>
                    <Text className={trade.direction === 'long' ? 'text-profit' : 'text-loss'}>
                      {trade.direction === 'long' ? '↗ ' : '↘ '}
                    </Text>
                    {position}
                  </Text>
                </View>
              </View>
              <Text className="text-sm text-muted-foreground tabular-nums" numberOfLines={1}>
                {tradePriceLine(trade, money)}
              </Text>
              <View className="flex-row items-center gap-[5px]">
                <Text className="shrink text-xs text-muted-foreground tabular-nums" numberOfLines={1}>
                  {meta}
                </Text>
                {hasNotes ? (
                  <Icon name="square.and.pencil" size={11} tintColor={mutedForeground} />
                ) : null}
              </View>
            </View>
            <View className="items-end gap-1">
              <Text className="text-[11px] text-muted-foreground tabular-nums" numberOfLines={1}>
                {stamp}
              </Text>
              <Text
                selectable
                className={cn('text-[17px] font-semibold tabular-nums', pnlClass(trade.net_pnl))}
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
