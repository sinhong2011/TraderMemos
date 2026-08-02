import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export type PillTone = 'pos' | 'neg' | 'accent' | 'amber' | 'muted';

/** Compact status/tag chip (web `Pill`): tinted surface, toned text. */
export function Pill({ tone = 'muted', children }: { tone?: PillTone; children: ReactNode }) {
  const { theme } = useUnistyles();
  const toneColor: Record<PillTone, string> = {
    pos: theme.colors.profit,
    neg: theme.colors.loss,
    accent: theme.colors.primary,
    amber: theme.colors.accent,
    muted: '',
  };
  const color = toneColor[tone];

  // Primary is a fill-only color: accent pills tint the surface but keep
  // neutral text; P&L tones still color their text.
  const textColor = tone === 'accent' ? theme.colors.foreground : color;
  return (
    <View style={[styles.pill, color ? { backgroundColor: `${color}1F` } : styles.mutedPill]}>
      <Text style={[styles.text, textColor ? { color: textColor } : styles.mutedText]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
  },
  mutedPill: { backgroundColor: theme.colors.muted },
  text: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  mutedText: { color: theme.colors.mutedForeground },
}));
