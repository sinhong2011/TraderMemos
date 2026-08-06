import { Stack } from 'expo-router/stack';
import { useUnistyles } from 'react-native-unistyles';

import { AccountMenu } from '@/components/account-menu';
import { ToolsMenu } from '@/components/tools-menu';
import { t } from '@lingui/core/macro';

// Cold start resolves the URL "/", which every tab group's index route matches
// once group segments are stripped; the router breaks that tie with `isInitial`,
// so this stack's index must be declared the initial route or the alphabetically
// first group — (calendar) — wins. The tabs-layout anchor alone can't fix this:
// it only marks the group config, and empty-path matching considers leaf routes.
export const unstable_settings = { initialRouteName: 'index' };

export default function DashboardLayout() {
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
        options={{
          title: t`Home`,
          // Account scope leads left; the calculators live right. Creation
          // moved off Home — the Trades tab owns the + menu.
          headerLeft: () => <AccountMenu />,
          headerRight: () => <ToolsMenu />,
        }}
      />
      <Stack.Screen name="notes" options={{ title: t`Notes`, headerLargeTitle: false }} />
      <Stack.Screen
        name="checklist"
        options={{ title: t`Daily checklist`, headerLargeTitle: false }}
      />
      <Stack.Screen name="playbook" options={{ title: t`Playbook`, headerLargeTitle: false }} />
      <Stack.Screen
        name="r-calculator"
        options={{ title: t`R calculator`, headerLargeTitle: false }}
      />
      <Stack.Screen
        name="advanced-chart"
        options={{ title: t`Chart`, headerLargeTitle: false }}
      />
      <Stack.Screen
        name="economic-events"
        options={{ title: t`Economic calendar`, headerLargeTitle: false }}
      />
    </Stack>
  );
}
