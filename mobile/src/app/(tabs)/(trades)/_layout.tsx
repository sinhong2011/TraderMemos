import { Stack } from 'expo-router/stack';
import { useUnistyles } from 'react-native-unistyles';

import { AddTradeButton } from '@/components/add-trade-button';
import { t } from '@lingui/core/macro';

export default function TradesLayout() {
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
      <Stack.Screen
        name="index"
        options={{ title: t`Trades`, headerRight: () => <AddTradeButton /> }}
      />
      <Stack.Screen name="[id]" options={{ headerLargeTitle: false }} />
    </Stack>
  );
}
