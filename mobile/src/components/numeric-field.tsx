import { cn } from 'panelui-native';
import { TextInput } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { numericText } from '@/lib/amount';

/** RN font weights for the four ranks the old SwiftUI `font()` modifier took. */
const WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/**
 * A field that can only hold a number — the app's one number input.
 *
 * A numeric `keyboardType` is a hint, not a guard: hardware keyboards, paste,
 * dictation and autofill all get past it, so every keystroke is run through
 * `numericText` and the field only ever reports digits (and one separator).
 *
 * It is deliberately chrome-less — no border, no fill, transparent background.
 * Every call site already owns a surface for it: a grouped `InputRow`, the
 * `FormInput` shell, the R calculator's field box. PanelUI's `Input` draws its
 * own outline/fill and `NumberInput` adds a stepper and speaks `number` rather
 * than the partially-typed string ("10.") a live amount field has to hold, so
 * neither fits here.
 *
 * The old SwiftUI implementation filtered inside a worklet on the native state,
 * so a rejected character never reached a drawn frame. A JS-drawn field can
 * only answer after the fact: React re-renders with the unchanged `value` and
 * RN restores the text, which is a rejected character appearing for a frame.
 * That is the cost of one codepath on both platforms — the value that leaves
 * this component is clean either way.
 */
export function NumericField({
  value,
  onChangeText,
  placeholder,
  align = 'leading',
  size = 16,
  weight = 'regular',
  layout = 'flex',
  decimals = true,
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Takes first responder on mount — the sheet's primary field. */
  autoFocus?: boolean;
  /** `trailing` for grouped rows (label left, value right). */
  align?: 'leading' | 'trailing';
  size?: number;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  /** `flex` fills the rest of a row; `stretch` spans a column's width. */
  layout?: 'flex' | 'stretch';
  /** Integer-only fields pass false — the separator is dropped as well. */
  decimals?: boolean;
}) {
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];

  return (
    <TextInput
      value={value}
      onChangeText={(text) => {
        const next = numericText(text, { decimals });
        if (next !== value) onChangeText(next);
      }}
      placeholder={placeholder}
      placeholderTextColor={mutedForeground}
      autoFocus={autoFocus}
      keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
      autoCorrect={false}
      autoCapitalize="none"
      className={cn(
        // Figures line up column-wise while typing, per DESIGN.md.
        'p-0 text-foreground tabular-nums',
        // flexBasis 0 + minWidth 0: the field has no intrinsic width to
        // negotiate with, so the row hands it everything left over instead of
        // collapsing it.
        layout === 'flex' ? 'min-w-0 shrink grow basis-0' : 'self-stretch',
      )}
      style={{
        minHeight: size * 1.5,
        fontSize: size,
        fontWeight: WEIGHTS[weight],
        textAlign: align === 'trailing' ? 'right' : 'left',
      }}
    />
  );
}
