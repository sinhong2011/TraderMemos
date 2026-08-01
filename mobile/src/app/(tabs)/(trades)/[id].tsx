import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useTrade } from '@/api/hooks';
import { DashboardCard } from '@/components/dashboard-card';
import { Pill } from '@/components/pill';
import { t } from '@lingui/core/macro';
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatPnl,
  formatTime,
} from '@/lib/format';
import { marketLabel, tradeNotional, tradeRMultiple, tradeStatus } from '@/lib/trades';
import { pnlColor } from '@/styles/unistyles';

function Row({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text selectable style={[styles.rowValue, tint ? { color: tint } : null]}>
        {value}
      </Text>
    </View>
  );
}

function statusLabel(label: ReturnType<typeof tradeStatus>['label']): string {
  switch (label) {
    case 'WIN':
      return t`WIN`;
    case 'LOSS':
      return t`LOSS`;
    case 'OPEN':
      return t`OPEN`;
    case 'BE':
      return t`BE`;
  }
}

export default function TradeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useUnistyles();
  const { data: trade, isLoading, error, refetch, isRefetching } = useTrade(id);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !trade) {
    return (
      <View style={styles.centered}>
        <Text selectable style={styles.muted}>
          {error?.message ?? t`Trade not found`}
        </Text>
      </View>
    );
  }

  const status = tradeStatus(trade);
  const isLong = trade.direction === 'long';
  const isOpen = trade.status === 'open';
  const currency = trade.pnl_currency;
  const tint = pnlColor(theme.colors, trade.net_pnl);
  const r = tradeRMultiple(trade);
  const captionParts = [
    ...(trade.return_pct != null
      ? [`${trade.return_pct >= 0 ? '+' : ''}${trade.return_pct.toFixed(2)}%`]
      : []),
    ...(r != null ? [`${r.toFixed(2)}R`] : []),
  ];

  return (
    <>
      <Stack.Screen options={{ title: trade.symbol }} />
      <ScrollView
        style={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
      >
        <View style={styles.hero}>
          <View style={styles.pillRow}>
            <Pill tone="muted">
              <Text style={{ color: isLong ? theme.colors.profit : theme.colors.loss }}>
                {isLong ? '↗ ' : '↘ '}
              </Text>
              {isLong ? t`LONG` : t`SHORT`}
            </Pill>
            <Pill tone={status.tone}>{statusLabel(status.label)}</Pill>
            <Pill tone="muted">{marketLabel(trade.instrument_type)}</Pill>
          </View>
          <Text selectable style={[styles.heroValue, isOpen ? styles.heroOpen : { color: tint }]}>
            {isOpen ? t`Open` : formatPnl(trade.net_pnl, currency)}
          </Text>
          {captionParts.length > 0 ? (
            <Text
              style={[
                styles.heroCaption,
                { color: isOpen ? theme.colors.mutedForeground : tint },
              ]}
            >
              {captionParts.join(' · ')}
            </Text>
          ) : null}
        </View>

        <DashboardCard title={t`Timing`}>
          <Row
            label={t`Opened`}
            value={`${formatDate(trade.opened_at)} ${formatTime(trade.opened_at)}`}
          />
          <Row
            label={t`Closed`}
            value={
              trade.closed_at ? `${formatDate(trade.closed_at)} ${formatTime(trade.closed_at)}` : '—'
            }
          />
          <Row label={t`Time in trade`} value={formatDuration(trade.time_in_trade_secs)} />
        </DashboardCard>

        <DashboardCard title={t`Position`}>
          <Row label={t`Quantity`} value={String(trade.qty_opened)} />
          {trade.qty_remaining > 0 ? (
            <Row label={t`Remaining`} value={String(trade.qty_remaining)} />
          ) : null}
          <Row label={t`Avg entry`} value={formatCurrency(trade.avg_entry_price, currency)} />
          <Row label={t`Avg exit`} value={formatCurrency(trade.avg_exit_price, currency)} />
          <Row label={t`Notional`} value={formatCurrency(tradeNotional(trade), currency)} />
        </DashboardCard>

        <DashboardCard title={t`P&L`}>
          <Row
            label={t`Gross P&L`}
            value={formatPnl(trade.gross_pnl, currency)}
            tint={pnlColor(theme.colors, trade.gross_pnl)}
          />
          <Row label={t`Fees`} value={formatCurrency(trade.fees_total, currency)} />
          <Row label={t`Net P&L`} value={formatPnl(trade.net_pnl, currency)} tint={tint} />
          {trade.initial_risk != null ? (
            <Row label={t`Initial risk`} value={formatCurrency(trade.initial_risk, currency)} />
          ) : null}
          {r != null ? <Row label={t`R multiple`} value={`${r.toFixed(2)}R`} tint={tint} /> : null}
        </DashboardCard>

        {trade.tags.length > 0 ? (
          <DashboardCard title={t`Tags`}>
            <View style={styles.tags}>
              {trade.tags.map((tag) => (
                <Pill key={tag.id} tone={tag.kind === 'mistake' ? 'neg' : 'muted'}>
                  {tag.name}
                </Pill>
              ))}
            </View>
          </DashboardCard>
        ) : null}

        {trade.notes ? (
          <DashboardCard title={t`Notes`}>
            <Text selectable style={styles.notes}>
              {trade.notes}
            </Text>
          </DashboardCard>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  muted: { color: theme.colors.mutedForeground, textAlign: 'center' },
  hero: { gap: theme.spacing.sm },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  heroValue: { fontSize: 36, fontWeight: '700', letterSpacing: -1, ...theme.numeric },
  heroOpen: { color: theme.colors.mutedForeground },
  heroCaption: { fontSize: 14, fontWeight: '500', ...theme.numeric },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  rowLabel: { fontSize: 15, color: theme.colors.mutedForeground },
  rowValue: { fontSize: 15, fontWeight: '500', color: theme.colors.foreground, ...theme.numeric },
  notes: { fontSize: 15, lineHeight: 22, color: theme.colors.foreground },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
}));
