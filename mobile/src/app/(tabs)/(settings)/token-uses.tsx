
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { RefreshControl, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { EmptyState } from '@/components/empty-state';
import { useAccessTokenUses } from '@/api/hooks';
import type { AccessTokenUse } from '@/api/types';
import { AppHost } from '@/components/app-host';
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
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.agent} numberOfLines={1}>
          {shortAgent(use.user_agent)}
        </Text>
        <Text style={styles.when} numberOfLines={1}>
          {`${formatDate(use.used_at)} · ${formatTime(use.used_at)}`}
        </Text>
      </View>
      <View style={styles.rowBottom}>
        <View style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>
            {use.ip || t`no IP`}
          </Text>
        </View>
        {/* The full agent, selectable: this is the string you paste into a
            search when you don't recognise it. Skipped when it adds nothing —
            a one-word agent like "curl/8.4.0" is already the heading, and
            printing it twice reads like a rendering bug. */}
        {use.user_agent.trim() && use.user_agent.trim() !== shortAgent(use.user_agent) ? (
          <Text selectable style={styles.fullAgent} numberOfLines={2}>
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
        <View style={[styles.page, styles.skeletonPage]}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} style={styles.skeletonRow} />
          ))}
        </View>
      ) : loadFailed ? (
        <ErrorState
          error={uses.error}
          onRetry={() => void uses.refetch()}
          retrying={uses.isRefetching}
        />
      ) : (
        <FlashList
          data={uses.data ?? []}
          keyExtractor={(use) => `${use.used_at}-${use.ip}-${use.user_agent}`}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={uses.isRefetching} onRefresh={() => void uses.refetch()} />
          }
          renderItem={({ item }) => <UseRow use={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={
            (uses.data ?? []).length > 0 ? (
              <Text style={styles.footnote}>
                {t`One entry per client, not per request — a repeat from the same IP and app is folded in for ten minutes. The 50 most recent are kept.`}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <AppHost style={styles.empty}>
              <EmptyState
                title={t`Not used yet`}
                systemImage="clock.arrow.circlepath"
                description={t`When something authenticates with this token, the IP and app it used show up here.`}
              />
            </AppHost>
          }
        />
      )}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
    backgroundColor: theme.colors.background,
  },
  row: {
    gap: 6,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  agent: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  when: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  rowBottom: { gap: 4 },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  chipText: { fontFamily: 'Menlo', fontSize: 11.5, color: theme.colors.mutedForeground },
  fullAgent: { fontSize: 11, lineHeight: 15, color: theme.colors.mutedForeground },
  separator: { height: theme.spacing.sm },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.mutedForeground,
    paddingTop: theme.spacing.lg,
  },
  skeletonPage: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  skeletonRow: { height: 78, borderRadius: theme.radius.lg },
  empty: { flex: 1, minHeight: 320 },
}));
