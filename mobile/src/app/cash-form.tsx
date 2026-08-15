import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { useAccounts, useApiRequest, useCash } from '@/api/hooks';
import type { Account, CashTransaction } from '@/api/types';
import { ControlPill } from '@/components/control-pill';
import {
  FormControl,
  FormField,
  FormFootnote,
  FormInput,
  FormRow,
  FormSheet,
} from '@/components/form-sheet';
import { Segmented } from '@/components/segmented';
import { FormSkeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { parseAmount } from '@/lib/amount';
import { CASH_TYPES, signedCashAmount } from '@/lib/cash';
import { errorMessage } from '@/lib/errors';
import { DateField } from '@/components/date-field';

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
 * Built on `FormSheet` in the creation-sheet idiom the token and tag sheets
 * use: glass chrome, one commit in the header, quiet captions over full-width
 * controls. It wore the inset-grouped rows (label left, value right) until
 * 2026-08-06 — that vocabulary stays with the multi-section forms (trade,
 * setup), while the short sheets all read the same way.
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
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => api(`/cash-transactions/${transaction!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateCash();
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not remove transaction`, errorMessage(err)),
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
      // Commit is the glass checkmark, like every other creation sheet — the
      // sheet title already says which verb this is.
      saveDisabled={!canSave}
      onSave={handleSave}
    >
      <FormFootnote>
        {t`Deposits, withdrawals, and fees drive the equity curve alongside trade P&L.`}
      </FormFootnote>
      {/* Edit pins the account (the PUT can't move an entry), and with a
          single account there is nothing to choose — show it as a value. */}
      {!isEdit && accounts.length > 1 ? (
        <FormField quiet label={t`Account`}>
          <FormControl>
            {/* Hugging, not `fill`: the trigger sits on the shell's leading
                edge, so a stretched one would push its value off to the far
                side of the box. */}
            <Segmented
              flush
              variant="menu"
              value={accountId}
              onChange={setAccountId}
              options={accounts.map((candidate) => ({
                value: candidate.id,
                label: candidate.name,
              }))}
            />
          </FormControl>
        </FormField>
      ) : account ? (
        <FormField quiet label={t`Account`}>
          <FormControl>
            <Text className="text-base text-muted-foreground">{account.name}</Text>
          </FormControl>
        </FormField>
      ) : null}
      {/* Six types — a pull-down menu, not a segmented control. The menu
          carries its own value, so it rides a row instead of a caption. */}
      <FormRow label={t`Type`}>
        {/* Filled pill so the value reads as a control, matching the date
            picker's own pill in the row below. No `flush` here — the menu's
            built-in label padding is what fills the pill. */}
        <ControlPill>
          <Segmented variant="menu" value={type} onChange={setType} options={typeOptions} />
        </ControlPill>
      </FormRow>
      {/* Amount is the only thing a new entry can't default — open on it,
          keyboard up. Editing starts read-first, so no grab there. */}
      <FormField quiet label={t`Amount`}>
        <FormInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          numeric
          autoFocus={!isEdit}
        />
      </FormField>
      <FormRow label={t`Date`}>
        <DateField selection={date} displayedComponents={['date']} onDateChange={setDate} />
      </FormRow>
      {/* A note is prose — "wire from broker, settles Monday" — so it gets a
          writing box, not a one-line field. */}
      <FormField quiet label={t`Note`}>
        <FormInput
          multiline
          value={note}
          onChangeText={setNote}
          placeholder={t`Optional note`}
        />
      </FormField>
      {/* A disabled commit needs a reason: with no accounts there is nothing
          to book the entry against. */}
      {!isEdit && account == null ? <FormFootnote>{t`Add an account first.`}</FormFootnote> : null}

      {/* Remove sits in the body, away from the header's commit — destructive
          actions shouldn't be a thumb-slip from Save. */}
      {isEdit ? (
        <View className="items-center pt-6">
          <Pressable
            onPress={confirmDelete}
            disabled={remove.isPending}
            accessibilityRole="button"
            className="px-4 py-2 active:opacity-60"
          >
            <Text className="text-[15px] font-medium text-destructive">
              {remove.isPending ? t`Removing…` : t`Remove transaction`}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </FormSheet>
  );
}
