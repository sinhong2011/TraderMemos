import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { FormSkeleton } from '@/components/skeleton';

import { useAccounts, useApiRequest, useSetups, useTags, useTrade } from '@/api/hooks';
import { AttachmentsCard } from '@/components/attachments-card';
import { TradeForm } from '@/components/trade-form';
import { t } from '@lingui/core/macro';
import {
  dividendBody,
  emptyFill,
  executionBody,
  executionPatchBody,
  isValidFill,
  journalPatchBody,
  tradeFormFromDetail,
  validateTradeForm,
  type TradeFormValues,
} from '@/lib/trade-form';

type ExecutionRes = { execution_id: string; trade_id: string };

/**
 * Edit an existing trade, mirroring the web drawer's edit path: PATCH changed
 * fills / POST new ones / DELETE removed ones (tracking the trade id across
 * regroups), then upsert the journal on whatever trade survives.
 */
export default function EditTradeScreen() {
  // `addExit=1` (swipe "Close position") pre-appends a fresh exit-side fill.
  const { id, addExit } = useLocalSearchParams<{ id: string; addExit?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const { data: trade, isLoading } = useTrade(id);
  const { data: accounts } = useAccounts();
  const { data: setups } = useSetups();
  const { data: tags } = useTags();

  const save = useMutation({
    mutationFn: async (values: TradeFormValues) => {
      if (!trade) return;
      let tradeId = trade.id;
      const existingIds = new Set(trade.fills.map((f) => f.id));
      const valid = values.fills.filter(isValidFill);

      for (const fill of valid) {
        if (fill.id && existingIds.has(fill.id)) {
          const res = await api<ExecutionRes>(`/executions/${fill.id}`, {
            method: 'PATCH',
            body: executionPatchBody(fill),
          });
          if (res.trade_id) tradeId = res.trade_id;
        } else {
          const res = await api<ExecutionRes>('/executions', {
            method: 'POST',
            body: executionBody(values, fill),
          });
          if (res.trade_id) tradeId = res.trade_id;
        }
      }

      const keptIds = new Set(valid.map((f) => f.id).filter(Boolean));
      for (const old of trade.fills) {
        if (keptIds.has(old.id)) continue;
        const res = await api<ExecutionRes>(`/executions/${old.id}`, { method: 'DELETE' });
        tradeId = res.trade_id ?? '';
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

  function handleSave(blocks: TradeFormValues[]) {
    const values = blocks[0];
    if (!values) return;
    if (validateTradeForm(values) === 'fills') {
      return Alert.alert(t`Could not save`, t`Add at least one fill with quantity and price.`);
    }
    save.mutate(values);
  }

  if (isLoading || !trade || !accounts || !setups || !tags) {
    return isLoading || !accounts || !setups || !tags ? (
      <View style={styles.loading}>
        <FormSkeleton />
      </View>
    ) : (
      <View style={styles.centered}>
        <Text style={styles.muted}>{t`Trade not found`}</Text>
      </View>
    );
  }

  const initial = tradeFormFromDetail(trade);
  if (addExit === '1') {
    initial.fills = [...initial.fills, emptyFill(trade.direction === 'long' ? 'sell' : 'buy')];
  }

  return (
    <TradeForm
      title={addExit === '1' ? t`Close position` : t`Edit trade`}
      initialBlocks={[initial]}
      accounts={accounts}
      setups={setups}
      tags={tags}
      saving={save.isPending}
      lockInstrument
      // Live card, not part of the draft: uploads/removals apply immediately,
      // independent of Save/Cancel.
      footer={<AttachmentsCard trade={trade} />}
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
