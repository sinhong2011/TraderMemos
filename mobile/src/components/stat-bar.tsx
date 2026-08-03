import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export type StatTone = 'pos' | 'neg' | 'accent' | 'amber' | 'muted';

/**
 * Metric chip for dense strips (web `StatBar`): label top-left, value centered.
 * Sits on `muted` inside a card, so it reads as a nested tile.
 */
export function StatBar({
  label,
  value,
  sub,
  tone = 'muted',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: StatTone;
}) {
  const { theme } = useUnistyles();
  const toneColor: Record<StatTone, string> = {
    pos: theme.colors.profit,
    neg: theme.colors.loss,
    accent: theme.colors.primary,
    amber: theme.colors.accent,
    muted: theme.colors.foreground,
  };

  return (
    <View style={styles.tile}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text selectable style={[styles.value, { color: toneColor[tone] }]} numberOfLines={1}>
          {value}
        </Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  tile: {
    flexGrow: 1,
    flexBasis: 140,
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  label: { fontSize: 12, fontWeight: '500', color: theme.colors.mutedForeground },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: theme.spacing.xs + 2,
  },
  value: { fontSize: 18, fontWeight: '600', ...theme.numeric },
  sub: { fontSize: 13, color: theme.colors.mutedForeground, ...theme.numeric },
}));
