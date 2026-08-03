import {
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
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { queryKeys, useAccounts, useApiRequest, useCash, useTrades } from '@/api/hooks';
import type { Account } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { t } from '@lingui/core/macro';
import { SettingsForm } from '@/components/settings-form';
import { parseAmount } from '@/lib/amount';
import { ledgerBalance } from '@/lib/cash';
import { formatCurrency, formatPercent, formatPnl } from '@/lib/format';

/** Mirrors the web settings broker dropdown; anything else is a custom entry. */
const POPULAR_BROKERS = [
  'IBKR',
  'Webull',
  'Robinhood',
  'Fidelity',
  'Charles Schwab',
  'E*TRADE',
  'tastytrade',
  'Moomoo',
  'FUTU NIU NIU',
];
const OTHER_BROKER = '__other__';

const ACCOUNT_TYPES = [
  { value: 'cash', label: () => t`Cash` },
  { value: 'margin', label: () => t`Margin` },
  { value: 'prop', label: () => t`Prop` },
];

/**
 * Create/edit a broker account (web AccountsTab parity). Create collects the
 * full shape; edit lets name/broker change and carries the destructive actions
 * (clear trade history, delete account) plus a read-only performance summary.
 *
 * The outer screen defers mounting the form until the edited account is in
 * cache, so field state can initialize directly from it (no prefill effects).
 */
export default function AccountFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: accounts } = useAccounts();
  const account = accounts?.find((candidate) => candidate.id === id);

  if (id != null && !account) {
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

  return <AccountForm account={account} accountCount={accounts?.length ?? 0} />;
}

function AccountForm({ account, accountCount }: { account?: Account; accountCount: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const { theme } = useUnistyles();

  const isEdit = account != null;
  const knownBroker = account != null && POPULAR_BROKERS.includes(account.broker.trim());

  // Same SwiftUI-binding pattern as the settings hub: observable state drives
  // the native field, a ref mirror captures keystrokes for submit-time reads.
  const nameState = useNativeState(account?.name ?? '');
  const nameText = useRef(account?.name ?? '');
  const [brokerChoice, setBrokerChoice] = useState<string>(
    account == null ? POPULAR_BROKERS[0] : knownBroker ? account.broker.trim() : OTHER_BROKER,
  );
  const initialCustomBroker = account != null && !knownBroker ? account.broker.trim() : '';
  const customBrokerState = useNativeState(initialCustomBroker);
  const customBrokerText = useRef(initialCustomBroker);
  const [accountType, setAccountType] = useState('cash');
  const currencyState = useNativeState('USD');
  const currencyText = useRef('USD');
  const balanceState = useNativeState('');
  const balanceText = useRef('');

  // Stats for the edit summary (both lists are cached app-wide already).
  const trades = useTrades(isEdit ? { account_id: account.id } : {});
  const cash = useCash();
  const accountTrades = isEdit ? (trades.data ?? []) : [];
  const tradeCount = accountTrades.length;
  const netPnl = accountTrades.reduce((sum, trade) => sum + (trade.net_pnl ?? 0), 0);
  const deposited = isEdit ? ledgerBalance(account.id, cash.data ?? []) : 0;
  const equity = deposited + netPnl;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.accounts() });
    // Account creation seeds the opening deposit; deletion cascades the ledger.
    void queryClient.invalidateQueries({ queryKey: ['cash'] });
  };

  const save = useMutation({
    mutationFn: (body: {
      name: string;
      broker: string;
      account_type?: string;
      base_currency?: string;
      starting_balance?: number;
    }) =>
      isEdit
        ? api(`/accounts/${account.id}`, { method: 'PUT', body })
        : api('/accounts', { method: 'POST', body }),
    onSuccess: () => {
      invalidate();
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  const clearTrades = useMutation({
    mutationFn: () => api(`/accounts/${account!.id}/trades`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trades'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      Alert.alert(t`Trade history cleared`, account?.name ?? '');
    },
    onError: (err) => Alert.alert(t`Could not clear trades`, err.message),
  });

  const deleteAccount = useMutation({
    mutationFn: () => api(`/accounts/${account!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['trades'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not delete account`, err.message),
  });

  function handleSave() {
    const name = nameText.current.trim();
    const broker =
      brokerChoice === OTHER_BROKER ? customBrokerText.current.trim() : brokerChoice.trim();
    if (!name) {
      Alert.alert(t`Could not save`, t`Account name is required.`);
      return;
    }
    if (!broker) {
      Alert.alert(t`Could not save`, t`Broker is required.`);
      return;
    }
    if (isEdit) {
      save.mutate({ name, broker });
      return;
    }
    const balance = parseAmount(balanceText.current);
    if (balance === undefined) {
      Alert.alert(t`Could not save`, t`Enter a valid starting balance.`);
      return;
    }
    save.mutate({
      name,
      broker,
      account_type: accountType,
      base_currency: currencyText.current.trim().toUpperCase() || 'USD',
      starting_balance: balance ?? 0,
    });
  }

  function confirmClearTrades() {
    Alert.alert(
      t`Clear trade history?`,
      t`Permanently deletes ${tradeCount} trades and their executions from ${account?.name ?? ''}.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        { text: t`Clear trades`, style: 'destructive', onPress: () => clearTrades.mutate() },
      ],
    );
  }

  function confirmDeleteAccount() {
    Alert.alert(
      t`Delete account?`,
      t`Permanently deletes ${account?.name ?? ''} with its trades and cash records.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        { text: t`Delete`, style: 'destructive', onPress: () => deleteAccount.mutate() },
      ],
    );
  }

  const isOnlyAccount = accountCount <= 1;
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

  return (
    <Host style={{ flex: 1 }}>
      <SettingsForm modifiers={[scrollDismissesKeyboard('immediately')]}>
        <Section title={t`Account`}>
          <LabeledContent label={t`Name`}>
            <TextField
              placeholder={t`e.g. Main Account`}
              text={nameState}
              onTextChange={(text) => {
                nameText.current = text;
              }}
            />
          </LabeledContent>
          <Picker label={t`Broker`} selection={brokerChoice} onSelectionChange={setBrokerChoice}>
            {POPULAR_BROKERS.map((broker) => (
              <UIText key={broker} modifiers={[tag(broker)]}>
                {broker}
              </UIText>
            ))}
            <UIText modifiers={[tag(OTHER_BROKER)]}>{t`Other`}</UIText>
          </Picker>
          {brokerChoice === OTHER_BROKER ? (
            <LabeledContent label={t`Custom broker`}>
              <TextField
                placeholder={t`Type broker name`}
                text={customBrokerState}
                onTextChange={(text) => {
                  customBrokerText.current = text;
                }}
              />
            </LabeledContent>
          ) : null}
        </Section>

        {!isEdit ? (
          <Section
            title={t`Funding`}
            footer={
              <UIText>
                {t`The starting balance is saved as the first deposit in the cash ledger.`}
              </UIText>
            }
          >
            <Picker
              label={t`Account type`}
              selection={accountType}
              onSelectionChange={setAccountType}
            >
              {ACCOUNT_TYPES.map((option) => (
                <UIText key={option.value} modifiers={[tag(option.value)]}>
                  {option.label()}
                </UIText>
              ))}
            </Picker>
            <LabeledContent label={t`Base currency`}>
              <TextField
                placeholder="USD"
                text={currencyState}
                onTextChange={(text) => {
                  currencyText.current = text;
                }}
                modifiers={[textInputAutocapitalization('characters')]}
              />
            </LabeledContent>
            <LabeledContent label={t`Starting balance`}>
              <TextField
                placeholder="0.00"
                text={balanceState}
                onTextChange={(text) => {
                  balanceText.current = text;
                }}
                modifiers={[keyboardType('decimal-pad')]}
              />
            </LabeledContent>
          </Section>
        ) : null}

        {isEdit ? (
          <Section title={t`Performance`}>
            <LabeledContent label={t`Deposited`}>
              <UIText modifiers={[secondary]}>
                {formatCurrency(deposited, account.base_currency)}
              </UIText>
            </LabeledContent>
            <LabeledContent label={t`Equity`}>
              <UIText modifiers={[secondary]}>
                {formatCurrency(equity, account.base_currency)}
              </UIText>
            </LabeledContent>
            <LabeledContent label={t`Realized P&L`}>
              <UIText
                modifiers={[
                  foregroundStyle(
                    netPnl > 0
                      ? theme.colors.profit
                      : netPnl < 0
                        ? theme.colors.loss
                        : theme.colors.mutedForeground,
                  ),
                ]}
              >
                {formatPnl(netPnl, account.base_currency)}
              </UIText>
            </LabeledContent>
            {deposited !== 0 ? (
              <LabeledContent label={t`Return`}>
                <UIText modifiers={[secondary]}>{formatPercent(netPnl / deposited)}</UIText>
              </LabeledContent>
            ) : null}
            <LabeledContent label={t`Trades`}>
              <UIText modifiers={[secondary]}>{String(tradeCount)}</UIText>
            </LabeledContent>
          </Section>
        ) : null}

        <Section>
          <CenteredButton
            label={save.isPending ? t`Saving…` : isEdit ? t`Save changes` : t`Create account`}
            onPress={handleSave}
          />
        </Section>

        {isEdit ? (
          <Section
            footer={
              isOnlyAccount ? (
                <UIText>{t`Add another account before deleting this one.`}</UIText>
              ) : undefined
            }
          >
            <CenteredButton
              role="destructive"
              label={clearTrades.isPending ? t`Clearing…` : t`Clear trade history`}
              onPress={confirmClearTrades}
            />
            {!isOnlyAccount ? (
              <CenteredButton
                role="destructive"
                label={deleteAccount.isPending ? t`Deleting…` : t`Delete account`}
                onPress={confirmDeleteAccount}
              />
            ) : null}
          </Section>
        ) : null}
      </SettingsForm>
    </Host>
  );
}
