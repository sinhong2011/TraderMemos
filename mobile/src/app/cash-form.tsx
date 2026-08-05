import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useAccounts, useApiRequest, useCash } from '@/api/hooks';
import type { Account, CashTransaction } from '@/api/types';
import {
  Card,
  ControlRow,
  DateRow,
  InputRow,
  SectionFooter,
  SectionHeader,
} from '@/components/form-rows';
import { FormSheet } from '@/components/form-sheet';
import { Segmented } from '@/components/segmented';
import { FormSkeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { parseAmount } from '@/lib/amount';
import { CASH_TYPES, signedCashAmount } from '@/lib/cash';

/** Noon-UTC anchor keeps the calendar day stable across timezones. */
function toOccurredAt(date: Date): string {
  const ymd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  return `${ymd}T12:00:00.000Z`;
}

/**
 * Create/edit one cash-ledger entry (web "Add/Edit transaction" modals).
 *
 * Built on `FormSheet` + the shared inset-grouped rows, like every other
 * creation sheet (new-token, the tool sheets): glass chrome, one commit in the
 * header, grouped card below. It used to be a SwiftUI `Form` with the native
 * nav bar — correct for a settings *screen*, but this is a creation sheet, and
 * it was the only one wearing the other idiom.
 *
 * Edit mode (`?id=`) pins the account — the API's PUT does not move entries
 * between accounts — and adds the destructive action.
 */
export default function CashFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: accounts } = useAccounts();
  const cash = useCash();
  const transaction = cash.data?.find((candidate) => candidate.id === id);

  // The form initializes its fields from the entry, so it can't mount until
  // the entry is in cache (no prefill effects).
  if ((id != null && !transaction) || !accounts) {
    return (
      <FormSheet inSheet title={t`Transaction`} onSave={() => {}}>
        <FormSkeleton fields={5} />
      </FormSheet>
    );
  }

  return <CashForm accounts={accounts} transaction={transaction} />;
}

function CashForm({
  accounts,
  transaction,
}: {
  accounts: Account[];
  transaction?: CashTransaction;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const isEdit = transaction != null;

  const [accountId, setAccountId] = useState<string>(
    transaction?.account_id ?? accounts[0]?.id ?? '',
  );
  const [type, setType] = useState<string>(transaction?.type ?? 'deposit');
  const [date, setDate] = useState(() =>
    transaction ? new Date(transaction.occurred_at) : new Date(),
  );
  const [amount, setAmount] = useState(transaction ? String(Math.abs(transaction.amount)) : '');
  const [note, setNote] = useState(transaction?.note ?? '');

  const invalidateCash = () => {
    void queryClient.invalidateQueries({ queryKey: ['cash'] });
    // Funding feeds the dashboard equity/goal cards too.
    void queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };

  const save = useMutation({
    mutationFn: (body: {
      type: string;
      amount: number;
      currency: string;
      occurred_at: string;
      note?: string;
      account_id?: string;
    }) =>
      isEdit
        ? api(`/cash-transactions/${transaction.id}`, { method: 'PUT', body })
        : api('/cash-transactions', { method: 'POST', body }),
    onSuccess: () => {
      invalidateCash();
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  const remove = useMutation({
    mutationFn: () => api(`/cash-transactions/${transaction!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateCash();
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not remove transaction`, err.message),
  });

  const account = accounts.find((candidate) => candidate.id === accountId);
  const parsedAmount = parseAmount(amount);
  // Nothing to save without a positive figure, or without an account to book it
  // against — grey the commit rather than letting the tap raise an alert.
  const canSave = parsedAmount != null && parsedAmount > 0 && (isEdit || account != null);

  function handleSave() {
    if (!canSave || parsedAmount == null) return;
    const body = {
      type,
      amount: signedCashAmount(type, parsedAmount),
      currency: (isEdit ? transaction.currency : account?.base_currency) || 'USD',
      occurred_at: toOccurredAt(date),
      note: note.trim() || undefined,
    };
    save.mutate(isEdit ? body : { ...body, account_id: accountId });
  }

  function confirmDelete() {
    Alert.alert(t`Remove transaction?`, t`This permanently deletes the ledger entry.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Remove`, style: 'destructive', onPress: () => remove.mutate() },
    ]);
  }

  const typeOptions = CASH_TYPES.map((option) => ({
    value: option.value as string,
    label: option.label(),
  }));

  return (
    <FormSheet
      inSheet
      title={isEdit ? t`Edit transaction` : t`Add transaction`}
      saving={save.isPending}
      saveLabel={isEdit ? t`Save` : t`Add`}
      saveDisabled={!canSave}
      onSave={handleSave}
    >
      <SectionHeader label={t`Transaction`} />
      <Card>
        {/* Edit pins the account (the PUT can't move an entry), and with a
            single account there is nothing to choose — show it as a value. */}
        {!isEdit && accounts.length > 1 ? (
          <ControlRow label={t`Account`}>
            <Segmented
              variant="menu"
              value={accountId}
              onChange={setAccountId}
              options={accounts.map((candidate) => ({
                value: candidate.id,
                label: candidate.name,
              }))}
            />
          </ControlRow>
        ) : account ? (
          <ControlRow label={t`Account`}>
            <Text style={styles.rowValue}>{account.name}</Text>
          </ControlRow>
        ) : null}
        {/* Six types — a pull-down menu, not a segmented control. */}
        <ControlRow label={t`Type`}>
          <Segmented variant="menu" value={type} onChange={setType} options={typeOptions} />
        </ControlRow>
        <InputRow
          label={t`Amount`}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          numeric
        />
        <DateRow
          label={t`Date`}
          selection={date}
          displayedComponents={['date']}
          onDateChange={setDate}
        />
        <InputRow
          label={t`Note`}
          value={note}
          onChangeText={setNote}
          placeholder={t`Optional note`}
        />
      </Card>
      {/* A disabled Add needs a reason: with no accounts there is nothing to
          book the entry against. */}
      {!isEdit && account == null ? <SectionFooter label={t`Add an account first.`} /> : null}

      {/* Remove sits in the body, away from the header's commit — destructive
          actions shouldn't be a thumb-slip from Save. */}
      {isEdit ? (
        <View style={styles.dangerZone}>
          <Pressable
            onPress={confirmDelete}
            disabled={remove.isPending}
            accessibilityRole="button"
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          >
            <Text style={styles.deleteLabel}>
              {remove.isPending ? t`Removing…` : t`Remove transaction`}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </FormSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  rowValue: { fontSize: 15, color: theme.colors.mutedForeground },
  dangerZone: { paddingTop: theme.spacing.xl, alignItems: 'center' },
  deleteButton: { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.lg },
  pressed: { opacity: 0.6 },
  deleteLabel: { fontSize: 15, fontWeight: '500', color: theme.colors.destructive },
}));
