import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { FormSkeleton } from '@/components/skeleton';

import { useAccounts, useApiRaw, useApiRequest, useSetups, useTags } from '@/api/hooks';
import { TradeForm } from '@/components/trade-form';
import { t } from '@lingui/core/macro';
import {
  dividendBody,
  emptyTradeForm,
  executionBody,
  isValidFill,
  journalPatchBody,
  validateTradeForm,
  type TradeFormValues,
} from '@/lib/trade-form';

/**
 * Manual trade entry, mirroring the web NewTradeDrawer submit path for every
 * symbol block: one POST /executions per fill (the server groups executions
 * into one trade per symbol), then the journal PATCH and optional dividend
 * against each resulting trade.
 */
export default function NewTradeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const apiRaw = useApiRaw();
  const { data: accounts } = useAccounts();
  const { data: setups } = useSetups();
  const { data: tags } = useTags();

  const save = useMutation({
    mutationFn: async (blocks: TradeFormValues[]) => {
      for (const values of blocks) {
        let tradeId = '';
        for (const fill of values.fills.filter(isValidFill)) {
          const res = await api<{ execution_id: string; trade_id: string }>('/executions', {
            method: 'POST',
            body: executionBody(values, fill),
          });
          if (res.trade_id) tradeId = res.trade_id;
        }
        if (tradeId) {
          await api(`/trades/${tradeId}`, { method: 'PATCH', body: journalPatchBody(values) });
          const account = accounts?.find((a) => a.id === values.accountId);
          const dividend = dividendBody(values, tradeId, account?.base_currency ?? 'USD');
          if (dividend) await api('/cash-transactions', { method: 'POST', body: dividend });
          // Queued screenshots attach once the trade exists — one at a time,
          // like the detail-screen uploader, so partial success sticks.
          for (const shot of values.screenshots) {
            const formData = new FormData();
            formData.append('file', shot as unknown as Blob);
            const response = await apiRaw(`/trades/${tradeId}/attachments`, {
              method: 'POST',
              formData,
            });
            if (!response.ok) {
              throw new Error(t`Screenshot upload failed (${response.status})`);
            }
          }
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  function handleSave(blocks: TradeFormValues[]) {
    for (const [index, values] of blocks.entries()) {
      const label = values.symbol.trim().toUpperCase() || t`symbol ${index + 1}`;
      switch (validateTradeForm(values)) {
        case 'account':
          return Alert.alert(
            t`Could not save`,
            t`No account found — create one on the web app first.`,
          );
        case 'symbol':
          return Alert.alert(t`Could not save`, t`Enter a symbol for block ${index + 1}.`);
        case 'fills':
          return Alert.alert(
            t`Could not save`,
            t`Add at least one fill with quantity and price for ${label}.`,
          );
      }
    }
    if (blocks.length === 0) return;
    save.mutate(blocks);
  }

  if (!accounts || !setups || !tags) {
    return (
      <View style={styles.loading}>
        <FormSkeleton />
      </View>
    );
  }
  if (accounts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>{t`No account found — create one on the web app first.`}</Text>
      </View>
    );
  }

  return (
    <TradeForm
      title={t`New trade`}
      initialBlocks={[emptyTradeForm(accounts[0].id)]}
      accounts={accounts}
      setups={setups}
      tags={tags}
      saving={save.isPending}
      onSave={handleSave}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  loading: { flex: 1, backgroundColor: theme.colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  muted: { color: theme.colors.mutedForeground, textAlign: 'center' },
}));
