import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Swipe, type SwipeHandle } from 'panelui-native';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { useApiRequest } from '@/api/hooks';
import type { Trade } from '@/api/types';
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
  const swipeable = useRef<SwipeHandle>(null);
  // A tile's content is white on every colored fill; the neutral `default`
  // tile takes the background token instead, which is what its label uses.
  const [background] = useCSSVariable(['--color-background']) as [string];

  useEffect(() => {
    swipeable.current?.close();
  }, [trade.id]);

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

  const go = (action: () => void) => () => {
    swipeable.current?.close();
    action();
  };
  const isOpen = trade.status === 'open';

  return (
    // No full swipe: both outermost actions are destructive-ish (remove, and
    // closing a position), and neither should fire from a hard drag alone.
    <Swipe ref={swipeable} fullSwipe={false}>
      <Swipe.Start>
        {isOpen ? (
          <Swipe.Action
            color="success"
            icon={<Icon name="flag.checkered" size={17} tintColor="#FFFFFF" />}
            label={t`Close`}
            onPress={go(() =>
              router.push({ pathname: '/edit-trade', params: { id: trade.id, addExit: '1' } }),
            )}
          />
        ) : (
          <Swipe.Action
            color="primary"
            icon={<Icon name="square.and.pencil" size={17} tintColor="#FFFFFF" />}
            label={t`Journal`}
            onPress={go(() =>
              router.push({ pathname: '/quick-journal', params: { id: trade.id } }),
            )}
          />
        )}
      </Swipe.Start>
      <Swipe.End>
        <Swipe.Action
          color="default"
          icon={<Icon name="pencil" size={17} tintColor={background} />}
          label={t`Edit`}
          onPress={go(() => router.push({ pathname: '/edit-trade', params: { id: trade.id } }))}
        />
        <Swipe.Action
          color="destructive"
          icon={<Icon name="trash.fill" size={17} tintColor="#FFFFFF" />}
          label={t`Remove`}
          onPress={go(confirmDelete)}
        />
      </Swipe.End>
      <TradeRow trade={trade} showDate={showDate} />
    </Swipe>
  );
}
