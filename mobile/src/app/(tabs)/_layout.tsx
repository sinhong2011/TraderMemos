import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ActivityIndicator, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useSession } from '@/api/session';
import { t } from '@lingui/core/macro';

// Anchor deep links so (dashboard) is the tab beneath them. Note this alone
// does NOT pick the cold-start tab: the "/" URL match happens on leaf routes,
// so (dashboard)/_layout also declares `initialRouteName: 'index'` — without
// that, the alphabetically first group (calendar) wins the tie. Home is home.
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
    <NativeTabs
      tintColor={theme.colors.foreground}
      // Android only, and load-bearing here rather than cosmetic. Material's
      // navigation bar defaults to labelling the *selected* item alone and
      // relies on icons to carry the rest — but `Icon sf=` is iOS-only, so the
      // unselected tabs draw neither glyph nor text and the bar comes up with
      // one visible item and three invisible ones. Labelling all four is what
      // keeps the app navigable until the triggers get real Android icons
      // (which needs drawables or an icon family — see the port notes).
      labelVisibilityMode="labeled"
    >
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
      {/* Reports moved into the Home Tools menu (pushed in that stack,
          2026-08-09) — four destinations keep the bar light, and Reports is
          one hop from Home. A `role="search"` fifth tab was tried and rejected:
          this expo-router/RNS version renders it as a plain fifth tab, not
          iOS 26's separated magnifier. */}
      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Icon sf="gearshape" />
        <NativeTabs.Trigger.Label>{t`Settings`}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
