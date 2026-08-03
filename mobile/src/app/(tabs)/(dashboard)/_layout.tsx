import { Stack } from 'expo-router/stack';
import { useUnistyles } from 'react-native-unistyles';

import { AccountMenu } from '@/components/account-menu';
import { AddMenu } from '@/components/add-menu';
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
          headerLeft: () => <AccountMenu />,
          headerRight: () => <AddMenu />,
        }}
      />
    </Stack>
  );
}
