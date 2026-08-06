import {
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  autocorrectionDisabled,
  font,
  foregroundStyle,
  keyboardType,
  monospacedDigit,
  multilineTextAlignment,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef } from 'react';
import { useUnistyles } from 'react-native-unistyles';

import { numericText } from '@/lib/amount';
import { AppHost } from '@/components/app-host';

/**
 * Native text state that can only hold a number.
 *
 * The listener is a worklet, so it runs synchronously on the UI runtime inside
 * the write that produced the text — a rejected character is replaced before
 * SwiftUI draws the field again, rather than a commit later like the RN
 * round-trip. For SwiftUI fields that already live inside a `Form` host (the
 * settings screens); RN screens use `NumericField` below.
 */
export function useNumericState(initialValue: string, { decimals = true } = {}) {
  const state = useNativeState(initialValue);
  useEffect(() => {
    // Assigning `onChange` is the @expo/ui API for this — a native object with
    // one listener slot, not React state the compiler needs to track.
    /* eslint-disable react-hooks/immutability */
    state.onChange = (text: string) => {
      'worklet';
      const next = numericText(text, { decimals });
      // Writing back re-enters this listener once, with `next` already clean.
      if (next !== text) state.value = next;
    };
    return () => {
      state.onChange = null;
    };
    /* eslint-enable react-hooks/immutability */
  }, [state, decimals]);
  return state;
}

/**
 * A field that can only hold a number — the app's one number input.
 *
 * A numeric `keyboardType` is a hint, not a guard: hardware keyboards, paste,
 * dictation and autofill all get past it. An RN `TextInput` can only answer
 * after the fact — the character is drawn, the change crosses to JS, and the
 * corrected value crosses back a commit later, which is the letter you see
 * appear and vanish. This is a SwiftUI `TextField` instead, and its native
 * state carries a **worklet** change listener: the rejected character is
 * rewritten synchronously on the UI runtime, inside the same state write that
 * produced it, so it never survives to a drawn frame.
 */
export function NumericField({
  value,
  onChangeText,
  placeholder,
  align = 'leading',
  size = 16,
  weight,
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
  const { theme } = useUnistyles();
  const state = useNumericState(value, { decimals });
  // What we last handed the parent — distinguishes its echo of our own value
  // from a genuine outside change (reset, prefill, preset button).
  const echoed = useRef(value);

  useEffect(() => {
    if (value === echoed.current) return;
    echoed.current = value;
    state.set(value);
  }, [state, value]);

  return (
    <AppHost
      matchContents={{ vertical: true }}
      style={[layout === 'flex' ? styles.flex : styles.stretch, { minHeight: size * 1.5 }]}
    >
      <TextField
        text={state}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onTextChange={(text) => {
          // The listener already cleaned the field; clean again for the value
          // that leaves this component — JS never sees the rejected keystroke.
          const next = numericText(text, { decimals });
          echoed.current = next;
          if (next !== value) onChangeText(next);
        }}
        modifiers={[
          keyboardType(decimals ? 'decimal-pad' : 'numeric'),
          autocorrectionDisabled(),
          multilineTextAlignment(align),
          font({ size, weight }),
          // Figures line up column-wise while typing, per DESIGN.md.
          monospacedDigit(),
          foregroundStyle(theme.colors.foreground),
        ]}
      />
    </AppHost>
  );
}

const styles = {
  // flexBasis 0 + minWidth 0: the host has no intrinsic width to negotiate
  // with, so the row hands it everything left over instead of collapsing it.
  flex: { flexGrow: 1, flexBasis: 0, minWidth: 0 },
  stretch: { alignSelf: 'stretch' },
} as const;
