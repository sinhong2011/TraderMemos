import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { Icon } from '@/components/icon';
import { useApiRequest } from '@/api/hooks';
import type { Trade } from '@/api/types';
import { Swipe } from '@/components/swipe';
import { TradeRow } from '@/components/trade-row';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { armRollingNumbers } from '@/lib/rolling-numbers';

/**
 * Trade row with the standard swipe actions: trailing Edit + Delete
 * (confirmed), leading Quick journal — or Close position on open trades.
 * List-recycling safe: an open swipe snaps shut when the instance is handed
 * a different trade.
 */
export function SwipeableTradeRow({
  trade,
  showDate = true,
}: {
  trade: Trade;
  showDate?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();

  const deleteTrade = useMutation({
    mutationFn: (id: string) => api<void>(`/trades/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      // Removing a trade moves the same figures adding one does.
      armRollingNumbers();
      void queryClient.invalidateQueries();
    },
    onError: (err) => Alert.alert(t`Could not delete`, errorMessage(err)),
  });

  function confirmDelete() {
    Alert.alert(
      t`Remove ${trade.symbol}?`,
      t`Permanently deletes this trade and all of its fills. This cannot be undone.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        { text: t`Remove`, style: 'destructive', onPress: () => deleteTrade.mutate(trade.id) },
      ],
    );
  }

  const isOpen = trade.status === 'open';

  return (
    // List-recycling safe: `resetKey` snaps an open swipe shut when the
    // instance is handed a different trade.
    <Swipe resetKey={trade.id}>
      <Swipe.Start>
        {isOpen ? (
          <Swipe.Action
            color="success"
            icon={<Icon name="flag.checkered" />}
            label={t`Close`}
            onPress={() =>
              router.push({ pathname: '/edit-trade', params: { id: trade.id, addExit: '1' } })
            }
          />
        ) : (
          <Swipe.Action
            color="primary"
            icon={<Icon name="square.and.pencil" />}
            label={t`Journal`}
            onPress={() => router.push({ pathname: '/quick-journal', params: { id: trade.id } })}
          />
        )}
      </Swipe.Start>
      <Swipe.End>
        <Swipe.Action
          color="info"
          icon={<Icon name="pencil" />}
          label={t`Edit`}
          onPress={() => router.push({ pathname: '/edit-trade', params: { id: trade.id } })}
        />
        <Swipe.Action
          color="destructive"
          icon={<Icon name="trash.fill" />}
          label={t`Remove`}
          onPress={confirmDelete}
        />
      </Swipe.End>
      <TradeRow trade={trade} showDate={showDate} />
    </Swipe>
  );
}
