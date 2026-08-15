import { Stack } from 'expo-router/stack';
import { Platform } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { t } from '@lingui/core/macro';

export default function CalendarLayout() {
  // Screen options are plain objects, not styles — the title color has to be a
  // JS value, so it comes off the token rather than out of a class.
  const [foreground] = useCSSVariable(['--color-foreground']) as [string];
  return (
    <Stack
      screenOptions={{
        // iOS only. A transparent bar relies on UIKit's automatic content-inset
        // adjustment to push the scroll view clear of it; react-native-screens
        // has no such pass on Android, so a transparent header there simply
        // floats over the first card. Opaque takes layout space, which is the
        // Material bar anyway.
        headerTransparent: Platform.OS === 'ios',
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerLargeStyle: { backgroundColor: 'transparent' },
        headerTitleStyle: { color: foreground },
        headerLargeTitle: true,
        headerBlurEffect: 'none',
        // iOS 27 flipped the nav-bar default edge style from soft to hard, which
        // paints an iOS 18-style bar slab + hairline under our transparent header.
        // Soft keeps the iOS 26 progressive blur with no boundary line.
        scrollEdgeEffects: { top: 'soft' },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      {/* Compact bar: the screen swaps the title for the period label and mounts
          the view-mode menu + pagers as bar buttons, so the grid gets the screen. */}
      <Stack.Screen name="index" options={{ title: t`Calendar`, headerLargeTitle: false }} />
      {/* Day review is a pushed screen with a compact bar: the screen sets the
          date as the title and mounts the ±1-day chevrons as bar buttons. A
          large title here would leak the RefreshControl's inset into the stack
          on every push (see notes/funding). */}
      <Stack.Screen name="day/[date]" options={{ headerLargeTitle: false }} />
    </Stack>
  );
}
