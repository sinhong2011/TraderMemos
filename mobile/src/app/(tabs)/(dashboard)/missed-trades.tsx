import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Card, Skeleton, cn } from 'panelui-native';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { queryKeys, useApiRequest, useMissedSummary, useMissedTrades, useSetups } from '@/api/hooks';
import type { MissedSummary, MissedTrade } from '@/api/types';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { Swipe } from '@/components/swipe';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { useFormatters } from '@/lib/format';
import { fmtR, outcomeLabel, reasonLabel } from '@/lib/missed';

const rTone = (r: number) => (r > 0 ? 'text-profit' : r < 0 ? 'text-loss' : 'text-foreground');

/**
 * Missed trades — setups seen and not taken, and what passing on them cost or
 * saved in R. Creation lives here (the header +), per the owning-screen rule;
 * tap a row to fill in its outcome or fix it, swipe to delete.
 */
export default function MissedTradesScreen() {
  const [foreground, background] = useCSSVariable(['--color-foreground', '--color-background']) as [
    string,
    string,
  ];
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const list = useMissedTrades();
  const summary = useMissedSummary();
  const { data: setups } = useSetups();
  const setupName = (id: string) => setups?.find((s) => s.id === id)?.name ?? t`Deleted setup`;

  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/missed-trades/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.missedTrades() }),
    onError: (err) => Alert.alert(t`Could not delete`, errorMessage(err)),
  });

  const addButton = (
    <Pressable
      onPress={() => router.push('/missed-trade-form')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t`Log a missed trade`}
      className="h-8 w-8 items-center justify-center active:opacity-70"
    >
      <Icon name="plus" size={18} tintColor={foreground} weight="semibold" />
    </Pressable>
  );

  return (
    <>
      <Stack.Screen options={{ headerRight: () => addButton }} />
      {list.isLoading ? (
        <View className="flex-1 gap-2 bg-background p-4 pt-[120px]">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-lg" />
          ))}
        </View>
      ) : list.error && list.data == null ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} retrying={list.isRefetching} />
      ) : (
        <FlashList
          data={list.data ?? []}
          keyExtractor={(m) => m.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 48,
            backgroundColor: background,
          }}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching}
              onRefresh={() => {
                void list.refetch();
                void summary.refetch();
              }}
            />
          }
          ListHeaderComponent={
            summary.data && summary.data.count > 0 ? (
              <View className="pb-3">
                <SummaryCard summary={summary.data} setupName={setupName} />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <MissedRow
              trade={item}
              setupName={setupName}
              onPress={() => router.push({ pathname: '/missed-trade-form', params: { id: item.id } })}
              onDelete={() => remove.mutate(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={
            <View className="min-h-[320px]">
              <EmptyState
                title={t`No missed trades logged`}
                systemImage="binoculars"
                description={t`Saw a setup and didn't take it? Log it with +, then mark how it played out.`}
              />
            </View>
          }
        />
      )}
    </>
  );
}

function SummaryCard({
  summary,
  setupName,
}: {
  summary: MissedSummary;
  setupName: (id: string) => string;
}) {
  const pending = summary.outcomes.unknown;
  const top = [
    ...summary.by_reason.filter((g) => g.scored > 0).map((g) => ({ ...g, label: reasonLabel(g.key) })),
  ].slice(0, 3);
  const topSetups = summary.by_setup
    .filter((g) => g.scored > 0)
    .slice(0, 2)
    .map((g) => ({ ...g, label: setupName(g.key) }));

  return (
    <Card className="gap-3 rounded-lg border-0 p-4">
      <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t`Would have made`}
      </Text>
      <View className="flex-row items-baseline gap-2">
        <Text
          className={cn(
            'text-[28px] font-bold tabular-nums',
            summary.scored ? rTone(summary.net_r) : 'text-muted-foreground',
          )}
        >
          {summary.scored ? fmtR(summary.net_r) : t`No outcomes yet`}
        </Text>
        {summary.avg_r != null ? (
          <Text className="text-[13px] text-muted-foreground">{t`${fmtR(summary.avg_r)} per miss`}</Text>
        ) : null}
      </View>
      <View className="flex-row gap-6">
        <View className="gap-0.5">
          <Text className="text-[11px] text-muted-foreground">{t`Left on the table`}</Text>
          <Text className="text-[15px] font-semibold tabular-nums text-foreground">
            {fmtR(summary.r_left)}
          </Text>
        </View>
        <View className="gap-0.5">
          <Text className="text-[11px] text-muted-foreground">{t`Losses avoided`}</Text>
          <Text className="text-[15px] font-semibold tabular-nums text-foreground">
            {fmtR(-summary.r_avoided)}
          </Text>
        </View>
        <View className="gap-0.5">
          <Text className="text-[11px] text-muted-foreground">{t`Logged`}</Text>
          <Text className="text-[15px] font-semibold tabular-nums text-foreground">
            {String(summary.count)}
          </Text>
        </View>
      </View>
      {[...top, ...topSetups].length > 0 ? (
        <View className="gap-1">
          {[...top, ...topSetups].map((g) => (
            <View key={`${g.key}-${g.label}`} className="flex-row justify-between">
              <Text className="text-[13px] text-foreground">{g.label}</Text>
              <Text className={cn('text-[13px] font-semibold tabular-nums', rTone(g.net_r))}>
                {fmtR(g.net_r)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {pending > 0 ? (
        <Text className="text-[12px] text-muted-foreground">{t`${pending} still need an outcome.`}</Text>
      ) : null}
    </Card>
  );
}

function MissedRow({
  trade,
  setupName,
  onPress,
  onDelete,
}: {
  trade: MissedTrade;
  setupName: (id: string) => string;
  onPress: () => void;
  onDelete: () => void;
}) {
  // Formatters bound to the display prefs (timezone, clock) — see lib/format.ts.
  const { formatDate, formatTime } = useFormatters();
  return (
    <Swipe resetKey={trade.id}>
      <Swipe.End>
        <Swipe.Action color="destructive" icon={<Icon name="trash.fill" />} label={t`Delete`} onPress={onDelete} />
      </Swipe.End>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={trade.symbol}>
        <Card className="gap-1.5 rounded-lg border-0 p-4">
          <View className="flex-row items-baseline gap-2">
            <Text className="text-[15px] font-semibold text-foreground">{trade.symbol}</Text>
            <Text className={cn('text-[12px]', trade.direction === 'long' ? 'text-profit' : 'text-loss')}>
              {trade.direction === 'long' ? t`Long` : t`Short`}
            </Text>
            <Text className="flex-1 text-right text-xs text-muted-foreground tabular-nums">
              {`${formatDate(trade.observed_at)} ${formatTime(trade.observed_at)}`}
            </Text>
          </View>
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Pill tone={trade.outcome === 'unknown' ? 'amber' : 'muted'}>{outcomeLabel(trade.outcome)}</Pill>
            {trade.r != null ? (
              <Pill tone={trade.r > 0 ? 'pos' : trade.r < 0 ? 'neg' : 'muted'}>{fmtR(trade.r)}</Pill>
            ) : trade.planned_r != null ? (
              <Pill tone="muted">{t`Planned ${trade.planned_r.toFixed(2)}R`}</Pill>
            ) : null}
            {trade.reason ? <Pill tone="muted">{reasonLabel(trade.reason)}</Pill> : null}
            {trade.setup_id ? <Pill tone="muted">{setupName(trade.setup_id)}</Pill> : null}
          </View>
          {trade.notes ? (
            <Text className="text-[13px] text-muted-foreground" numberOfLines={2}>
              {trade.notes}
            </Text>
          ) : null}
        </Card>
      </Pressable>
    </Swipe>
  );
}
