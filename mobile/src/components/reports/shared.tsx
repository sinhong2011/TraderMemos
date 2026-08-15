/** Small shared pieces for the Reports sections: micro-headings, tappable
 * event rows (behavior/compliance lists), and ranked magnitude rows (the
 * phone stand-in for web's horizontal bar charts and the symbol treemap). */

import { cn } from 'panelui-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Pill, type PillTone } from '@/components/pill';
import { locale } from '@/i18n';
import { pnlClass, pnlColor, usePnlPalette } from '@/styles/pnl';

/**
 * One row of a signed P&L bar chart.
 *
 * A P&L bar has to be green above zero and red below it, and a PanelUI series
 * carries one colour — so the values are split across two stacked series, only
 * one of which is non-zero in any row. Stacking makes the other contribute
 * nothing to the baseline, so each category still draws exactly one bar.
 */
export function signedBars(name: string, value: number) {
  return { name, gain: value >= 0 ? value : 0, loss: value < 0 ? value : 0 };
}

/** Uppercase list caption, matching the settings-section eyebrow style. */
export function MicroHeading({ children }: { children: ReactNode }) {
  return (
    <Text className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">
      {children}
    </Text>
  );
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
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className="flex-row items-center gap-2 py-1.5 active:opacity-60"
    >
      <Text className="text-[13px] tabular-nums text-muted-foreground">{fmtEventDay(date)}</Text>
      <Text className="shrink text-sm font-medium text-foreground" numberOfLines={1}>
        {title}
      </Text>
      {pill ? <Pill tone={pillTone}>{pill}</Pill> : null}
      <View className="flex-1" />
      <Text
        className={cn('text-sm font-semibold tabular-nums', valueTint == null && 'text-foreground')}
        style={valueTint != null ? { color: valueTint } : undefined}
      >
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
  const palette = usePnlPalette();
  return (
    <View className="gap-1">
      <View className="flex-row items-baseline gap-2">
        <Text className="shrink text-sm font-medium text-foreground" numberOfLines={1}>
          {label}
        </Text>
        {meta ? <Text className="text-xs tabular-nums text-muted-foreground">{meta}</Text> : null}
        <View className="flex-1" />
        <Text className={cn('text-sm font-semibold tabular-nums', pnlClass(rawValue))}>{value}</Text>
      </View>
      <View className="h-[5px] overflow-hidden rounded-[3px] bg-muted">
        <View
          className="h-full rounded-[3px]"
          style={{
            width: `${Math.max(3, (Math.abs(rawValue) / Math.max(maxAbs, 1)) * 100)}%`,
            backgroundColor: pnlColor(palette, rawValue),
          }}
        />
      </View>
    </View>
  );
}
