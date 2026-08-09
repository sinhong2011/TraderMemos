import { Stack } from 'expo-router/stack';
import { useUnistyles } from 'react-native-unistyles';

import { useAccounts, useCash } from '@/api/hooks';
import { AccountMenu } from '@/components/account-menu';
import { ReportsFilterMenu } from '@/components/reports-filter-menu';
import { ToolsMenu } from '@/components/tools-menu';
import { useSelectedAccountId } from '@/lib/account-store';
import { netDeposits } from '@/lib/cash';
import { t } from '@lingui/core/macro';

/** The % unit needs a balance to divide by — probed here to label the menu row. */
function ReportsHeaderFilterMenu() {
  const accounts = useAccounts();
  const cash = useCash();
  const selectedId = useSelectedAccountId();
  // An unreachable server is not a zero balance: `?? []` would have divided the
  // reports by a made-up denominator rather than leaving the unit inert.
  const denominator =
    accounts.data != null && cash.data != null
      ? netDeposits(accounts.data, selectedId, cash.data)
      : 0;
  return <ReportsFilterMenu pctEnabled={denominator > 0} />;
}

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
        // iOS 27 flipped the nav-bar default edge style from soft to hard, which
        // paints an iOS 18-style bar slab + hairline under our transparent header.
        // Soft keeps the iOS 26 progressive blur with no boundary line.
        scrollEdgeEffects: { top: 'soft' },
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
      {/* Reports left the tab bar for the Tools menu (2026-08-09), so it pushes
          in the Home stack. The bar goes opaque because the pager root is a
          plain View, not an inset-aware ScrollView; the segmented section
          switcher keeps the vertical room a large title would take. Account
          scope is set from the Home header — the back button owns the left slot
          here, so Reports keeps only its display filters. */}
      <Stack.Screen
        name="reports"
        options={{
          title: t`Reports`,
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: { backgroundColor: theme.colors.background },
          headerRight: () => <ReportsHeaderFilterMenu />,
        }}
      />
      <Stack.Screen
        name="heatmap-cell"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetAllowedDetents: [0.55, 1],
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
        }}
      />
      <Stack.Screen name="wrapped" options={{ title: t`Year Wrapped`, headerLargeTitle: false }} />
    </Stack>
  );
}
