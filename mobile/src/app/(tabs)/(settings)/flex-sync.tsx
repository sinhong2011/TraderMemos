import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Spinner } from 'panelui-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';

import { queryKeys, useAccounts, useApiRequest, useFlexSync } from '@/api/hooks';
import type { FlexSyncPut, FlexSyncResult } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { SettingsForm } from '@/components/settings-form';
import {
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsToggle,
  ValueText,
} from '@/components/settings-rows';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { useFormatters } from '@/lib/format';

/**
 * IBKR Flex Web Service sync for one account: query ID + token + scheduled
 * toggle, and a manual "Sync now" that runs the long fetch inline (tens of
 * seconds — the button shows a spinner, the result lands in an alert).
 */
export default function FlexSyncScreen() {
  const { formatDate, formatTime } = useFormatters();
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const accounts = useAccounts();
  const flex = useFlexSync(accountId ?? '');

  const account = accounts.data?.find((candidate) => candidate.id === accountId);
  const settings = flex.data;

  const queryIdText = useRef('');
  const tokenText = useRef('');
  const [enabled, setEnabled] = useState(false);
  // Adopt the loaded settings once — the fields keep their own text after.
  // `seed` remounts them, which is the only way an uncontrolled field takes a
  // value it did not start with (the hydration, and the token clear on save).
  const [seed, setSeed] = useState(0);
  const [queryIdSeed, setQueryIdSeed] = useState('');
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current || settings == null) return;
    hydrated.current = true;
    queryIdText.current = settings.query_id ?? '';
    setQueryIdSeed(settings.query_id ?? '');
    setEnabled(settings.enabled);
    setSeed((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const save = useMutation({
    mutationFn: (body: FlexSyncPut) =>
      api(`/accounts/${accountId}/flex-sync`, { method: 'PUT', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.flexSync(accountId!) });
      // The token is stored server-side now — drop the local copy.
      tokenText.current = '';
      setSeed((n) => n + 1);
    },
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`/accounts/${accountId}/flex-sync`, { method: 'DELETE' }),
    onSuccess: () => {
      hydrated.current = false;
      void queryClient.invalidateQueries({ queryKey: queryKeys.flexSync(accountId!) });
    },
    onError: (err) => Alert.alert(t`Could not remove`, errorMessage(err)),
  });

  const run = useMutation({
    mutationFn: () =>
      api<FlexSyncResult>(`/accounts/${accountId}/flex-sync/run`, { method: 'POST' }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries();
      Alert.alert(
        t`Sync complete`,
        t`${result.trades} trades from ${result.rows} rows — ${result.inserted} fills inserted, ${result.skipped} duplicates skipped.`,
      );
    },
    onError: (err) => Alert.alert(t`Sync failed`, errorMessage(err)),
  });

  function handleSave() {
    const queryId = queryIdText.current.trim();
    if (!queryId) {
      Alert.alert(t`Could not save`, t`Enter the Flex Query ID.`);
      return;
    }
    const token = tokenText.current.trim();
    save.mutate({
      query_id: queryId,
      enabled,
      // Omit to keep the stored token; required by the server on first create.
      ...(token ? { token } : {}),
    });
  }

  function confirmDelete() {
    Alert.alert(t`Remove Flex sync?`, t`The stored token is deleted from the server.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Remove`, style: 'destructive', onPress: () => remove.mutate() },
    ]);
  }

  return (
    <View className="flex-1">
      <SettingsForm>
        <SettingsSection
          title={account ? account.name : t`IBKR Flex sync`}
          footer={t`From IBKR Client Portal: Performance & Reports → Flex Queries. The token is stored server-side only.`}
        >
          <SettingsInput
            key={`query-${seed}`}
            label={t`Query ID`}
            placeholder="123456"
            defaultValue={queryIdSeed}
            onChangeText={(text) => {
              queryIdText.current = text;
            }}
          />
          <SettingsInput
            key={`token-${seed}`}
            label={t`Token`}
            placeholder={settings?.token_set ? '••••••••' : t`Web Service token`}
            onChangeText={(text) => {
              tokenText.current = text;
            }}
          />
          <SettingsToggle label={t`Scheduled sync`} value={enabled} onValueChange={setEnabled} />
        </SettingsSection>

        <CenteredButton
          label={save.isPending ? t`Saving…` : t`Save`}
          loading={save.isPending}
          onPress={handleSave}
        />

        {settings?.configured ? (
          <>
            <SettingsSection title={t`Status`} footer={settings.last_error ?? undefined}>
              {settings.last_synced_at ? (
                <SettingsRow label={t`Last synced`}>
                  <ValueText>
                    {`${formatDate(settings.last_synced_at)} ${formatTime(settings.last_synced_at)}`}
                  </ValueText>
                </SettingsRow>
              ) : null}
              {settings.last_status ? (
                <SettingsRow label={t`Last status`}>
                  <ValueText>{settings.last_status}</ValueText>
                </SettingsRow>
              ) : null}
            </SettingsSection>

            <CenteredButton
              label={run.isPending ? t`Syncing…` : t`Sync now`}
              loading={run.isPending}
              onPress={() => {
                if (!run.isPending) run.mutate();
              }}
            />

            <CenteredButton
              role="destructive"
              label={remove.isPending ? t`Removing…` : t`Remove Flex sync`}
              loading={remove.isPending}
              onPress={confirmDelete}
            />
          </>
        ) : null}
      </SettingsForm>
      {/* The run takes tens of seconds and the button is far up the page by
          then — a corner spinner is the standing proof it is still going. */}
      {run.isPending ? (
        <View className="absolute right-6 top-6" pointerEvents="none">
          <Spinner />
        </View>
      ) : null}
    </View>
  );
}
