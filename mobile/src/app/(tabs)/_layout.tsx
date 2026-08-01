import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/api/session';
import { t } from '@lingui/core/macro';

export default function TabsLayout() {
  const { session, isLoading } = useSession();

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

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(dashboard)">
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" />
        <NativeTabs.Trigger.Label>{t`Dashboard`}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(trades)">
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" />
        <NativeTabs.Trigger.Label>{t`Trades`}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Icon sf="gearshape" />
        <NativeTabs.Trigger.Label>{t`Settings`}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
