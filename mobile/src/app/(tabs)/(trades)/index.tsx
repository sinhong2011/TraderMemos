import { Stack } from 'expo-router/stack';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useTrades } from '@/api/hooks';
import { Segmented } from '@/components/segmented';
import { TradeRow } from '@/components/trade-row';
import { t } from '@lingui/core/macro';
import { formatPnl } from '@/lib/format';
import { pnlColor } from '@/styles/unistyles';

type StatusFilter = 'all' | 'win' | 'loss' | 'open';

function matchesStatus(filter: StatusFilter, trade: { status: string; net_pnl: number | null }) {
  switch (filter) {
    case 'all':
      return true;
    case 'open':
      return trade.status === 'open';
    case 'win':
      return trade.status !== 'open' && (trade.net_pnl ?? 0) > 0;
    case 'loss':
      return trade.status !== 'open' && (trade.net_pnl ?? 0) < 0;
  }
}

export default function TradesScreen() {
  const { theme } = useUnistyles();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const { data, isLoading, error, refetch, isRefetching } = useTrades();

  const trades = useMemo(() => {
    const rows = (data ?? []).filter((trade) => matchesStatus(status, trade));
    const term = search.trim().toUpperCase();
    if (!term) return rows;
    return rows.filter(
      (trade) =>
        trade.symbol.toUpperCase().includes(term) ||
        trade.tags.some((tag) => tag.name.toUpperCase().includes(term)),
    );
  }, [data, search, status]);

  const netTotal = useMemo(
    () => trades.reduce((sum, trade) => sum + (trade.net_pnl ?? 0), 0),
    [trades],
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text selectable style={styles.muted}>
          {error.message}
        </Text>
      </View>
    );
  }

  const filters = [
    { value: 'all' as const, label: t`All` },
    { value: 'win' as const, label: t`Wins` },
    { value: 'loss' as const, label: t`Losses` },
    { value: 'open' as const, label: t`Open` },
  ];
  const count = trades.length;

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: t`Search symbol or tag`,
            onChangeText: (event) => setSearch(event.nativeEvent.text),
          },
        }}
      />
      <FlatList
        style={styles.page}
        data={trades}
        keyExtractor={(trade) => trade.id}
        renderItem={({ item }) => <TradeRow trade={item} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Segmented options={filters} value={status} onChange={setStatus} />
            <Text style={styles.summary}>
              {t`${count} trades`}
              {count > 0 ? (
                <>
                  {' · '}
                  <Text style={[styles.summaryNet, { color: pnlColor(theme.colors, netTotal) }]}>
                    {formatPnl(netTotal, trades[0]?.pnl_currency)}
                  </Text>
                </>
              ) : null}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.muted}>
              {search
                ? t`No trades matching "${search}"`
                : status !== 'all'
                  ? t`No trades match this filter.`
                  : t`No trades yet — import a broker CSV to get started.`}
            </Text>
          </View>
        }
      />
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
  },
  header: { gap: theme.spacing.sm, paddingBottom: theme.spacing.xs },
  summary: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  summaryNet: { fontWeight: '600' },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  muted: { color: theme.colors.mutedForeground, textAlign: 'center' },
}));
