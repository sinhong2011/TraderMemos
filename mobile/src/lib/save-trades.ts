/**
 * The one save path for the new-trade batch, shared by the /trade-preview
 * screen (where Save lives) — one POST /executions per fill (the server
 * groups executions into one trade per symbol), then the journal PATCH,
 * optional dividend, and queued screenshot uploads against each trade.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { File as FsFile } from 'expo-file-system';
import { Alert } from 'react-native';

import { useApiRaw, useApiRequest } from '@/api/hooks';
import type { Account } from '@/api/types';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import {
  dividendBody,
  executionBody,
  isValidFill,
  journalPatchBody,
  type TradeFormValues,
} from './trade-form';

export function useSaveTradeBlocks(accounts: Account[] | undefined, onSaved: () => void) {
  const api = useApiRequest();
  const apiRaw = useApiRaw();
  const queryClient = useQueryClient();

  return useMutation({
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
            // See components/note-images.tsx — Expo's fetch polyfill rejects
            // RN's `{uri,name,type}` file descriptor.
            formData.append('file', new FsFile(shot.uri) as unknown as Blob, shot.name);
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
      onSaved();
    },
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });
}
