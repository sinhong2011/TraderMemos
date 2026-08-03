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
import { useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useAccounts, useAnnualGoal, useApiRequest, queryKeys } from '@/api/hooks';
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
import { shareFile } from '@/lib/file-transfer';
import { formatCurrency } from '@/lib/format';
import { clearPersistedQueryCache, storage } from '@/storage/mmkv';

/**
 * Native SwiftUI settings hub, covering the web settings tabs on the phone:
 * accounts + funding, annual goal, risk rules, journal (tags, daily
 * checklist), AI integrations, API tokens, behavior, about. Sub-screens are
 * pushed; the annual goal edits in place via a native prompt.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const { theme } = useUnistyles();
  const { session, signOut } = useSession();
  const { data: accounts } = useAccounts();

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
          ? t`The file's server URL (${parsed.apiBase}) was not applied — disconnect and sign in to switch servers.`
          : undefined;
      Alert.alert(t`App config imported`, serverNote);
    } catch (err) {
      Alert.alert(t`Could not import config`, err instanceof Error ? err.message : String(err));
    }
  }

  function handleSignOut() {
    const disconnect = () => {
      void signOut().then(() => {
        // The query cache now persists to MMKV — wipe both the live cache and
        // the snapshot so the next account never sees this account's data.
        queryClient.clear();
        clearPersistedQueryCache();
        router.replace('/login');
      });
    };
    if (!confirmDestructive) {
      disconnect();
      return;
    }
    Alert.alert(t`Disconnect?`, t`You will need to sign in again to reach this server.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Disconnect`, style: 'destructive', onPress: disconnect },
    ]);
  }

  return (
    <Host style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SettingsForm>
        <Section title={t`Accounts`}>
          {(accounts ?? []).map((account) => (
            <Button
              key={account.id}
              onPress={() => router.push({ pathname: '/account-form', params: { id: account.id } })}
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
                    {`${account.broker ? `${account.broker} · ` : ''}${account.base_currency} · ${formatCurrency(account.starting_balance, account.base_currency)}`}
                  </UIText>
                </VStack>
                <Spacer />
                <Image systemName="chevron.right" size={12} color={theme.colors.mutedForeground} />
              </HStack>
            </Button>
          ))}
          {accounts?.length === 0 ? <UIText>{t`No accounts yet`}</UIText> : null}
          <Button
            systemImage="plus.circle.fill"
            label={t`Add account`}
            onPress={() => router.push('/account-form')}
          />
        </Section>

        <Section footer={<UIText>{t`Deposits, withdrawals, and fees feed the equity curve.`}</UIText>}>
          <Button
            systemImage="banknote"
            label={t`Deposits & withdrawals`}
            onPress={() => router.push('/funding')}
          />
        </Section>

        <Section
          title={t`${year} goal`}
          footer={<UIText>{t`Net P&L target — progress shows on the dashboard.`}</UIText>}
        >
          <Button onPress={editGoal}>
            <HStack spacing={8}>
              <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
                {t`Annual P&L goal`}
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
        </Section>

        <Section
          title={t`Rules`}
          footer={<UIText>{t`Limits used by Check compliance on New Trade.`}</UIText>}
        >
          <Button
            systemImage="shield"
            label={t`Risk rules`}
            onPress={() => router.push('/risk-rules')}
          />
        </Section>

        <Section title={t`Journal`}>
          <Button systemImage="tag" label={t`Tags`} onPress={() => router.push('/tags')} />
          <Button
            systemImage="checklist"
            label={t`Daily checklist`}
            onPress={() => router.push('/checklist')}
          />
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
          title={t`Data`}
          footer={<UIText>{t`Import broker fills or a backup; export trades as JSON, CSV, or ZIP.`}</UIText>}
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
        </Section>

        <Section
          title={t`Behavior`}
          footer={<UIText>{t`Language is set per app in iOS Settings.`}</UIText>}
        >
          <Button
            systemImage="slider.horizontal.3"
            label={t`Display — privacy, currency, timezones`}
            onPress={() => router.push('/display')}
          />
          <Toggle
            label={t`Confirm before disconnecting`}
            isOn={confirmDestructive}
            onIsOnChange={(value) => {
              setConfirmDestructive(value);
              storage.set(CONFIRM_DESTRUCTIVE_KEY, value);
            }}
          />
          <Button
            systemImage="globe"
            label={t`Language`}
            onPress={() => void Linking.openSettings()}
          />
        </Section>

        <Section
          title={t`App configuration`}
          footer={<UIText>{t`Backup or restore local app preferences.`}</UIText>}
        >
          <Button
            systemImage="arrow.down.doc"
            label={t`Export config`}
            onPress={() => void exportAppConfig()}
          />
          <Button
            systemImage="arrow.up.doc"
            label={t`Import config`}
            onPress={() => void importAppConfig()}
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
          <CenteredButton role="destructive" label={t`Disconnect`} onPress={handleSignOut} />
        </Section>
      </SettingsForm>
    </Host>
  );
}
