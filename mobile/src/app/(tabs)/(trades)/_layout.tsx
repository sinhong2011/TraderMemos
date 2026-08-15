import { Stack } from 'expo-router/stack';
import { Platform } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { AddTradeButton } from '@/components/add-trade-button';
import { t } from '@lingui/core/macro';

export default function TradesLayout() {
  const { theme } = useUnistyles();
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
        headerTitleStyle: { color: theme.colors.foreground },
        headerLargeTitle: true,
        headerBlurEffect: 'none',
        // iOS 27 flipped the nav-bar default edge style from soft to hard, which
        // paints an iOS 18-style bar slab + hairline under our transparent header.
        // Soft keeps the iOS 26 progressive blur with no boundary line.
        scrollEdgeEffects: { top: 'soft' },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: t`Trades`, headerRight: () => <AddTradeButton /> }}
      />
      <Stack.Screen name="[id]" options={{ headerLargeTitle: false }} />
      <Stack.Screen
        name="symbol-journal"
        options={{ title: t`Symbol journal`, headerLargeTitle: false }}
      />
    </Stack>
  );
}
