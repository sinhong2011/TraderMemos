/** Small shared pieces for the Reports sections: micro-headings, tappable
 * event rows (behavior/compliance lists), and ranked magnitude rows (the
 * phone stand-in for web's horizontal bar charts and the symbol treemap). */

import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Pill, type PillTone } from '@/components/pill';
import { locale } from '@/i18n';
import { pnlColor } from '@/styles/unistyles';

/** Uppercase list caption, matching the settings-section eyebrow style. */
export function MicroHeading({ children }: { children: ReactNode }) {
  return <Text style={styles.micro}>{children}</Text>;
}

export function fmtEventDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Date · symbol · reason-pill row with a P&L trailing — taps open the trade. */
export function EventRow({
  date,
  title,
  pill,
  pillTone = 'amber',
  value,
  valueTint,
  onPress,
}: {
  date: string;
  title: string;
  pill?: string;
  pillTone?: PillTone;
  value: string;
  valueTint?: string;
  onPress?: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}
    >
      <Text style={styles.eventDate}>{fmtEventDay(date)}</Text>
      <Text style={styles.eventTitle} numberOfLines={1}>
        {title}
      </Text>
      {pill ? <Pill tone={pillTone}>{pill}</Pill> : null}
      <View style={styles.spacer} />
      <Text style={[styles.eventValue, { color: valueTint ?? theme.colors.foreground }]}>
        {value}
      </Text>
    </Pressable>
  );
}

/** Label + tinted magnitude bar + value — a ranked horizontal "bar chart" row. */
export function MagnitudeRow({
  label,
  meta,
  value,
  rawValue,
  maxAbs,
}: {
  label: string;
  meta?: string;
  value: string;
  /** Signed raw amount — drives the bar length and tint. */
  rawValue: number;
  maxAbs: number;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.magRow}>
      <View style={styles.magHead}>
        <Text style={styles.magLabel} numberOfLines={1}>
          {label}
        </Text>
        {meta ? <Text style={styles.magMeta}>{meta}</Text> : null}
        <View style={styles.spacer} />
        <Text style={[styles.magValue, { color: pnlColor(theme.colors, rawValue) }]}>{value}</Text>
      </View>
      <View style={styles.magTrack}>
        <View
          style={[
            styles.magFill,
            {
              width: `${Math.max(3, (Math.abs(rawValue) / Math.max(maxAbs, 1)) * 100)}%`,
              backgroundColor: pnlColor(theme.colors, rawValue),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  micro: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.mutedForeground,
  },
  spacer: { flex: 1 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs + 2,
  },
  pressed: { opacity: 0.6 },
  eventDate: { fontSize: 13, color: theme.colors.mutedForeground, ...theme.numeric },
  eventTitle: { flexShrink: 1, fontSize: 14, fontWeight: '500', color: theme.colors.foreground },
  eventValue: { fontSize: 14, fontWeight: '600', ...theme.numeric },
  magRow: { gap: theme.spacing.xs },
  magHead: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm },
  magLabel: { flexShrink: 1, fontSize: 14, fontWeight: '500', color: theme.colors.foreground },
  magMeta: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  magValue: { fontSize: 14, fontWeight: '600', ...theme.numeric },
  magTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.muted,
    overflow: 'hidden',
  },
  magFill: { height: '100%', borderRadius: 3 },
}));
