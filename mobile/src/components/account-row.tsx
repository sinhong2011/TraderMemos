import { RNHostView } from '@expo/ui';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';

import type { AccountRowProps } from './account-row.types';

/**
 * The settings hub's account row, in its cross-platform form —
 * `account-row.ios.tsx` keeps the SwiftUI original; both export the same
 * name. Plain RN inside an `RNHostView` (the NavRow pattern): name + meta
 * leading, equity + P&L trailing, disclosure chevron.
 */
export function AccountRow({ name, meta, equity, pnl, pnlColor, onPress }: AccountRowProps) {
  const { theme } = useUnistyles();
  return (
    <RNHostView matchContents>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.leading}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.meta}>{meta}</Text>
        </View>
        <View style={styles.trailing}>
          <Text style={styles.equity}>{equity}</Text>
          <Text style={[styles.pnl, { color: pnlColor }]}>{pnl}</Text>
        </View>
        <Icon name="chevron.right" size={12} tintColor={theme.colors.mutedForeground} />
      </Pressable>
    </RNHostView>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  pressed: { backgroundColor: theme.colors.accent },
  leading: { flex: 1, gap: 2 },
  trailing: { alignItems: 'flex-end', gap: 2 },
  name: { fontSize: 17, color: theme.colors.foreground },
  meta: { fontSize: 13, color: theme.colors.mutedForeground },
  equity: { fontSize: 17, color: theme.colors.foreground, fontVariant: ['tabular-nums'] },
  pnl: { fontSize: 13, fontVariant: ['tabular-nums'] },
}));
