import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { FormSkeleton } from '@/components/skeleton';

import { useAccounts, useApiRequest, useSetups, useTags } from '@/api/hooks';
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
 * Full manual trade entry, mirroring the web NewTradeDrawer submit path: one
 * POST /executions per fill (the server regroups automatically), then the
 * journal PATCH and optional dividend against the resulting trade.
 */
export default function NewTradeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const { data: accounts } = useAccounts();
  const { data: setups } = useSetups();
  const { data: tags } = useTags();

  const save = useMutation({
    mutationFn: async (values: TradeFormValues) => {
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
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  function handleSave(values: TradeFormValues) {
    switch (validateTradeForm(values)) {
      case 'account':
        return Alert.alert(t`Could not save`, t`No account found — create one on the web app first.`);
      case 'symbol':
        return Alert.alert(t`Could not save`, t`Enter a symbol.`);
      case 'fills':
        return Alert.alert(t`Could not save`, t`Add at least one fill with quantity and price.`);
      default:
        save.mutate(values);
    }
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
      initial={emptyTradeForm(accounts[0].id)}
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
