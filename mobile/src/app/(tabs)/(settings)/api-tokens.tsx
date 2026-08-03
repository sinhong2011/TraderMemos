import { ContentUnavailableView, Host } from '@expo/ui/swift-ui';
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
import { formatDate } from '@/lib/format';

/** One token, with a trailing swipe to revoke (the trades-list idiom). */
function TokenRow({ token, onRevoke }: { token: AccessToken; onRevoke: () => void }) {
  const { theme } = useUnistyles();
  const swipeable = useRef<SwipeableMethods>(null);
  const expires = token.expires_at ? formatDate(token.expires_at) : t`never`;
  const lastUsed = token.last_used_at ? formatDate(token.last_used_at) : t`never`;

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
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowName} numberOfLines={1}>
            {token.name}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {t`Expires ${expires} · Last used ${lastUsed}`}
          </Text>
        </View>
        <Text style={styles.rowPrefix}>{`${token.token_prefix}…`}</Text>
      </View>
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
          renderItem={({ item }) => <TokenRow token={item} onRevoke={() => confirmRevoke(item)} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={
            (tokens.data ?? []).length > 0 ? (
              <Text style={styles.footnote}>
                {t`Tokens authenticate scripts and integrations against your server's API. Swipe a row to revoke.`}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <Host style={styles.empty}>
              <ContentUnavailableView
                title={t`No tokens yet`}
                systemImage="key"
                description={t`Tap + to generate one and authenticate scripts against your server.`}
              />
            </Host>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
  },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  rowMeta: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  rowPrefix: { fontSize: 13, color: theme.colors.mutedForeground, ...theme.numeric },
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
