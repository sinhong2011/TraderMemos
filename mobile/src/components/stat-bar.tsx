import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export type StatTone = 'pos' | 'neg' | 'accent' | 'amber' | 'muted';

/**
 * Metric chip for dense strips (web `StatBar`): label top-left, value centered.
 *
 * The tile is a `card` surface, not a `muted` fill inside a card. A grey box
 * nested in a white card is a card-inside-a-card — iOS puts stat tiles directly
 * on the grouped background (Health, Fitness, Stocks) and lets the page do the
 * separating, which is what the `flush` DashboardCard is for.
 *
 * Carries no border: against the page the card/background contrast and the
 * shadow are the whole point of the surface, and a hairline on top of them read
 * as an outlined box. That does mean a grid still nested inside a solid
 * DashboardCard has card-on-card and no separation — such a grid needs its
 * parent switched to `flush`, not a border added back here.
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
    // Grouped for VoiceOver — read as one "label, value, sub" phrase rather
    // than three orphaned fragments swiped past in sequence.
    <View
      style={styles.tile}
      accessible
      accessibilityLabel={[label, value, sub].filter(Boolean).join(', ')}
    >
      <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
      <View style={styles.valueBlock}>
        <View style={styles.valueRow}>
          <Text
            selectable
            style={[styles.value, { color: toneColor[tone] }]}
            // Money and durations can't wrap (no spaces), so they shrink a
            // little instead of ellipsizing mid-number; word values ("Early
            // exit", a mistake tag) get the second line.
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            maxFontSizeMultiplier={1.4}
          >
            {value}
          </Text>
          {sub ? (
            <Text style={styles.sub} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  tile: {
    flexGrow: 1,
    flexBasis: 140,
    // Matches the web tile's min-h so a wrapped sub doesn't make one column
    // taller than its neighbour on the first row it appears in.
    minHeight: 88,
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
    boxShadow: theme.shadows.card,
  },
  label: { fontSize: 12, fontWeight: '500', color: theme.colors.mutedForeground },
  valueBlock: { flex: 1, justifyContent: 'center' },
  valueRow: {
    flexDirection: 'row',
    // Wrapping is what keeps a long sub (a date) inside the tile: it drops
    // under the value instead of pushing the centered row past both edges.
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'center',
    columnGap: theme.spacing.xs + 2,
    rowGap: theme.spacing.xs / 2,
  },
  value: { flexShrink: 1, fontSize: 18, fontWeight: '600', textAlign: 'center', ...theme.numeric },
  sub: {
    flexShrink: 1,
    fontSize: 13,
    textAlign: 'center',
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
}));
