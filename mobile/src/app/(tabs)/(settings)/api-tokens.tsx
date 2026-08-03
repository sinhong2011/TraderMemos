import { ContentUnavailableView, Host } from '@expo/ui/swift-ui';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, Share, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { queryKeys, useAccessTokens, useApiRequest } from '@/api/hooks';
import type { AccessToken, CreatedAccessToken } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { FormField, FormInput } from '@/components/form-sheet';
import { GlassButton } from '@/components/glass-button';
import { Segmented } from '@/components/segmented';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { formatDate } from '@/lib/format';

const EXPIRY_OPTIONS = [
  { value: 'never', label: () => t`Never` },
  { value: '30', label: () => t`30d` },
  { value: '90', label: () => t`90d` },
  { value: '365', label: () => t`1y` },
];

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
 * Personal access tokens (web ApiTab parity) as a FlashList, like the trades
 * list — the token count is unbounded, and a SwiftUI Form Section renders
 * every row eagerly. The secret is shown once, right after creation: hand it
 * off through the share sheet (no clipboard module in the dev-client build),
 * then it is gone for good. Swipe a token to revoke it.
 */
export default function ApiTokensScreen() {
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const tokens = useAccessTokens();

  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('never');
  const [created, setCreated] = useState<CreatedAccessToken | null>(null);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.accessTokens() });

  const create = useMutation({
    mutationFn: (body: { name: string; expires_in_days?: number }) =>
      api<CreatedAccessToken>('/access-tokens', { method: 'POST', body }),
    onSuccess: (row) => {
      invalidate();
      setCreated(row);
      setName('');
    },
    onError: (err) => Alert.alert(t`Could not create token`, err.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/access-tokens/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: (err) => Alert.alert(t`Could not revoke token`, err.message),
  });

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert(t`Could not create token`, t`Token name is required.`);
      return;
    }
    create.mutate(
      expiry === 'never' ? { name: trimmed } : { name: trimmed, expires_in_days: Number(expiry) },
    );
  }

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

  const header = (
    <View style={styles.header}>
      {created ? (
        <DashboardCard title={t`New token`}>
          <Text selectable style={styles.secret}>
            {created.token}
          </Text>
          <Text style={styles.footnote}>
            {t`Copy it now — the secret is shown only once and cannot be recovered.`}
          </Text>
          <View style={styles.actions}>
            <GlassButton
              prominent
              label={t`Share token`}
              systemImage="square.and.arrow.up"
              onPress={() => void Share.share({ message: created.token })}
            />
            <GlassButton label={t`Done`} onPress={() => setCreated(null)} />
          </View>
        </DashboardCard>
      ) : (
        <DashboardCard title={t`Create token`}>
          <FormField label={t`Name`}>
            <FormInput
              value={name}
              onChangeText={setName}
              placeholder={t`e.g. CLI import`}
              autoCorrect={false}
            />
          </FormField>
          <FormField label={t`Expiry`}>
            <Segmented
              options={EXPIRY_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label(),
              }))}
              value={expiry}
              onChange={setExpiry}
            />
          </FormField>
          <View style={styles.actions}>
            <GlassButton
              prominent
              label={create.isPending ? t`Creating…` : t`Generate token`}
              systemImage="key"
              onPress={handleCreate}
            />
          </View>
          <Text style={styles.footnote}>
            {t`Tokens authenticate scripts and integrations against your server's API.`}
          </Text>
        </DashboardCard>
      )}
      {(tokens.data ?? []).length > 0 ? (
        <Text style={styles.sectionLabel}>{t`Active tokens`}</Text>
      ) : null}
    </View>
  );

  if (tokens.isLoading) {
    return (
      <View style={[styles.page, styles.skeletonPage]}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} style={styles.skeletonRow} />
        ))}
      </View>
    );
  }

  return (
    <FlashList
      data={tokens.data ?? []}
      keyExtractor={(token) => token.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl refreshing={tokens.isRefetching} onRefresh={() => void tokens.refetch()} />
      }
      ListHeaderComponent={header}
      renderItem={({ item }) => <TokenRow token={item} onRevoke={() => confirmRevoke(item)} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        <Host style={styles.empty}>
          <ContentUnavailableView
            title={t`No tokens yet`}
            systemImage="key"
            description={t`Generate one above to authenticate scripts against your server.`}
          />
        </Host>
      }
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
    backgroundColor: theme.colors.background,
  },
  header: { gap: theme.spacing.lg, paddingBottom: theme.spacing.md },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: theme.colors.accent,
    paddingHorizontal: theme.spacing.xs,
  },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.sm },
  secret: {
    fontSize: 13,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    ...theme.numeric,
  },
  footnote: { fontSize: 12, lineHeight: 17, color: theme.colors.mutedForeground },
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
  empty: { minHeight: 220 },
  skeletonPage: { padding: theme.spacing.lg, gap: theme.spacing.sm, paddingTop: 120 },
  skeletonRow: { height: 72, borderRadius: theme.radius.lg },
}));
