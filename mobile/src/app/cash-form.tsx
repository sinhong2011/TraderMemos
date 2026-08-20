import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { useAccounts, useApiRequest, useCash } from '@/api/hooks';
import type { Account, CashTransaction } from '@/api/types';
import {
  FormControl,
  FormField,
  FormFootnote,
  FormInput,
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
 * Built on `FormSheet` as a pushed card (the new-trade shape): glass chrome,
 * one commit in the header, quiet captions over full-width controls — one
 * anatomy for every field, pickers included. Pushed, not a native formSheet:
 * the account/type/date pickers are PanelUI bottom sheets, which portal to
 * the root host and draw *under* a natively presented sheet.
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
      <FormSheet pushed title={t`Transaction`} onSave={() => {}}>
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

  const typeOptions = CASH_TYPES.map((option) => ({
    value: option.value as string,
    label: option.label(),
  }));

  return (
    <FormSheet
      pushed
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
            <Segmented
              flush
              fill
              variant="menu"
              title={t`Account`}
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
      {/* Six types — a picker sheet, not a segmented control. Same anatomy as
          Account above: quiet caption over a field-shaped trigger, so the
          column reads as one vocabulary. */}
      <FormField quiet label={t`Type`}>
        <FormControl>
          <Segmented
            flush
            fill
            variant="menu"
            title={t`Type`}
            value={type}
            onChange={setType}
            options={typeOptions}
          />
        </FormControl>
      </FormField>
      <FormField quiet label={t`Amount`}>
        <FormInput value={amount} onChangeText={setAmount} placeholder="0.00" numeric />
      </FormField>
      <FormField quiet label={t`Date`}>
        {/* The pill is DateField's own trigger; a row keeps it hugging the
            leading edge instead of stretching into a second field box. */}
        <View className="flex-row">
          <DateField selection={date} displayedComponents={['date']} onDateChange={setDate} />
        </View>
      </FormField>
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
    </FormSheet>
  );
}
