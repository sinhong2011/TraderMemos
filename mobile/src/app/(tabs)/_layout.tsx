import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ActivityIndicator, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useSession } from '@/api/session';
import { t } from '@lingui/core/macro';

// Without an explicit anchor the initial tab falls back to the alphabetically
// first group — which became (calendar) the day it was added. Home is home.
export const unstable_settings = { anchor: '(dashboard)' };

export default function TabsLayout() {
  const { session, isLoading } = useSession();
  const { theme } = useUnistyles();

  // Hold the tabs back until SecureStore has been read, otherwise a restored
  // session would flash the login modal on every cold start.
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;

  // Neutral foreground tint: the selected tab shouldn't pick up the system accent color.
  return (
    <NativeTabs tintColor={theme.colors.foreground}>
      <NativeTabs.Trigger name="(dashboard)">
        <NativeTabs.Trigger.Icon sf="house" />
        <NativeTabs.Trigger.Label>{t`Home`}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(trades)">
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" />
        <NativeTabs.Trigger.Label>{t`Trades`}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* Calendar sizes itself to the exact visible area (no-scroll board), so it
          opts out of the automatic ScrollView insets and uses SafeAreaView instead. */}
      <NativeTabs.Trigger name="(calendar)" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf="calendar" />
        <NativeTabs.Trigger.Label>{t`Calendar`}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Icon sf="gearshape" />
        <NativeTabs.Trigger.Label>{t`Settings`}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
