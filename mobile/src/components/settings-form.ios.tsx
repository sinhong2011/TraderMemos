import { Form } from '@expo/ui/swift-ui';
import {
  background,
  listSectionSpacing,
  scrollContentBackground,
} from '@expo/ui/swift-ui/modifiers';
import type { ComponentProps } from 'react';
import { useUnistyles } from 'react-native-unistyles';

import { scrollEdgeEffectStyle } from '@/lib/scroll-edge-effect';

/**
 * `Form` with the app's settings styling: the system grouped background is
 * replaced by the app background token and the default iOS section gaps are
 * tightened. Row labels keep the native neutral color — no form-wide tint,
 * which would repaint every navigation label brand-blue. Extra `modifiers`
 * append after the shared set.
 *
 * `soft` matches the app-wide scroll edge choice (every Stack layout pins
 * `top: 'soft'`) — but the screen prop can't reach a SwiftUI Form's scroll
 * view, so it has to be re-stated here as a SwiftUI modifier or iOS 26+
 * paints the `hard` slab + hairline under the header.
 */
export function SettingsForm({ modifiers = [], ...props }: ComponentProps<typeof Form>) {
  const { theme } = useUnistyles();
  return (
    <Form
      modifiers={[
        scrollContentBackground('hidden'),
        background(theme.colors.background),
        listSectionSpacing('compact'),
        scrollEdgeEffectStyle('soft'),
        ...modifiers,
      ]}
      {...props}
    />
  );
}
