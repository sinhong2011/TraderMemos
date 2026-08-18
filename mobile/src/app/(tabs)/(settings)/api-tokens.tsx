import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { cn } from 'panelui-native';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { queryKeys, useAccessTokens, useApiRequest } from '@/api/hooks';
import type { AccessToken } from '@/api/types';
import { ErrorState } from '@/components/error-state';
import { HeaderIconButton } from '@/components/header-icon-button';
import { Skeleton } from '@/components/skeleton';
import { Swipe } from '@/components/swipe';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { useFormatters } from '@/lib/format';

/**
 * One token, in the trades-list row anatomy: a tap opens its activity, a long
 * press previews it, the trailing swipe revokes.
 */
function TokenRow({ token, onRevoke }: { token: AccessToken; onRevoke: () => void }) {
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  // Bound to the display timezone (see lib/format.ts).
  const { formatDate } = useFormatters();
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
    // List-recycling safe: `resetKey` snaps an open swipe shut when the
    // instance is handed a different token.
    <Swipe resetKey={token.id}>
      <Swipe.End>
        <Swipe.Action
          color="destructive"
          icon={<Icon name="key.slash.fill" />}
          label={t`Revoke`}
          onPress={onRevoke}
        />
      </Swipe.End>
      {/* Name and a lifecycle badge on the title line; the prefix below as a
          monospaced chip, because it is a fragment of a credential and reads
          as one — loose grey text next to prose looks like a caption. Last
          used sits with it on the same baseline: both answer "which token is
          this and is it live". */}
      <Link
        href={{ pathname: '/token-uses', params: { id: token.id, name: token.name } }}
        asChild
      >
        {/* Link.Trigger clones its child and overwrites `style`, so the
            Pressable stays bare and an inner View carries the row's surface
            (the trade-row rule). */}
        <Link.Trigger>
          <Pressable accessibilityLabel={t`${token.name} activity`}>
            <View className="gap-1.5 rounded-lg bg-card p-4">
              <View className="flex-row items-center gap-2">
          <Icon
            name="key.horizontal.fill"
            size={15}
            tintColor={mutedForeground}
            resizeMode="scaleAspectFit"
          />
          <Text className="flex-1 text-[15px] font-semibold text-foreground" numberOfLines={1}>
            {token.name}
          </Text>
          <View
            className={cn(
              'rounded-full px-2 py-[3px]',
              expiry.tone === 'bad' ? 'bg-destructive/12' : 'bg-muted',
            )}
          >
            <Text
              className={cn(
                'text-[11px] font-semibold',
                expiry.tone === 'bad' ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {expiry.label}
            </Text>
          </View>
          {/* The row pushes now, so it says so. */}
          <Icon name="chevron.right" size={12} tintColor={mutedForeground} />
        </View>
        <View className="flex-row items-center gap-2">
          {/* The prefix is a credential fragment — Menlo makes it read as one,
              and keeps `tm_pat_` aligned across rows for scanning against a
              log. */}
          <View className="rounded-sm bg-muted px-[7px] py-0.5">
            <Text
              className="text-[11.5px] text-muted-foreground"
              style={{ fontFamily: 'Menlo' }}
              numberOfLines={1}
            >
              {`${token.token_prefix}…`}
            </Text>
          </View>
          {/* Pushed to the trailing edge so it sits under the expiry badge —
              the two lifecycle facts form a right-hand column, the identity a
              left-hand one. */}
          <Text
            className="flex-1 text-right text-xs tabular-nums text-muted-foreground"
            numberOfLines={1}
          >
            {t`Last used ${lastUsed}`}
          </Text>
        </View>
            </View>
          </Pressable>
        </Link.Trigger>
        <Link.Preview />
      </Link>
    </Swipe>
  );
}

/**
 * Personal access tokens (web ApiTab parity): a FlashList like the trades
 * list — the token count is unbounded. Creation lives behind the bar's +
 * button so the screen stays a list; swipe a token to revoke it.
 */
export default function ApiTokensScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const tokens = useAccessTokens();

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/access-tokens/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.accessTokens() }),
    onError: (err) => Alert.alert(t`Could not revoke token`, errorMessage(err)),
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

  // Takes precedence over the list's empty state: "No tokens yet" on an
  // unreachable server tells the user their credentials are gone. Cached tokens
  // still win — a failed refresh is no reason to hide them.
  const loadFailed = tokens.isError && tokens.data == null;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderIconButton
              systemImage="plus"
              label={t`New token`}
              onPress={() => router.push('/new-token')}
            />
          ),
        }}
      />
      {tokens.isLoading ? (
        <View className="flex-1 gap-2 bg-background p-4 pt-[120px]">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-lg" />
          ))}
        </View>
      ) : loadFailed ? (
        <ErrorState
          error={tokens.error}
          onRetry={() => void tokens.refetch()}
          retrying={tokens.isRefetching}
        />
      ) : (
        // The page colour lives on a wrapper: `contentContainerStyle` is a
        // plain style object on FlashList, so it can hold the padding but not
        // a themed class.
        <View className="flex-1 bg-background">
          <FlashList
            data={tokens.data ?? []}
            keyExtractor={(token) => token.id}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
            refreshControl={
              <RefreshControl
                refreshing={tokens.isRefetching}
                onRefresh={() => void tokens.refetch()}
              />
            }
            renderItem={({ item }) => (
              <TokenRow token={item} onRevoke={() => confirmRevoke(item)} />
            )}
            ItemSeparatorComponent={() => <View className="h-2" />}
            ListFooterComponent={
              (tokens.data ?? []).length > 0 ? (
                <Text className="px-1 pt-4 text-xs leading-[17px] text-muted-foreground">
                  {t`Tokens authenticate scripts and integrations against your server's API. Tap one to see where it has been used; swipe to revoke.`}
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <View className="min-h-[320px]">
                <EmptyState
                  title={t`No tokens yet`}
                  systemImage="key"
                  description={t`Tap + to generate one and authenticate scripts against your server.`}
                />
              </View>
            }
          />
        </View>
      )}
    </>
  );
}
