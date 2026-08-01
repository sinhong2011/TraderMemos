import { Stack } from 'expo-router/stack';
import { useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';

export default function SettingsLayout() {
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
      <Stack.Screen name="index" options={{ title: t`Settings` }} />
    </Stack>
  );
}
