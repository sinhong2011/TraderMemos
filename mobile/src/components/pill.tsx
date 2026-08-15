import type { ReactNode } from 'react';
import { cn } from 'panelui-native';
import { Text, View } from 'react-native';

export type PillTone = 'pos' | 'neg' | 'accent' | 'amber' | 'muted';

/**
 * Surface tint per tone. Kept hand-built rather than mapped onto PanelUI's
 * `Badge`: the tones are P&L and heading hues, which are domain colors with no
 * badge variant behind them, and the label has to stay on one line.
 *
 * `/12` matches the 0x1F alpha the SwiftUI-era pill washed its surface with.
 */
const TONE_SURFACE: Record<PillTone, string> = {
  pos: 'bg-profit/12',
  neg: 'bg-loss/12',
  accent: 'bg-primary/12',
  amber: 'bg-heading/12',
  muted: 'bg-muted',
};

/**
 * Label color per tone. `primary` is a fill-only color: accent pills tint the
 * surface but keep neutral text; P&L and heading tones color their text too.
 */
const TONE_LABEL: Record<PillTone, string> = {
  pos: 'text-profit',
  neg: 'text-loss',
  accent: 'text-foreground',
  amber: 'text-heading',
  muted: 'text-muted-foreground',
};

/** Compact status/tag chip (web `Pill`): tinted surface, toned text. */
export function Pill({ tone = 'muted', children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <View className={cn('flex-row items-center rounded-sm px-2 py-0.5', TONE_SURFACE[tone])}>
      <Text
        className={cn('text-[11px] font-semibold tracking-[0.3px]', TONE_LABEL[tone])}
        numberOfLines={1}
      >
        {children}
      </Text>
    </View>
  );
}
