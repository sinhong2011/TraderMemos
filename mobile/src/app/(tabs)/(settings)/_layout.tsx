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
      {/* Inline title, like the other pull-to-refresh lists: a RefreshControl
          on a pushed `headerLargeTitle` screen leaks 60pt of top inset per
          push (see the note in funding.tsx). */}
      <Stack.Screen name="tags" options={{ title: t`Tags`, headerLargeTitle: false }} />
      {/* "Account" is taken by account-form, the broker-account editor. */}
      <Stack.Screen name="profile" options={{ title: t`Your account`, headerLargeTitle: false }} />
      <Stack.Screen
        name="two-factor"
        options={{ title: t`Two-factor`, headerLargeTitle: false }}
      />
      <Stack.Screen
        name="change-password"
        options={{ title: t`Change password`, headerLargeTitle: false }}
      />
      <Stack.Screen name="users" options={{ title: t`Users`, headerLargeTitle: false }} />
      <Stack.Screen name="user-form" options={{ title: t`Add user`, headerLargeTitle: false }} />
      {/* Title comes from the screen — it names the account being managed. */}
      <Stack.Screen name="user-detail" options={{ headerLargeTitle: false }} />
      <Stack.Screen
        name="trading-journal"
        options={{ title: t`Trading & journal`, headerLargeTitle: false }}
      />
      <Stack.Screen
        name="integrations"
        options={{ title: t`Integrations`, headerLargeTitle: false }}
      />
      <Stack.Screen name="general" options={{ title: t`General`, headerLargeTitle: false }} />
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
        name="data-backup"
        options={{ title: t`Data & backup`, headerLargeTitle: false }}
      />
      {/* Title comes from the screen — it names the token being inspected. */}
      <Stack.Screen name="token-uses" options={{ headerLargeTitle: false }} />
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
