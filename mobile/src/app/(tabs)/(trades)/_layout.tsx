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
        // iOS 26 paints an automatic scroll-edge effect under the bar once content
        // scrolls beneath it — a dimming band that fights a header deliberately left
        // with no background at all (expo-router defaults every edge to `automatic`,
        // and its own docs warn the effect overlaps `headerBlurEffect`). Screens at
        // rest look untouched, which is why only scrolled ones showed the slab.
        scrollEdgeEffects: { top: 'hidden' },
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
