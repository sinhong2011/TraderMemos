import { ContentUnavailableView } from '@expo/ui/swift-ui';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef } from 'react';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useAccounts, useApiRequest, useCash } from '@/api/hooks';
import type { Account, CashTransaction } from '@/api/types';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { cashTypeLabel } from '@/lib/cash';
import { formatCurrency, formatDate } from '@/lib/format';
import { AppHost } from '@/components/app-host';

/** One ledger entry: tap to edit, trailing swipe to remove (the api-tokens idiom). */
function TransactionRow({
  transaction,
  account,
  onEdit,
  onRemove,
}: {
  transaction: CashTransaction;
  account?: Account;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { theme } = useUnistyles();
  const swipeable = useRef<SwipeableMethods>(null);
  // Withdrawals and fees are stored negative, but older rows can carry a bare
  // positive amount — the type still decides the direction.
  const isOutflow =
    transaction.amount < 0 || transaction.type === 'withdrawal' || transaction.type === 'fee';
  const signed = isOutflow ? -Math.abs(transaction.amount) : transaction.amount;
  const date = formatDate(transaction.occurred_at);

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
            onRemove();
          }}
          accessibilityRole="button"
          accessibilityLabel={t`Remove`}
          style={({ pressed }) => [
            styles.swipeAction,
            { backgroundColor: theme.colors.destructive },
            pressed && styles.pressed,
          ]}
        >
          <SymbolView name="trash.fill" size={17} tintColor="#FFFFFF" />
          <Text style={styles.swipeLabel} numberOfLines={1}>
            {t`Remove`}
          </Text>
        </Pressable>
      )}
    >
      <Pressable onPress={onEdit} accessibilityRole="button">
        {({ pressed }) => (
          <View style={[styles.row, pressed && styles.pressed]}>
            <View style={styles.rowText}>
              <Text style={styles.rowName} numberOfLines={1}>
                {account ? `${cashTypeLabel(transaction.type)} · ${account.name}` : cashTypeLabel(transaction.type)}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {transaction.note ? `${date} · ${transaction.note}` : date}
              </Text>
            </View>
            <Text
              style={[
                styles.rowAmount,
                { color: isOutflow ? theme.colors.loss : theme.colors.profit },
              ]}
              numberOfLines={1}
            >
              {formatCurrency(signed, transaction.currency || 'USD')}
            </Text>
          </View>
        )}
      </Pressable>
    </ReanimatedSwipeable>
  );
}

/**
 * Deposits & withdrawals (web "Deposits & withdrawals" section): the cash
 * ledger across all accounts, newest first. Built like api-tokens.tsx rather
 * than as a SwiftUI Form — the ledger is unbounded and a Form Section renders
 * every row eagerly. Creation lives behind the bar's + button so the screen
 * stays a list; rows push the edit form, swipe removes.
 *
 * No running total in the header: accounts can hold different base currencies,
 * so a single summed figure would be wrong. Per-account balances live on the
 * account rows (ledgerBalance in lib/cash.ts).
 */
export default function FundingScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const { data: accounts } = useAccounts();
  const cash = useCash();

  const transactions = useMemo(
    () =>
      [...(cash.data ?? [])].sort(
        (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
      ),
    [cash.data],
  );

  const remove = useMutation({
    mutationFn: (id: string) => api(`/cash-transactions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cash'] });
      // Funding feeds the dashboard equity/goal cards too.
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (err) => Alert.alert(t`Could not remove transaction`, err.message),
  });

  function confirmRemove(transaction: CashTransaction) {
    Alert.alert(t`Remove transaction?`, t`This permanently deletes the ledger entry.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Remove`, style: 'destructive', onPress: () => remove.mutate(transaction.id) },
    ]);
  }

  const addButton = (
    <Pressable
      onPress={() => router.push('/cash-form')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t`Add transaction`}
      style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
    >
      <SymbolView name="plus" size={18} tintColor={theme.colors.foreground} weight="semibold" />
    </Pressable>
  );

  return (
    <>
      <Stack.Screen options={{ headerRight: () => addButton }} />
      {cash.isLoading ? (
        <View style={[styles.page, styles.skeletonPage]}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} style={styles.skeletonRow} />
          ))}
        </View>
      ) : (
        <FlashList
          data={transactions}
          keyExtractor={(transaction) => transaction.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          // Pull-to-refresh is why this screen runs an inline title instead of
          // a large one (see the layout). A native RefreshControl on a *pushed*
          // `headerLargeTitle` screen leaks its own 60pt height into the stack's
          // top content inset on every push — the list starts 60pt lower each
          // time you enter it (168 → 228 → 288 …) and never resets. iOS 26 /
          // react-native-screens 4.26; deferring or remounting the control does
          // not help, only dropping the large title does.
          refreshControl={
            <RefreshControl refreshing={cash.isRefetching} onRefresh={() => void cash.refetch()} />
          }
          renderItem={({ item }) => (
            <TransactionRow
              transaction={item}
              account={accounts?.find((candidate) => candidate.id === item.account_id)}
              onEdit={() => router.push({ pathname: '/cash-form', params: { id: item.id } })}
              onRemove={() => confirmRemove(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={
            transactions.length > 0 ? (
              <Text style={styles.footnote}>
                {t`Deposits, withdrawals, and fees drive the equity curve alongside trade P&L. Tap a row to edit it, swipe to remove.`}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <AppHost style={styles.empty}>
              <ContentUnavailableView
                title={t`No transactions yet`}
                systemImage="banknote"
                description={t`Tap + to log a deposit, withdrawal, or fee — they drive the equity curve alongside trade P&L.`}
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
    // No horizontal inset of its own — the helper text lines up with the card
    // edges above it, not 4pt inside them.
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
  rowAmount: { fontSize: 15, fontWeight: '600', ...theme.numeric },
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
