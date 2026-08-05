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
      <Stack.Screen
        name="account-form"
        options={{ title: t`Account`, headerLargeTitle: false }}
      />
      <Stack.Screen name="funding" options={{ title: t`Funding`, headerLargeTitle: false }} />
      <Stack.Screen name="tags" options={{ title: t`Tags` }} />
      <Stack.Screen name="risk-rules" options={{ title: t`Risk rules` }} />
      <Stack.Screen
        name="display"
        options={{ title: t`Display`, headerLargeTitle: false }}
      />
      <Stack.Screen
        name="prop-settings"
        options={{ title: t`Prop rules`, headerLargeTitle: false }}
      />
      <Stack.Screen
        name="flex-sync"
        options={{ title: t`IBKR Flex sync`, headerLargeTitle: false }}
      />
      <Stack.Screen name="ai" options={{ title: t`AI` }} />
      {/* Title comes from the screen — it names the integration being edited. */}
      <Stack.Screen name="ai/[kind]" options={{ headerLargeTitle: false }} />
      <Stack.Screen
        name="api-tokens"
        options={{ title: t`API tokens`, headerLargeTitle: false }}
      />
      <Stack.Screen
        name="import-trades"
        options={{ title: t`Import trades`, headerLargeTitle: false }}
      />
      <Stack.Screen
        name="export-trades"
        options={{ title: t`Export data`, headerLargeTitle: false }}
      />
      <Stack.Screen name="about" options={{ title: t`About`, headerLargeTitle: false }} />
    </Stack>
  );
}
