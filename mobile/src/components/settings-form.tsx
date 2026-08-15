import { FieldGroup } from '@expo/ui';
import type { ComponentProps } from 'react';
import { useUnistyles } from 'react-native-unistyles';

/**
 * The settings-screen form container, in its cross-platform form.
 *
 * This is the base module, so Android resolves here; iOS overrides it with
 * `settings-form.ios.tsx`, which keeps the SwiftUI `Form` and its four
 * iOS-only modifiers exactly as they shipped. Both export the same name and
 * take the same children, so the 25 settings screens never branch. (TypeScript
 * only resolves the base name, which is why the universal version — not the
 * iOS one — has to be the unsuffixed file.)
 *
 * `FieldGroup` is `@expo/ui`'s universal grouped-list container — the very same
 * SwiftUI `Form` on iOS, a Compose grouped list on Android — which is why the
 * screens' `Section` rows keep working underneath it.
 *
 * None of the iOS modifiers are restated here: `scrollContentBackground` and
 * `listSectionSpacing` are SwiftUI-only knobs, and `scrollEdgeEffectStyle`
 * comes from the iOS-26-only `modules/scroll-edge-style`. Compose's grouped
 * list already paints on the theme background, so only that token carries over
 * — as a plain style, not a modifier.
 *
 * Callers that pass `modifiers` (three screens pass `scrollDismissesKeyboard`)
 * still typecheck and stay safe: SwiftUI modifier configs are inert data to
 * Compose, so they're accepted and ignored rather than crashing.
 */
export function SettingsForm({
  modifiers: _iosModifiers,
  style,
  ...props
}: ComponentProps<typeof FieldGroup>) {
  const { theme } = useUnistyles();
  return <FieldGroup style={{ backgroundColor: theme.colors.background, ...style }} {...props} />;
}
