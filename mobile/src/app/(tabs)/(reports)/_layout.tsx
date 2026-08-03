import { Stack } from 'expo-router/stack';
import { useUnistyles } from 'react-native-unistyles';

import { View } from 'react-native';

import { useAccounts } from '@/api/hooks';
import { AccountMenu } from '@/components/account-menu';
import { ReportsFilterMenu } from '@/components/reports-filter-menu';
import { ToolsMenu } from '@/components/tools-menu';
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
      <Stack.Screen
        name="index"
        options={{
          title: t`Reports`,
          headerLeft: () => <AccountMenu />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <ToolsMenu />
              <HeaderFilterMenu />
            </View>
          ),
        }}
      />
      <Stack.Screen
        name="economic-events"
        options={{ title: t`Economic calendar`, headerLargeTitle: false }}
      />
      <Stack.Screen name="heatmap" options={{ title: t`P&L heatmap`, headerLargeTitle: false }} />
      <Stack.Screen name="wrapped" options={{ title: t`Year Wrapped`, headerLargeTitle: false }} />
      <Stack.Screen
        name="r-calculator"
        options={{ title: t`R calculator`, headerLargeTitle: false }}
      />
      <Stack.Screen
        name="advanced-chart"
        options={{ title: t`Chart`, headerLargeTitle: false }}
      />
    </Stack>
  );
}
