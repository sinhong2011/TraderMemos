import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useApiRequest } from '@/api/hooks';
import type { Trade } from '@/api/types';
import { TradeRow } from '@/components/trade-row';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { armRollingNumbers } from '@/lib/rolling-numbers';

function SwipeAction({
  icon,
  label,
  color,
  leading = false,
  onPress,
}: {
  icon: SFSymbol;
  label: string;
  color: string;
  leading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.swipeAction,
        leading && styles.swipeActionLeading,
        { backgroundColor: color },
        pressed && styles.pressed,
      ]}
    >
      <SymbolView name={icon} size={17} tintColor="#FFFFFF" />
      <Text style={styles.swipeLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

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
  const { theme } = useUnistyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const swipeable = useRef<SwipeableMethods>(null);

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
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      leftThreshold={36}
      rightThreshold={36}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() =>
        isOpen ? (
          <SwipeAction
            icon="flag.checkered"
            label={t`Close`}
            color={theme.colors.profit}
            leading
            onPress={go(() =>
              router.push({ pathname: '/edit-trade', params: { id: trade.id, addExit: '1' } }),
            )}
          />
        ) : (
          <SwipeAction
            icon="square.and.pencil"
            label={t`Journal`}
            color={theme.colors.primary}
            leading
            onPress={go(() =>
              router.push({ pathname: '/quick-journal', params: { id: trade.id } }),
            )}
          />
        )
      }
      renderRightActions={() => (
        <View style={styles.swipeActionsRow}>
          <SwipeAction
            icon="pencil"
            label={t`Edit`}
            color={theme.colors.flat}
            onPress={go(() => router.push({ pathname: '/edit-trade', params: { id: trade.id } }))}
          />
          <SwipeAction
            icon="trash.fill"
            label={t`Remove`}
            color={theme.colors.destructive}
            onPress={go(confirmDelete)}
          />
        </View>
      )}
    >
      <TradeRow trade={trade} showDate={showDate} />
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create((theme) => ({
  swipeActionsRow: { flexDirection: 'row', gap: theme.spacing.sm, marginLeft: theme.spacing.sm },
  swipeAction: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
  },
  swipeActionLeading: { marginRight: theme.spacing.sm },
  pressed: { opacity: 0.7 },
  swipeLabel: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
}));
