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
      {/* The day review is a full read, not a peek — it opens at the taller
          detent so the session summary and curve are both above the fold. */}
      <Stack.Screen
        name="day/[date]"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetAllowedDetents: [0.7, 1],
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
        }}
      />
    </Stack>
  );
}
