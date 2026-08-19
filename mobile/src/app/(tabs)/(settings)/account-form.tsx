import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Frame, Text } from 'panelui-native';

import {
  flexSyncFailed,
  queryKeys,
  useAccounts,
  useApiRequest,
  useCash,
  useFlexSync,
  useTrades,
} from '@/api/hooks';
import type { Account } from '@/api/types';
import { FormField, FormInput, FormPicker, FormScreen } from '@/components/form-kit';
import { HeaderIconButton } from '@/components/header-icon-button';
import { NavRow } from '@/components/nav-row';
import { t } from '@lingui/core/macro';
import { SettingsForm } from '@/components/settings-form';
import { Pill } from '@/components/pill';
import { SettingsButton, SettingsRow, SettingsSection, ValueText } from '@/components/settings-rows';
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
  // Sync state drives the Integrations row's value and whether it shows at
  // all — an account that isn't IBKR and has no connection gets no dead row.
  const flexSync = useFlexSync(account?.id ?? '', account != null);
  // Live P&L hues from the theme tokens (see styles/pnl.ts).
  const pnl = usePnlPalette();
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatPnl, formatDate, formatTime } = useFormatters();

  const isEdit = account != null;
  const knownBroker = account != null && POPULAR_BROKERS.includes(account.broker.trim());

  // The fields are uncontrolled (`FormInput` holds its own text); the ref
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
      <FormScreen>
        <FormField label={t`Name`}>
          <FormInput
            placeholder={t`e.g. Main Account`}
            defaultValue={account?.name ?? ''}
            onChangeText={(text) => {
              nameText.current = text;
              setHasName(text.trim() !== '');
            }}
          />
        </FormField>
        <FormField label={t`Broker`}>
          <FormPicker
            label={t`Broker`}
            selectedValue={brokerChoice}
            onValueChange={setBrokerChoice}
            items={[
              ...POPULAR_BROKERS.map((broker) => ({ value: broker, label: broker })),
              { value: OTHER_BROKER, label: t`Other` },
            ]}
          />
        </FormField>
        {brokerChoice === OTHER_BROKER ? (
          <FormField label={t`Custom broker`}>
            <FormInput
              placeholder={t`Type broker name`}
              defaultValue={initialCustomBroker}
              onChangeText={(text) => {
                customBrokerText.current = text;
              }}
            />
          </FormField>
        ) : null}

        {!isEdit ? (
          <>
            <FormField label={t`Account type`}>
              <FormPicker
                label={t`Account type`}
                selectedValue={accountType}
                onValueChange={setAccountType}
                items={ACCOUNT_TYPES.map((option) => ({
                  value: option.value,
                  label: option.label(),
                }))}
              />
            </FormField>
            <FormField label={t`Base currency`}>
              <FormPicker
                label={t`Base currency`}
                selectedValue={currency}
                onValueChange={setCurrency}
                items={DISPLAY_CURRENCIES.map((code) => ({ value: code, label: code }))}
              />
            </FormField>
            <FormField label={t`Starting balance`}>
              <FormInput
                placeholder="0.00"
                keyboardType="decimal-pad"
                suffix={currency}
                description={t`The starting balance is saved as the first deposit in the cash ledger.`}
                onChangeText={(text) => {
                  balanceText.current = numericText(text);
                }}
              />
            </FormField>
          </>
        ) : null}


        {/* Web AccountDetailView's Broker connection card, in section form:
            health + last sync at a glance here, the flex-sync screen for
            credentials and manual runs. */}
        {isEdit ? (
          <SettingsSection
            title={t`Broker connection`}
            footer={
              flexSync.data?.configured
                ? (flexSync.data.last_error ?? undefined)
                : t`Pulls new fills into this account automatically. Statements can also be imported by file.`
            }
          >
            {flexSync.data?.configured ? (
              <>
                <SettingsRow label={t`Health`}>
                  <Pill
                    tone={
                      flexSyncFailed(flexSync.data) ? 'neg' : flexSync.data.enabled ? 'pos' : 'muted'
                    }
                  >
                    {flexSyncFailed(flexSync.data)
                      ? t`Sync failing`
                      : flexSync.data.enabled
                        ? t`Healthy`
                        : t`Manual only`}
                  </Pill>
                </SettingsRow>
                <SettingsRow label={t`Last synced`}>
                  <ValueText>
                    {flexSync.data.last_synced_at
                      ? `${formatDate(flexSync.data.last_synced_at)} ${formatTime(flexSync.data.last_synced_at)}`
                      : t`Never`}
                  </ValueText>
                </SettingsRow>
                <NavRow
                  systemImage="arrow.triangle.2.circlepath"
                  label={t`IBKR Flex sync`}
                  onPress={() =>
                    router.push({ pathname: '/flex-sync', params: { accountId: account.id } })
                  }
                />
              </>
            ) : /ibkr|interactive brokers/i.test(account.broker) ? (
              <SettingsButton
                systemImage="arrow.triangle.2.circlepath"
                label={t`Connect IBKR Flex sync`}
                onPress={() =>
                  router.push({ pathname: '/flex-sync', params: { accountId: account.id } })
                }
              />
            ) : (
              // A non-IBKR account gets the broker catalogue, not a hard-coded
              // IBKR pitch — auto-sync only exists for IBKR, but file import
              // covers the rest.
              <SettingsButton
                systemImage="building.columns"
                label={t`Connect a broker`}
                onPress={() => router.push('/connect-broker')}
              />
            )}
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

        {isEdit && account.account_type === 'prop' ? (
          <SettingsSection title={t`Integrations`}>
            <NavRow
              systemImage="flag.checkered"
              label={t`Prop rules`}
              onPress={() =>
                router.push({ pathname: '/prop-settings', params: { accountId: account.id } })
              }
            />
          </SettingsSection>
        ) : null}

        {/* Destructive actions live in a grouped card of red action rows —
            the SettingsButton idiom (two-factor, data-backup), not floating
            ghost text. */}
        {isEdit ? (
          <SettingsSection
            footer={isOnlyAccount ? t`Add another account before deleting this one.` : undefined}
          >
            <SettingsButton
              systemImage="clock.arrow.circlepath"
              role="destructive"
              label={clearTrades.isPending ? t`Clearing…` : t`Clear trade history`}
              disabled={clearTrades.isPending}
              onPress={confirmClearTrades}
            />
            {!isOnlyAccount ? (
              <SettingsButton
                systemImage="trash"
                role="destructive"
                label={deleteAccount.isPending ? t`Deleting…` : t`Delete account`}
                disabled={deleteAccount.isPending}
                onPress={confirmDeleteAccount}
              />
            ) : null}
          </SettingsSection>
        ) : null}
      </FormScreen>
    </>
  );
}
