import { Chip, cn } from 'panelui-native';
import { View } from 'react-native';

export type ChipTone = 'accent' | 'neg';

/** Multi-select chips read as checkboxes to assistive tech; single as radios. */
export type ChipSelect = 'single' | 'multi';

type Option = { value: string; label: string };

/**
 * Selection colors for the `neg` tone (mistake tags), which PanelUI's own
 * selected state cannot express — it paints one accent surface, and a mistake
 * has to read as a loss. Selection reads from the fill *and* the outline: a
 * tinted fill alone was near-invisible in a long group (11 emotions).
 */
const NEG_SELECTED = 'border-loss/50 bg-loss/16';

/**
 * Wrapping chip selector (web ToneToggle groups): single- or multi-select is the
 * caller's toggle logic — this just renders and reports taps.
 */
export function ChipGroup({
  options,
  selected,
  onToggle,
  tone = 'accent',
  select = 'multi',
}: {
  options: readonly Option[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  tone?: ChipTone;
  select?: ChipSelect;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <Chip
            key={option.value}
            variant="outline"
            selected={active}
            onPress={() => onToggle(option.value)}
            // The capsule is ~28pt tall; the slop brings the target to 44.
            hitSlop={{ top: 8, bottom: 8 }}
            // A chip in a group is one of a set, not a lone button — the roles
            // are what tell a screen reader which set it is.
            accessibilityRole={select === 'single' ? 'radio' : 'checkbox'}
            accessibilityState={{ selected: active, checked: active }}
            className={cn(active && tone === 'neg' && NEG_SELECTED)}
            labelClassName={cn(active && tone === 'neg' && 'text-foreground')}
          >
            {option.label}
          </Chip>
        );
      })}
    </View>
  );
}
