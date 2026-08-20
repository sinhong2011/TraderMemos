import { Card } from 'panelui-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

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
  const header = (
    // The title indents to the card inset so it lines up with the tiles below
    // it rather than with the screen edge.
    <View className="flex-row items-center justify-between gap-3 px-1">
      {/* Grey caps, not a colored label. A tinted heading inside every card put
          a fifth hue on a screen whose subject is green/red P&L — the numbers
          should be the only color. This is also the native grouped-table
          header treatment. */}
      <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </Text>
      {control ??
        (action ? (
          <Pressable onPress={action.onPress} hitSlop={8} className="active:opacity-60">
            <Text className="text-[13px] font-medium text-foreground">{action.label} ›</Text>
          </Pressable>
        ) : null)}
    </View>
  );

  // `flush` has no surface of its own; the children bring theirs.
  if (flush) {
    return (
      <View className="gap-3">
        {header}
        {children}
      </View>
    );
  }

  // Borderless (the app's card rule) — the `card`/`background` contrast and the
  // card's own elevation do the separating, not a hairline.
  return (
    <Card className="gap-3 rounded-lg border-0 p-4">
      {header}
      {children}
    </Card>
  );
}
