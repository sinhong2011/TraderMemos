import {
  DatePicker,
  Host,
  LabeledContent,
  Picker,
  Section,
  Text as UIText,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  keyboardType,
  scrollDismissesKeyboard,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useAccounts, useApiRequest, useCash } from '@/api/hooks';
import type { Account, CashTransaction } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { t } from '@lingui/core/macro';
import { SettingsForm } from '@/components/settings-form';
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
 * Edit mode (`?id=`) pins the account — the API's PUT does not move entries
 * between accounts — and adds a delete action.
 *
 * The outer screen defers mounting the form until the edited entry is in
 * cache, so field state can initialize directly from it (no prefill effects).
 */
export default function CashFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: accounts } = useAccounts();
  const cash = useCash();
  const transaction = cash.data?.find((candidate) => candidate.id === id);

  if ((id != null && !transaction) || !accounts) {
    return (
      <Host style={{ flex: 1 }}>
        <SettingsForm>
          <Section>
            <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {t`Loading…`}
            </UIText>
          </Section>
        </SettingsForm>
      </Host>
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
  const [date, setDate] = useState(
    () => (transaction ? new Date(transaction.occurred_at) : new Date()),
  );
  const initialAmount = transaction ? String(Math.abs(transaction.amount)) : '';
  const amountState = useNativeState(initialAmount);
  const amountText = useRef(initialAmount);
  const noteState = useNativeState(transaction?.note ?? '');
  const noteText = useRef(transaction?.note ?? '');

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

  function handleSave() {
    const amount = parseAmount(amountText.current);
    if (amount == null || amount <= 0) {
      Alert.alert(t`Could not save`, t`Enter a valid amount.`);
      return;
    }
    const account = accounts.find((candidate) => candidate.id === accountId);
    if (!isEdit && !account) {
      Alert.alert(t`Could not save`, t`Add an account first.`);
      return;
    }
    const body = {
      type,
      amount: signedCashAmount(type, amount),
      currency: (isEdit ? transaction.currency : account?.base_currency) || 'USD',
      occurred_at: toOccurredAt(date),
      note: noteText.current.trim() || undefined,
    };
    save.mutate(isEdit ? body : { ...body, account_id: accountId });
  }

  function confirmDelete() {
    Alert.alert(t`Remove transaction?`, t`This permanently deletes the ledger entry.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Remove`, style: 'destructive', onPress: () => remove.mutate() },
    ]);
  }

  return (
    <Host style={{ flex: 1 }}>
      <SettingsForm modifiers={[scrollDismissesKeyboard('immediately')]}>
        <Section title={t`Transaction`}>
          {!isEdit ? (
            <Picker label={t`Account`} selection={accountId} onSelectionChange={setAccountId}>
              {accounts.map((account) => (
                <UIText key={account.id} modifiers={[tag(account.id)]}>
                  {account.name}
                </UIText>
              ))}
            </Picker>
          ) : null}
          <Picker label={t`Type`} selection={type} onSelectionChange={setType}>
            {CASH_TYPES.map((option) => (
              <UIText key={option.value} modifiers={[tag(option.value)]}>
                {option.label()}
              </UIText>
            ))}
          </Picker>
          <LabeledContent label={t`Amount`}>
            <TextField
              placeholder="0.00"
              text={amountState}
              onTextChange={(text) => {
                amountText.current = text;
              }}
              modifiers={[keyboardType('decimal-pad')]}
            />
          </LabeledContent>
          <DatePicker
            title={t`Date`}
            selection={date}
            displayedComponents={['date']}
            onDateChange={setDate}
          />
          <LabeledContent label={t`Note`}>
            <TextField
              placeholder={t`Optional note`}
              text={noteState}
              onTextChange={(text) => {
                noteText.current = text;
              }}
            />
          </LabeledContent>
        </Section>

        <Section>
          <CenteredButton
            label={save.isPending ? t`Saving…` : isEdit ? t`Save changes` : t`Add transaction`}
            onPress={handleSave}
          />
        </Section>

        {isEdit ? (
          <Section>
            <CenteredButton
              role="destructive"
              label={remove.isPending ? t`Removing…` : t`Remove transaction`}
              onPress={confirmDelete}
            />
          </Section>
        ) : null}
      </SettingsForm>
    </Host>
  );
}
