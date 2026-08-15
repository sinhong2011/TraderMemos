import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Frame, Text } from 'panelui-native';

import { queryKeys, useAccounts, useApiRequest, useCash, useTrades } from '@/api/hooks';
import type { Account } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { HeaderIconButton } from '@/components/header-icon-button';
import { NavRow } from '@/components/nav-row';
import { t } from '@lingui/core/macro';
import { SettingsForm } from '@/components/settings-form';
import {
  SettingsInput,
  SettingsPicker,
  SettingsRow,
  SettingsSection,
  ValueText,
} from '@/components/settings-rows';
import { numericText, parseAmount } from '@/lib/amount';
import { ledgerBalance } from '@/lib/cash';
import { errorMessage } from '@/lib/errors';
import { formatPercent, useFormatters } from '@/lib/format';
import { DISPLAY_CURRENCIES } from '@/lib/prefs';
import { pnlColor, usePnlPalette } from '@/styles/pnl';

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
      <SettingsForm>
        <SettingsSection>
          <Frame.Row>
            <Text size="sm" muted className="flex-1">
              {t`Loading…`}
            </Text>
          </Frame.Row>
        </SettingsSection>
      </SettingsForm>
    );
  }

  return <AccountForm account={account} accountCount={accounts?.length ?? 0} />;
}

function AccountForm({ account, accountCount }: { account?: Account; accountCount: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  // Live P&L hues from the theme tokens (see styles/pnl.ts).
  const pnl = usePnlPalette();
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatPnl } = useFormatters();

  const isEdit = account != null;
  const knownBroker = account != null && POPULAR_BROKERS.includes(account.broker.trim());

  // The fields are uncontrolled (`SettingsInput` holds its own text); the ref
  // mirrors capture keystrokes for submit-time reads.
  const nameText = useRef(account?.name ?? '');
  // The ref holds the value; this boolean is the only part the header action
  // needs, so it re-renders on empty↔filled rather than on every keystroke.
  const [hasName, setHasName] = useState((account?.name ?? '').trim() !== '');
  const [brokerChoice, setBrokerChoice] = useState<string>(
    account == null ? POPULAR_BROKERS[0] : knownBroker ? account.broker.trim() : OTHER_BROKER,
  );
  const initialCustomBroker = account != null && !knownBroker ? account.broker.trim() : '';
  const customBrokerText = useRef(initialCustomBroker);
  const [accountType, setAccountType] = useState('cash');
  // Picker, not a text field: the balance row echoes the choice, and a free
  // text code would let "usd" / "US$" through `toUpperCase` untouched.
  const [currency, setCurrency] = useState<string>('USD');
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
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  const clearTrades = useMutation({
    mutationFn: () => api(`/accounts/${account!.id}/trades`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trades'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      Alert.alert(t`Trade history cleared`, account?.name ?? '');
    },
    onError: (err) => Alert.alert(t`Could not clear trades`, errorMessage(err)),
  });

  const deleteAccount = useMutation({
    mutationFn: () => api(`/accounts/${account!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['trades'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not delete account`, errorMessage(err)),
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
      base_currency: currency,
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

  return (
    <>
      <Stack.Screen
        options={{
          title: isEdit ? t`Account` : t`New account`,
          // Pushed settings forms put their commit action in the nav bar
          // (the ai/[kind] idiom), not a row in the list.
          headerRight: () => (
            <HeaderIconButton
              systemImage="checkmark"
              disabled={!hasName || save.isPending}
              label={save.isPending ? t`Saving…` : isEdit ? t`Save` : t`Add`}
              onPress={handleSave}
            />
          ),
        }}
      />
      <SettingsForm>
        <SettingsSection title={t`Details`}>
          <SettingsInput
            label={t`Name`}
            placeholder={t`e.g. Main Account`}
            defaultValue={account?.name ?? ''}
            onChangeText={(text) => {
              nameText.current = text;
              setHasName(text.trim() !== '');
            }}
          />
          <SettingsPicker
            label={t`Broker`}
            selectedValue={brokerChoice}
            onValueChange={setBrokerChoice}
            items={[
              ...POPULAR_BROKERS.map((broker) => ({ value: broker, label: broker })),
              { value: OTHER_BROKER, label: t`Other` },
            ]}
          />
          {brokerChoice === OTHER_BROKER ? (
            <SettingsInput
              label={t`Custom broker`}
              placeholder={t`Type broker name`}
              defaultValue={initialCustomBroker}
              onChangeText={(text) => {
                customBrokerText.current = text;
              }}
            />
          ) : null}
        </SettingsSection>

        {!isEdit ? (
          <SettingsSection
            title={t`Funding`}
            footer={t`The starting balance is saved as the first deposit in the cash ledger.`}
          >
            <SettingsPicker
              label={t`Account type`}
              selectedValue={accountType}
              onValueChange={setAccountType}
              items={ACCOUNT_TYPES.map((option) => ({
                value: option.value,
                label: option.label(),
              }))}
            />
            <SettingsPicker
              label={t`Base currency`}
              selectedValue={currency}
              onValueChange={setCurrency}
              items={DISPLAY_CURRENCIES.map((code) => ({ value: code, label: code }))}
            />
            <SettingsInput
              label={t`Starting balance`}
              placeholder="0.00"
              numeric
              suffix={currency}
              onChangeText={(text) => {
                balanceText.current = numericText(text);
              }}
            />
          </SettingsSection>
        ) : null}

        {isEdit ? (
          <SettingsSection title={t`Performance`}>
            <SettingsRow label={t`Deposited`}>
              <ValueText>{formatCurrency(deposited, account.base_currency)}</ValueText>
            </SettingsRow>
            <SettingsRow label={t`Equity`}>
              <ValueText>{formatCurrency(equity, account.base_currency)}</ValueText>
            </SettingsRow>
            <SettingsRow label={t`Realized P&L`}>
              <ValueText color={pnlColor(pnl, netPnl)}>
                {formatPnl(netPnl, account.base_currency)}
              </ValueText>
            </SettingsRow>
            {deposited !== 0 ? (
              <SettingsRow label={t`Return`}>
                <ValueText>{formatPercent(netPnl / deposited)}</ValueText>
              </SettingsRow>
            ) : null}
            <SettingsRow label={t`Trades`}>
              <ValueText>{String(tradeCount)}</ValueText>
            </SettingsRow>
          </SettingsSection>
        ) : null}

        {isEdit ? (
          <SettingsSection title={t`Integrations`}>
            {account.account_type === 'prop' ? (
              <NavRow
                systemImage="flag.checkered"
                label={t`Prop rules`}
                onPress={() =>
                  router.push({ pathname: '/prop-settings', params: { accountId: account.id } })
                }
              />
            ) : null}
            <NavRow
              systemImage="arrow.triangle.2.circlepath"
              label={t`IBKR Flex sync`}
              onPress={() =>
                router.push({ pathname: '/flex-sync', params: { accountId: account.id } })
              }
            />
          </SettingsSection>
        ) : null}

        {/* Outside a section card: these are actions on the account, not more
            of its fields, and a filled button inside the panel would fight its
            corners. */}
        {isEdit ? (
          <View className="gap-2">
            <CenteredButton
              role="destructive"
              label={clearTrades.isPending ? t`Clearing…` : t`Clear trade history`}
              disabled={clearTrades.isPending}
              onPress={confirmClearTrades}
            />
            {!isOnlyAccount ? (
              <CenteredButton
                role="destructive"
                label={deleteAccount.isPending ? t`Deleting…` : t`Delete account`}
                disabled={deleteAccount.isPending}
                onPress={confirmDeleteAccount}
              />
            ) : (
              <Text size="xs" muted className="px-4">
                {t`Add another account before deleting this one.`}
              </Text>
            )}
          </View>
        ) : null}
      </SettingsForm>
    </>
  );
}
