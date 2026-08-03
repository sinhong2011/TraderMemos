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
      <Stack.Screen
        name="index"
        options={{
          title: t`Reports`,
          headerLeft: () => <AccountMenu />,
          headerRight: () => <HeaderFilterMenu />,
        }}
      />
    </Stack>
  );
}
