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
