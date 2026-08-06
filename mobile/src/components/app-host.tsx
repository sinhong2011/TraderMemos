import { Host } from '@expo/ui/swift-ui';
import type { ComponentProps } from 'react';

import { useResolvedScheme } from '@/lib/prefs';

/**
 * `Host` with the app's appearance pinned to it.
 *
 * SwiftUI views are real UIKit/SwiftUI, not React Native, so they read the
 * *system* color scheme and know nothing about Unistyles. Without this, an
 * Appearance of Light on a phone in Dark Mode would repaint only the
 * Unistyles-styled surfaces and leave every Form, Section, Picker and Button
 * dark — a half-themed app. `colorScheme` overrides the SwiftUI environment
 * for the whole hosted tree, so the two halves agree.
 *
 * Use this instead of `Host` everywhere; a bare `Host` is a themed hole.
 */
export function AppHost(props: ComponentProps<typeof Host>) {
  return <Host colorScheme={useResolvedScheme()} {...props} />;
}
