import { Stack } from 'expo-router/stack';
import { useUnistyles } from 'react-native-unistyles';

import { useAccounts } from '@/api/hooks';
import { AccountMenu } from '@/components/account-menu';
import { ReportsFilterMenu } from '@/components/reports-filter-menu';
import { t } from '@lingui/core/macro';

/** The % unit needs a balance to divide by — probed here to label the menu row. */
function HeaderFilterMenu() {
  const accounts = useAccounts();
  const denominator = (accounts.data ?? []).reduce((sum, a) => sum + a.starting_balance, 0);
  return <ReportsFilterMenu pctEnabled={denominator > 0} />;
}

export default function ReportsLayout() {
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
      {/* No large title — the tab bar already says Reports, and the segmented
          section switcher wants the vertical room. The bar goes opaque here
          because the pager root is a plain View, not an inset-aware ScrollView;
          the title fades in from the screen once a page scrolls under it. */}
      <Stack.Screen
        name="index"
        options={{
          title: '',
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: { backgroundColor: theme.colors.background },
          headerLeft: () => <AccountMenu />,
          // Tools moved to the Home header — Reports keeps its display filters.
          headerRight: () => <HeaderFilterMenu />,
        }}
      />
      <Stack.Screen
        name="economic-events"
        options={{ title: t`Economic calendar`, headerLargeTitle: false }}
      />
      <Stack.Screen name="heatmap" options={{ title: t`P&L heatmap`, headerLargeTitle: false }} />
      <Stack.Screen name="wrapped" options={{ title: t`Year Wrapped`, headerLargeTitle: false }} />
    </Stack>
  );
}
