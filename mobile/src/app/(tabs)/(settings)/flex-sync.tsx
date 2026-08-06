import {
  LabeledContent,
  Section,
  Text as UIText,
  TextField,
  Toggle,
  useNativeState,
} from '@expo/ui/swift-ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { queryKeys, useAccounts, useApiRequest, useFlexSync } from '@/api/hooks';
import type { FlexSyncPut, FlexSyncResult } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { SettingsForm } from '@/components/settings-form';
import { t } from '@lingui/core/macro';
import { formatDate, formatTime } from '@/lib/format';
import { AppHost } from '@/components/app-host';

/**
 * IBKR Flex Web Service sync for one account: query ID + token + scheduled
 * toggle, and a manual "Sync now" that runs the long fetch inline (tens of
 * seconds — the button shows a spinner, the result lands in an alert).
 */
export default function FlexSyncScreen() {
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const accounts = useAccounts();
  const flex = useFlexSync(accountId ?? '');

  const account = accounts.data?.find((candidate) => candidate.id === accountId);
  const settings = flex.data;

  const queryIdState = useNativeState<string>('');
  const queryIdText = useRef('');
  const tokenState = useNativeState<string>('');
  const tokenText = useRef('');
  const [enabled, setEnabled] = useState(false);
  // Adopt the loaded settings once — the native fields keep their own state after.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current || settings == null) return;
    hydrated.current = true;
    queryIdState.set(settings.query_id ?? '');
    queryIdText.current = settings.query_id ?? '';
    setEnabled(settings.enabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const save = useMutation({
    mutationFn: (body: FlexSyncPut) =>
      api(`/accounts/${accountId}/flex-sync`, { method: 'PUT', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.flexSync(accountId!) });
      tokenState.set('');
      tokenText.current = '';
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`/accounts/${accountId}/flex-sync`, { method: 'DELETE' }),
    onSuccess: () => {
      hydrated.current = false;
      void queryClient.invalidateQueries({ queryKey: queryKeys.flexSync(accountId!) });
    },
    onError: (err) => Alert.alert(t`Could not remove`, err.message),
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
    onError: (err) => Alert.alert(t`Sync failed`, err.message),
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
    <View style={styles.page}>
      <AppHost style={{ flex: 1 }}>
        <SettingsForm>
        <Section
          title={account ? account.name : t`IBKR Flex sync`}
          footer={
            <UIText>
              {t`From IBKR Client Portal: Performance & Reports → Flex Queries. The token is stored server-side only.`}
            </UIText>
          }
        >
          <LabeledContent label={t`Query ID`}>
            <TextField
              placeholder="123456"
              text={queryIdState}
              onTextChange={(text) => {
                queryIdText.current = text;
              }}
            />
          </LabeledContent>
          <LabeledContent label={t`Token`}>
            <TextField
              placeholder={settings?.token_set ? '••••••••' : t`Web Service token`}
              text={tokenState}
              onTextChange={(text) => {
                tokenText.current = text;
              }}
            />
          </LabeledContent>
          <Toggle
            label={t`Scheduled sync`}
            isOn={enabled}
            onIsOnChange={(value) => setEnabled(value)}
          />
          <CenteredButton
            label={save.isPending ? t`Saving…` : t`Save`}
            onPress={handleSave}
          />
        </Section>

        {settings?.configured ? (
          <Section
            title={t`Status`}
            footer={
              settings.last_error ? <UIText>{settings.last_error}</UIText> : undefined
            }
          >
            {settings.last_synced_at ? (
              <LabeledContent label={t`Last synced`}>
                <UIText>
                  {`${formatDate(settings.last_synced_at)} ${formatTime(settings.last_synced_at)}`}
                </UIText>
              </LabeledContent>
            ) : null}
            {settings.last_status ? (
              <LabeledContent label={t`Last status`}>
                <UIText>{settings.last_status}</UIText>
              </LabeledContent>
            ) : null}
            <CenteredButton
              label={run.isPending ? t`Syncing…` : t`Sync now`}
              onPress={() => {
                if (!run.isPending) run.mutate();
              }}
            />
          </Section>
        ) : null}

          {settings?.configured ? (
            <Section>
              <CenteredButton
                role="destructive"
                label={remove.isPending ? t`Removing…` : t`Remove Flex sync`}
                onPress={confirmDelete}
              />
            </Section>
          ) : null}
        </SettingsForm>
      </AppHost>
      {run.isPending ? (
        <View style={styles.syncOverlay} pointerEvents="none">
          <ActivityIndicator />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1 },
  syncOverlay: {
    position: 'absolute',
    top: theme.spacing.xl,
    right: theme.spacing.xl,
  },
}));
