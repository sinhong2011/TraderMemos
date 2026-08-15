import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Card, cn, Swipe, type SwipeHandle } from 'panelui-native';
import { useMemo, useRef } from 'react';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { useAccounts, useApiRequest, useCash } from '@/api/hooks';
import type { Account, CashTransaction } from '@/api/types';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { cashTypeLabel } from '@/lib/cash';
import { errorMessage } from '@/lib/errors';
import { useFormatters } from '@/lib/format';
import { pnlClass } from '@/styles/pnl';

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
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatDate } = useFormatters();
  const swipeable = useRef<SwipeHandle>(null);
  // Withdrawals and fees are stored negative, but older rows can carry a bare
  // positive amount — the type still decides the direction.
  const isOutflow =
    transaction.amount < 0 || transaction.type === 'withdrawal' || transaction.type === 'fee';
  const signed = isOutflow ? -Math.abs(transaction.amount) : transaction.amount;
  const date = formatDate(transaction.occurred_at);

  return (
    // No full swipe: removing a ledger entry moves the equity curve, so it does
    // not fire from a hard drag alone.
    <Swipe ref={swipeable} fullSwipe={false}>
      <Swipe.End>
        <Swipe.Action
          color="destructive"
          icon={<Icon name="trash.fill" size={17} tintColor="#FFFFFF" />}
          label={t`Remove`}
          onPress={() => {
            swipeable.current?.close();
            onRemove();
          }}
        />
      </Swipe.End>
      <Pressable onPress={onEdit} accessibilityRole="button" className="active:opacity-70">
        <Card className="flex-row items-center gap-3 rounded-lg border-0 p-4">
          <View className="flex-1 gap-0.5">
            <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
              {account
                ? `${cashTypeLabel(transaction.type)} · ${account.name}`
                : cashTypeLabel(transaction.type)}
            </Text>
            <Text className="text-xs tabular-nums text-muted-foreground" numberOfLines={1}>
              {transaction.note ? `${date} · ${transaction.note}` : date}
            </Text>
          </View>
          <Text
            className={cn(
              'text-[15px] font-semibold tabular-nums',
              pnlClass(isOutflow ? -1 : 1),
            )}
            numberOfLines={1}
          >
            {formatCurrency(signed, transaction.currency || 'USD')}
          </Text>
        </Card>
      </Pressable>
    </Swipe>
  );
}

/**
 * Deposits & withdrawals (web "Deposits & withdrawals" section): the cash
 * ledger across all accounts, newest first. Built as a list rather than a
 * settings form — the ledger is unbounded and a form section renders every row
 * eagerly. Creation lives behind the bar's + button so the screen stays a
 * list; rows push the edit form, swipe removes.
 *
 * No running total in the header: accounts can hold different base currencies,
 * so a single summed figure would be wrong. Per-account balances live on the
 * account rows (ledgerBalance in lib/cash.ts).
 */
export default function FundingScreen() {
  const router = useRouter();
  // `FlashList` is not a core component Uniwind can take a `className` on, so
  // its content fill has to be a JS value.
  const [background, foreground] = useCSSVariable([
    '--color-background',
    '--color-foreground',
  ]) as [string, string];
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
    onError: (err) => Alert.alert(t`Could not remove transaction`, errorMessage(err)),
  });

  function confirmRemove(transaction: CashTransaction) {
    Alert.alert(t`Remove transaction?`, t`This permanently deletes the ledger entry.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Remove`, style: 'destructive', onPress: () => remove.mutate(transaction.id) },
    ]);
  }

  // Takes precedence over the list's empty state: an unreachable server would
  // otherwise claim the ledger is empty, which reads as lost deposits.
  const loadFailed = cash.isError && cash.data == null;

  const addButton = (
    <Pressable
      onPress={() => router.push('/cash-form')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t`Add transaction`}
      className="h-8 w-8 items-center justify-center active:opacity-70"
    >
      <Icon name="plus" size={18} tintColor={foreground} weight="semibold" />
    </Pressable>
  );

  return (
    <>
      <Stack.Screen options={{ headerRight: () => addButton }} />
      {cash.isLoading ? (
        <View className="flex-1 gap-2 bg-background p-4 pt-[120px]">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-lg" />
          ))}
        </View>
      ) : loadFailed ? (
        <ErrorState
          error={cash.error}
          onRetry={() => void cash.refetch()}
          retrying={cash.isRefetching}
        />
      ) : (
        <FlashList
          data={transactions}
          keyExtractor={(transaction) => transaction.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, paddingBottom: 48, backgroundColor: background }}
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
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListFooterComponent={
            transactions.length > 0 ? (
              // No horizontal inset of its own — the helper text lines up with
              // the card edges above it, not 4pt inside them.
              <Text className="pt-4 text-xs leading-[17px] text-muted-foreground">
                {t`Deposits, withdrawals, and fees drive the equity curve alongside trade P&L. Tap a row to edit it, swipe to remove.`}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View className="min-h-[320px]">
              <EmptyState
                title={t`No transactions yet`}
                systemImage="banknote"
                description={t`Tap + to log a deposit, withdrawal, or fee — they drive the equity curve alongside trade P&L.`}
              />
            </View>
          }
        />
      )}
    </>
  );
}
