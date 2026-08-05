import {
  Button,
  Host,
  HStack,
  Image,
  Section,
  Spacer,
  Text as UIText,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import {
  useAccounts,
  useAnnualGoal,
  useApiRequest,
  useCash,
  useTrades,
  queryKeys,
} from '@/api/hooks';
import { CenteredButton } from '@/components/centered-button';
import { SettingsForm } from '@/components/settings-form';
import { useSession } from '@/api/session';
import { t } from '@lingui/core/macro';
import { parseAmount } from '@/lib/amount';
import {
  buildAppConfigExport,
  CONFIRM_DESTRUCTIVE_KEY,
  parseAppConfig,
} from '@/lib/app-config';
import { ledgerBalance } from '@/lib/cash';
import { shareFile } from '@/lib/file-transfer';
import { formatCurrency, formatPnl } from '@/lib/format';
import { useDisplayPrefs } from '@/lib/prefs';
import { clearPersistedQueryCache, storage } from '@/storage/mmkv';

/**
 * Native SwiftUI settings hub, covering the web settings tabs on the phone.
 * Sections read top-down as "my money → how I trade → how I journal → what
 * it talks to → what I take out → how the app behaves": Accounts (incl.
 * funding), Trading (goal + risk rules), Journal, Integrations, Preferences,
 * Data & backup, then About and Sign out. One section per topic — no
 * single-row orphans, and every import/export lives together. Sub-screens are
 * pushed; the annual goal edits in place via a native prompt.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const { theme } = useUnistyles();
  const { session, signOut } = useSession();
  const { data: accounts } = useAccounts();
  // Account rows show live equity, so they need the whole ledger and every
  // account's trades — unscoped on purpose (the global account filter would
  // blank out the rows you aren't currently scoped to).
  const cash = useCash();
  const trades = useTrades();
  // Money formatters read privacy mode at call time; subscribe so a flip
  // re-renders the rows.
  useDisplayPrefs();

  const pnlByAccount = useMemo(() => {
    const totals = new Map<string, number>();
    for (const trade of trades.data ?? []) {
      totals.set(trade.account_id, (totals.get(trade.account_id) ?? 0) + (trade.net_pnl ?? 0));
    }
    return totals;
  }, [trades.data]);

  const tradeCountByAccount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const trade of trades.data ?? []) {
      counts.set(trade.account_id, (counts.get(trade.account_id) ?? 0) + 1);
    }
    return counts;
  }, [trades.data]);

  const year = new Date().getFullYear();
  const goal = useAnnualGoal(year);

  const [confirmDestructive, setConfirmDestructive] = useState(
    () => storage.getBoolean(CONFIRM_DESTRUCTIVE_KEY) ?? true,
  );
  const saveGoal = useMutation({
    mutationFn: (amount: number | null) =>
      amount == null
        ? api('/settings/annual-goal', { method: 'DELETE', params: { year } })
        : api('/settings/annual-goal', { method: 'PUT', body: { year, amount } }),
    onSuccess: (_, amount) => {
      // Update the cache directly so the row refreshes even if the follow-up
      // refetch is slow or dropped; the invalidate then confirms server truth.
      queryClient.setQueryData(queryKeys.annualGoal(year), { year, amount });
      void queryClient.invalidateQueries({ queryKey: queryKeys.annualGoal(year) });
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  // iOS idiom: the row shows the value, editing happens in a native prompt.
  function editGoal() {
    Alert.prompt(
      t`${year} P&L goal`,
      t`Leave blank to clear the goal.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Save`,
          onPress: (text?: string) => {
            const amount = parseAmount(text ?? '');
            if (amount === undefined) {
              Alert.alert(t`Could not save`, t`Enter a valid amount.`);
              return;
            }
            saveGoal.mutate(amount);
          },
        },
      ],
      'plain-text',
      goal.data?.amount != null ? String(goal.data.amount) : '',
      'decimal-pad',
    );
  }

  // Local preferences backup — no API involved, same file format as web.
  async function exportAppConfig() {
    try {
      const date = new Date().toISOString().slice(0, 10);
      await shareFile(
        `tradermemos-app-config-${date}.json`,
        buildAppConfigExport(session?.serverUrl ?? ''),
        'application/json',
      );
    } catch (err) {
      Alert.alert(t`Could not export config`, err instanceof Error ? err.message : String(err));
    }
  }

  async function importAppConfig() {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/json'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      const parsed = parseAppConfig(await new File(picked.assets[0].uri).text());
      if (parsed.confirmDestructive !== undefined) {
        setConfirmDestructive(parsed.confirmDestructive);
        storage.set(CONFIRM_DESTRUCTIVE_KEY, parsed.confirmDestructive);
      }
      // The server URL is part of the signed-in session, so a differing
      // api_base is reported rather than applied.
      const serverNote =
        parsed.apiBase !== undefined && parsed.apiBase !== session?.serverUrl
          ? t`The file's server URL (${parsed.apiBase}) was not applied — sign out and sign in again to switch servers.`
          : undefined;
      Alert.alert(t`App config imported`, serverNote);
    } catch (err) {
      Alert.alert(t`Could not import config`, err instanceof Error ? err.message : String(err));
    }
  }

  function handleSignOut() {
    // Tokens only — the server URL survives, so signing back in doesn't mean
    // retyping the host. That's why this is "Sign out", not "Disconnect".
    const signOutNow = () => {
      void signOut().then(() => {
        // The query cache now persists to MMKV — wipe both the live cache and
        // the snapshot so the next account never sees this account's data.
        queryClient.clear();
        clearPersistedQueryCache();
        router.replace('/login');
      });
    };
    if (!confirmDestructive) {
      signOutNow();
      return;
    }
    Alert.alert(t`Sign out?`, t`You will need to sign in again to reach this server.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Sign out`, style: 'destructive', onPress: signOutNow },
    ]);
  }

  return (
    <Host style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SettingsForm>
        <Section title={t`Accounts`}>
          {(accounts ?? []).map((account) => {
            // Equity is the funded base (cash ledger) plus realized P&L, the
            // same figure the account form and web's AccountRow show.
            // `starting_balance` is metadata — it's seeded as the ledger's
            // first deposit, so showing it here would go stale on the first
            // deposit, withdrawal or trade.
            const deposited = ledgerBalance(account.id, cash.data ?? []);
            const netPnl = pnlByAccount.get(account.id) ?? 0;
            const tradeCount = tradeCountByAccount.get(account.id) ?? 0;
            const meta = [
              account.broker || null,
              account.account_type && account.account_type !== 'cash'
                ? account.account_type.toUpperCase()
                : null,
              account.base_currency,
              tradeCount > 0 ? t`${tradeCount} trades` : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <Button
                key={account.id}
                onPress={() =>
                  router.push({ pathname: '/account-form', params: { id: account.id } })
                }
              >
                <HStack spacing={8}>
                  <VStack alignment="leading" spacing={2}>
                    <UIText
                      modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}
                    >
                      {account.name}
                    </UIText>
                    {/* Single string child — the SwiftUI Text bridge can't mount an
                        array of interpolations (RawText crash). */}
                    <UIText
                      modifiers={[
                        font({ size: 13 }),
                        foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                      ]}
                    >
                      {meta}
                    </UIText>
                  </VStack>
                  <Spacer />
                  <VStack alignment="trailing" spacing={2}>
                    <UIText
                      modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}
                    >
                      {formatCurrency(deposited + netPnl, account.base_currency)}
                    </UIText>
                    <UIText
                      modifiers={[
                        font({ size: 13 }),
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
                  </VStack>
                  <Image systemName="chevron.right" size={12} color={theme.colors.mutedForeground} />
                </HStack>
              </Button>
            );
          })}
          {accounts?.length === 0 ? <UIText>{t`No accounts yet`}</UIText> : null}
          <Button
            systemImage="plus.circle.fill"
            label={t`Add account`}
            onPress={() => router.push('/account-form')}
          />
          <Button
            systemImage="banknote"
            label={t`Deposits & withdrawals`}
            onPress={() => router.push('/funding')}
          />
        </Section>

        <Section
          title={t`Trading`}
          footer={
            <UIText>{t`Your P&L target shows on the dashboard; risk limits drive Check compliance on New Trade.`}</UIText>
          }
        >
          <Button onPress={editGoal}>
            <HStack spacing={8}>
              <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
                {t`${year} P&L goal`}
              </UIText>
              <Spacer />
              <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                {saveGoal.isPending
                  ? t`Saving…`
                  : goal.data?.amount != null
                    ? formatCurrency(goal.data.amount)
                    : t`Not set`}
              </UIText>
              <Image systemName="chevron.right" size={12} color={theme.colors.mutedForeground} />
            </HStack>
          </Button>
          <Button
            systemImage="shield"
            label={t`Risk rules`}
            onPress={() => router.push('/risk-rules')}
          />
        </Section>

        <Section title={t`Journal`}>
          <Button systemImage="tag" label={t`Tags`} onPress={() => router.push('/tags')} />
        </Section>

        <Section title={t`Integrations`}>
          <Button
            systemImage="sparkles"
            label={t`AI — vision scan & coach`}
            onPress={() => router.push('/ai')}
          />
          <Button
            systemImage="key"
            label={t`API tokens`}
            onPress={() => router.push('/api-tokens')}
          />
        </Section>

        <Section
          title={t`Preferences`}
          footer={<UIText>{t`Language is set per app in iOS Settings.`}</UIText>}
        >
          <Button
            systemImage="slider.horizontal.3"
            label={t`Display — privacy, currency, timezones`}
            onPress={() => router.push('/display')}
          />
          <Button
            systemImage="globe"
            label={t`Language`}
            onPress={() => void Linking.openSettings()}
          />
          <Toggle
            label={t`Confirm before signing out`}
            isOn={confirmDestructive}
            onIsOnChange={(value) => {
              setConfirmDestructive(value);
              storage.set(CONFIRM_DESTRUCTIVE_KEY, value);
            }}
          />
        </Section>

        {/* Every import/export in one place — trades go to the server, config
            files carry local preferences only. */}
        <Section
          title={t`Data & backup`}
          footer={
            <UIText>{t`Import broker fills or a backup; export trades as JSON, CSV, or ZIP. Config files carry app preferences only.`}</UIText>
          }
        >
          <Button
            systemImage="square.and.arrow.down"
            label={t`Import trades`}
            onPress={() => router.push('/import-trades')}
          />
          <Button
            systemImage="square.and.arrow.up"
            label={t`Export data`}
            onPress={() => router.push('/export-trades')}
          />
          <Button
            systemImage="arrow.up.doc"
            label={t`Import app config`}
            onPress={() => void importAppConfig()}
          />
          <Button
            systemImage="arrow.down.doc"
            label={t`Export app config`}
            onPress={() => void exportAppConfig()}
          />
        </Section>

        <Section>
          <Button
            systemImage="info.circle"
            label={t`About TraderMemos`}
            onPress={() => router.push('/about')}
          />
        </Section>

        <Section>
          <CenteredButton role="destructive" label={t`Sign out`} onPress={handleSignOut} />
        </Section>
      </SettingsForm>
    </Host>
  );
}
