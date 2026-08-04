import { Stack } from 'expo-router/stack';
import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { AccountMenu } from '@/components/account-menu';
import { AddMenu } from '@/components/add-menu';
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
          // Start-of-day actions live left: scope the account, open a
          // calculator. Creation stays right on the + menu.
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <AccountMenu />
              <ToolsMenu />
            </View>
          ),
          headerRight: () => <AddMenu />,
        }}
      />
      <Stack.Screen name="notes" options={{ title: t`Notes` }} />
      <Stack.Screen name="playbook" options={{ title: t`Playbook` }} />
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
