import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type DashboardCardProps = {
  /** Signature accent card-header label (web `text-chart-3`). */
  title: string;
  /** Trailing link-style action, e.g. "View all". */
  action?: { label: string; onPress: () => void };
  /** Trailing custom control (segmented picker etc.) — wins over `action`. */
  control?: ReactNode;
  children: ReactNode;
};

/**
 * DESIGN.md "card blocks": borderless `card` section with the accent header
 * the web dashboard uses on every card.
 */
export function DashboardCard({ title, action, control, children }: DashboardCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {control ??
          (action ? (
            <Pressable
              onPress={action.onPress}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.actionLabel}>{action.label} ›</Text>
            </Pressable>
          ) : null)}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  title: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, color: theme.colors.accent },
  actionLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.foreground },
  pressed: { opacity: 0.6 },
}));
