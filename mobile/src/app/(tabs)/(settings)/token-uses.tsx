import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { RefreshControl, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { useAccessTokenUses } from '@/api/hooks';
import type { AccessTokenUse } from '@/api/types';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { useFormatters } from '@/lib/format';
import { t } from '@lingui/core/macro';

/**
 * A user-agent shortened to what you actually scan for. The full string stays
 * on the row beneath — the point is recognising your own tooling, and
 * "python-requests/2.32.3" tells you more than a guessed-at "Python".
 */
function shortAgent(agent: string): string {
  if (!agent.trim()) return t`Unknown client`;
  return agent.split(' ')[0];
}

function UseRow({ use }: { use: AccessTokenUse }) {
  const { formatDate, formatTime } = useFormatters();
  return (
    <View className="gap-1.5 rounded-lg bg-card p-4">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-[15px] font-semibold text-foreground" numberOfLines={1}>
          {shortAgent(use.user_agent)}
        </Text>
        <Text className="text-xs tabular-nums text-muted-foreground" numberOfLines={1}>
          {`${formatDate(use.used_at)} · ${formatTime(use.used_at)}`}
        </Text>
      </View>
      <View className="gap-1">
        {/* The IP is an address, not prose — Menlo makes it read as one. */}
        <View className="self-start rounded-sm bg-muted px-[7px] py-0.5">
          <Text
            className="text-[11.5px] text-muted-foreground"
            style={{ fontFamily: 'Menlo' }}
            numberOfLines={1}
          >
            {use.ip || t`no IP`}
          </Text>
        </View>
        {/* The full agent, selectable: this is the string you paste into a
            search when you don't recognise it. Skipped when it adds nothing —
            a one-word agent like "curl/8.4.0" is already the heading, and
            printing it twice reads like a rendering bug. */}
        {use.user_agent.trim() && use.user_agent.trim() !== shortAgent(use.user_agent) ? (
          <Text
            selectable
            className="text-[11px] leading-[15px] text-muted-foreground"
            numberOfLines={2}
          >
            {use.user_agent}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Where one token has been used from.
 *
 * The server appends a row when the client looks new — a different IP or
 * user-agent, or the same one after ten minutes — so this is a list of
 * *clients*, not of requests. A cron shows up once, not 2 880 times a day.
 */
export default function TokenUsesScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const uses = useAccessTokenUses(id ?? '');
  // Ahead of the empty state: "Not used yet" is a claim about the token, and a
  // failed load has no business making it.
  const loadFailed = uses.isError && uses.data == null;

  return (
    <>
      <Stack.Screen options={{ title: name || t`Token activity` }} />
      {uses.isLoading ? (
        <View className="flex-1 gap-2 bg-background p-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[78px] rounded-lg" />
          ))}
        </View>
      ) : loadFailed ? (
        <ErrorState
          error={uses.error}
          onRetry={() => void uses.refetch()}
          retrying={uses.isRefetching}
        />
      ) : (
        // The page colour lives on a wrapper: `contentContainerStyle` is a
        // plain style object on FlashList, so it can hold the padding but not
        // a themed class.
        <View className="flex-1 bg-background">
          <FlashList
            data={uses.data ?? []}
            keyExtractor={(use) => `${use.used_at}-${use.ip}-${use.user_agent}`}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
            refreshControl={
              <RefreshControl
                refreshing={uses.isRefetching}
                onRefresh={() => void uses.refetch()}
              />
            }
            renderItem={({ item }) => <UseRow use={item} />}
            ItemSeparatorComponent={() => <View className="h-2" />}
            ListFooterComponent={
              (uses.data ?? []).length > 0 ? (
                <Text className="pt-4 text-xs leading-[17px] text-muted-foreground">
                  {t`One entry per client, not per request — a repeat from the same IP and app is folded in for ten minutes. The 50 most recent are kept.`}
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <View className="min-h-[320px] flex-1">
                <EmptyState
                  title={t`Not used yet`}
                  systemImage="clock.arrow.circlepath"
                  description={t`When something authenticates with this token, the IP and app it used show up here.`}
                />
              </View>
            }
          />
        </View>
      )}
    </>
  );
}
