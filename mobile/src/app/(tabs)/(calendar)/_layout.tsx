import { Stack } from 'expo-router/stack';
import { useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';

export default function CalendarLayout() {
  const { theme } = useUnistyles();
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerLargeStyle: { backgroundColor: 'transparent' },
        headerTitleStyle: { color: theme.colors.foreground },
        headerLargeTitle: true,
        headerBlurEffect: 'none',
        // iOS 26 paints an automatic scroll-edge effect under the bar once content
        // scrolls beneath it — a dimming band that fights a header deliberately left
        // with no background at all (expo-router defaults every edge to `automatic`,
        // and its own docs warn the effect overlaps `headerBlurEffect`). Screens at
        // rest look untouched, which is why only scrolled ones showed the slab.
        scrollEdgeEffects: { top: 'hidden' },
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
