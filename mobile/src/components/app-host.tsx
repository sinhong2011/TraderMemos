import { Host } from '@expo/ui';
import type { ComponentProps } from 'react';

import { useResolvedScheme } from '@/lib/prefs';

/**
 * `Host` with the app's appearance pinned to it.
 *
 * Hosted views are real SwiftUI / Jetpack Compose, not React Native, so they
 * read the *system* color scheme and know nothing about Unistyles. Without
 * this, an Appearance of Light on a phone in Dark Mode would repaint only the
 * Unistyles-styled surfaces and leave every Form, Section, Picker and Button
 * dark — a half-themed app. `colorScheme` overrides the hosted environment for
 * the whole subtree, so the two halves agree.
 *
 * The import is `@expo/ui` (the universal entry), not `@expo/ui/swift-ui`:
 * universal `Host` re-exports the SwiftUI host verbatim on iOS and the Compose
 * host on Android, so this one line is what lets ~80 hosted subtrees mount on
 * both platforms.
 *
 * Use this instead of `Host` everywhere; a bare `Host` is a themed hole.
 */
export function AppHost(props: ComponentProps<typeof Host>) {
  return <Host colorScheme={useResolvedScheme()} {...props} />;
}
