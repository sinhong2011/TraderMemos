import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type DashboardCardProps = {
  /** Section label — small grey caps, iOS grouped-table style. */
  title: string;
  /**
   * Drop the card surface and let each child supply its own. For sections whose
   * content is already a grid of tiles: stacking white tiles inside a white card
   * is a card-inside-a-card, so those sit directly on the page instead.
   */
  flush?: boolean;
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
export function DashboardCard({ title, action, control, flush, children }: DashboardCardProps) {
  return (
    <View style={flush ? styles.flush : styles.card}>
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
    boxShadow: theme.shadows.card,
  },
  // No surface of its own; the title indents to the card inset so it lines up
  // with the tiles below it rather than the screen edge.
  flush: { gap: theme.spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  // Grey caps, not a colored label. A tinted heading inside every card put a
  // fifth hue on a screen whose subject is green/red P&L — the numbers should
  // be the only color. This is also the native grouped-table header treatment.
  title: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: theme.colors.mutedForeground,
  },
  actionLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.foreground },
  pressed: { opacity: 0.6 },
}));
