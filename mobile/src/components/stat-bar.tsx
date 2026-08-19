import { Card, cn } from 'panelui-native';
import { Text, View } from 'react-native';

export type StatTone = 'pos' | 'neg' | 'accent' | 'amber' | 'muted';

/** Value tint per tone — `amber` is the section-title accent (`heading`). */
const TONE_CLASS: Record<StatTone, string> = {
  pos: 'text-profit',
  neg: 'text-loss',
  accent: 'text-primary',
  amber: 'text-heading',
  muted: 'text-foreground',
};

/**
 * Metric chip for dense strips (web `StatBar`): label top-left, value centered.
 *
 * The tile is a `card` surface, not a `muted` fill inside a card. A grey box
 * nested in a white card is a card-inside-a-card — iOS puts stat tiles directly
 * on the grouped background (Health, Fitness, Stocks) and lets the page do the
 * separating, which is what the `flush` DashboardCard is for.
 *
 * Carries no border: against the page the card/background contrast and the
 * elevation are the whole point of the surface, and a hairline on top of them
 * reads as an outlined box. That does mean a grid still nested inside a solid
 * DashboardCard has card-on-card and no separation — such a grid needs its
 * parent switched to `flush`, not a border added back here.
 */
export function StatBar({
  label,
  value,
  sub,
  tone = 'muted',
  plain,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: StatTone;
  /**
   * No surface of its own — for tiles living inside a solid card, where the
   * Card wrap would read as a box-in-a-box. The parent card separates; the
   * tile just lays out.
   */
  plain?: boolean;
}) {
  const Wrap = plain ? View : Card;
  return (
    // Grouped for VoiceOver — read as one "label, value, sub" phrase rather
    // than three orphaned fragments swiped past in sequence.
    //
    // `min-h-[88px]` matches the web tile's min-h so a wrapped sub doesn't make
    // one column taller than its neighbour on the first row it appears in.
    <Wrap
      className={cn(
        'min-h-[88px] grow basis-[140px] gap-2 p-3',
        !plain && 'rounded-md border-0',
      )}
      accessible
      accessibilityLabel={[label, value, sub].filter(Boolean).join(', ')}
    >
      <Text
        // Surfaceless tiles centre the label over the centred value — a
        // left-anchored caption floating over open card space reads adrift.
        className={cn('text-xs font-medium text-muted-foreground', plain && 'text-center')}
        numberOfLines={1}
        maxFontSizeMultiplier={1.6}
      >
        {label}
      </Text>
      <View className="flex-1 justify-center">
        {/* Wrapping is what keeps a long sub (a date) inside the tile: it drops
            under the value instead of pushing the centered row past both
            edges. */}
        <View className="flex-row flex-wrap items-baseline justify-center gap-x-1.5 gap-y-0.5">
          <Text
            selectable
            className={cn('shrink text-center text-lg font-semibold tabular-nums', TONE_CLASS[tone])}
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
            <Text
              className="shrink text-center text-[13px] text-muted-foreground tabular-nums"
              numberOfLines={1}
              maxFontSizeMultiplier={1.4}
            >
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
    </Wrap>
  );
}
