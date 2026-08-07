import { ContentUnavailableView } from '@expo/ui/swift-ui';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { SymbolView } from 'expo-symbols';
import { useRef } from 'react';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { queryKeys, useAccessTokens, useApiRequest } from '@/api/hooks';
import type { AccessToken } from '@/api/types';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { useFormatters } from '@/lib/format';
import { AppHost } from '@/components/app-host';

/** One token, with a trailing swipe to revoke (the trades-list idiom). */
function TokenRow({
  token,
  onRevoke,
  onPress,
}: {
  token: AccessToken;
  onRevoke: () => void;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  // Bound to the display timezone (see lib/format.ts).
  const { formatDate } = useFormatters();
  const swipeable = useRef<SwipeableMethods>(null);
  const lastUsed = token.last_used_at ? formatDate(token.last_used_at) : t`never`;
  // A token past its expiry still lists, so the badge has to say so — "Expires
  // Aug 4" reads as live when that date is in the past.
  const expiry: { label: string; tone: 'quiet' | 'bad' } =
    token.expires_at == null
      ? { label: t`No expiry`, tone: 'quiet' }
      : // `new Date()`, not `Date.now()` — react-hooks/purity rejects the
        // latter in render, and the rest of the app reads the clock this way.
        new Date(token.expires_at) < new Date()
        ? { label: t`Expired`, tone: 'bad' }
        : { label: t`Expires ${formatDate(token.expires_at)}`, tone: 'quiet' };

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      rightThreshold={36}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={() => {
            swipeable.current?.close();
            onRevoke();
          }}
          accessibilityRole="button"
          accessibilityLabel={t`Revoke`}
          style={({ pressed }) => [
            styles.swipeAction,
            { backgroundColor: theme.colors.destructive },
            pressed && styles.pressed,
          ]}
        >
          <SymbolView name="key.slash.fill" size={17} tintColor="#FFFFFF" />
          <Text style={styles.swipeLabel} numberOfLines={1}>
            {t`Revoke`}
          </Text>
        </Pressable>
      )}
    >
      {/* Name and a lifecycle badge on the title line; the prefix below as a
          monospaced chip, because it is a fragment of a credential and reads
          as one — loose grey text next to prose looks like a caption. Last
          used sits with it on the same baseline: both answer "which token is
          this and is it live". */}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t`${token.name} activity`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.rowTop}>
          <SymbolView
            name="key.horizontal.fill"
            size={15}
            tintColor={theme.colors.mutedForeground}
            resizeMode="scaleAspectFit"
          />
          <Text style={styles.rowName} numberOfLines={1}>
            {token.name}
          </Text>
          <View style={[styles.badge, expiry.tone === 'bad' && styles.badgeBad]}>
            <Text style={[styles.badgeText, expiry.tone === 'bad' && styles.badgeTextBad]}>
              {expiry.label}
            </Text>
          </View>
          {/* The row pushes now, so it says so. */}
          <SymbolView name="chevron.right" size={12} tintColor={theme.colors.mutedForeground} />
        </View>
        <View style={styles.rowBottom}>
          <View style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {`${token.token_prefix}…`}
            </Text>
          </View>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {t`Last used ${lastUsed}`}
          </Text>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

/**
 * Personal access tokens (web ApiTab parity): a FlashList like the trades
 * list — the token count is unbounded, and a SwiftUI Form Section renders
 * every row eagerly. Creation lives behind the bar's + button so the screen
 * stays a list; swipe a token to revoke it.
 */
export default function ApiTokensScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const tokens = useAccessTokens();

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/access-tokens/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.accessTokens() }),
    onError: (err) => Alert.alert(t`Could not revoke token`, err.message),
  });

  function confirmRevoke(token: AccessToken) {
    Alert.alert(
      t`Revoke token?`,
      t`“${token.name}” stops working immediately. This cannot be undone.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        { text: t`Revoke`, style: 'destructive', onPress: () => revoke.mutate(token.id) },
      ],
    );
  }

  const addButton = (
    <Pressable
      onPress={() => router.push('/new-token')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t`New token`}
      style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
    >
      <SymbolView name="plus" size={18} tintColor={theme.colors.foreground} weight="semibold" />
    </Pressable>
  );

  return (
    <>
      <Stack.Screen options={{ headerRight: () => addButton }} />
      {tokens.isLoading ? (
        <View style={[styles.page, styles.skeletonPage]}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} style={styles.skeletonRow} />
          ))}
        </View>
      ) : (
        <FlashList
          data={tokens.data ?? []}
          keyExtractor={(token) => token.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={tokens.isRefetching}
              onRefresh={() => void tokens.refetch()}
            />
          }
          renderItem={({ item }) => (
            <TokenRow
              token={item}
              onRevoke={() => confirmRevoke(item)}
              onPress={() =>
                router.push({
                  pathname: '/token-uses',
                  params: { id: item.id, name: item.name },
                })
              }
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={
            (tokens.data ?? []).length > 0 ? (
              <Text style={styles.footnote}>
                {t`Tokens authenticate scripts and integrations against your server's API. Tap one to see where it has been used; swipe to revoke.`}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <AppHost style={styles.empty}>
              <ContentUnavailableView
                title={t`No tokens yet`}
                systemImage="key"
                description={t`Tap + to generate one and authenticate scripts against your server.`}
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
  addButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.mutedForeground,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xs,
  },
  row: {
    gap: 6,
    backgroundColor: theme.colors.card,
    boxShadow: theme.shadows.card,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  rowName: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.muted,
  },
  badgeBad: { backgroundColor: `${theme.colors.destructive}1F` },
  badgeText: { fontSize: 11, fontWeight: '600', color: theme.colors.mutedForeground },
  badgeTextBad: { color: theme.colors.destructive },
  /** The prefix is a credential fragment — Menlo makes it read as one, and
   *  keeps `tm_pat_` aligned across rows for scanning against a log. */
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  chipText: { fontFamily: 'Menlo', fontSize: 11.5, color: theme.colors.mutedForeground },
  /** Pushed to the trailing edge so it sits under the expiry badge — the two
   *  lifecycle facts form a right-hand column, the identity a left-hand one. */
  rowMeta: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
  separator: { height: theme.spacing.sm },
  swipeAction: {
    width: 72,
    marginLeft: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
  },
  pressed: { opacity: 0.7 },
  swipeLabel: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
  empty: { minHeight: 320 },
  skeletonPage: { padding: theme.spacing.lg, gap: theme.spacing.sm, paddingTop: 120 },
  skeletonRow: { height: 72, borderRadius: theme.radius.lg },
}));
