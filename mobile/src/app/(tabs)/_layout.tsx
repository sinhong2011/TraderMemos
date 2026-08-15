import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ActivityIndicator, Platform, View } from 'react-native';
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
      // Android only. Material's default labels the *selected* item alone;
      // every tab keeps its label here to match how the iOS tab bar reads.
      labelVisibilityMode="labeled"
      // Android only again: left alone, the Material bar paints itself from
      // the device's dynamic color (wallpaper-derived surface + a lavender
      // indicator pill) and drifts off the app's palette entirely. Restate
      // every surface in theme tokens — bar on `card` like any other elevated
      // block, indicator and ripple on `fill` (the same capsule fill the
      // Segmented track uses; NOT `accent`, which here is the teal/amber
      // section-title hue), unselected content on `mutedForeground`. Gated
      // because `backgroundColor` is cross-platform and would replace the iOS
      // tab bar's Liquid Glass with a flat fill.
      {...(Platform.OS === 'android'
        ? {
            backgroundColor: theme.colors.card,
            indicatorColor: theme.colors.fill,
            rippleColor: theme.colors.fill,
            iconColor: { default: theme.colors.mutedForeground },
            labelStyle: {
              default: { color: theme.colors.mutedForeground },
              selected: { color: theme.colors.foreground },
            },
          }
        : null)}
    >
      {/* Per-platform icon vocabularies (the port's standing decision): `sf`
          draws the SF Symbol on iOS, `md` a Material Symbols glyph on Android
          via the same expo-symbols font the in-tree `<Icon>` uses. Both are
          typed, so tsc rejects a bad name on either side. */}
      <NativeTabs.Trigger name="(dashboard)">
        <NativeTabs.Trigger.Icon sf="house" md="home" />
        <NativeTabs.Trigger.Label>{t`Home`}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(trades)">
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="list_alt" />
        <NativeTabs.Trigger.Label>{t`Trades`}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* Calendar sizes itself to the exact visible area (no-scroll board), so it
          opts out of the automatic ScrollView insets and uses SafeAreaView instead. */}
      <NativeTabs.Trigger name="(calendar)" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>{t`Calendar`}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* Reports moved into the Home Tools menu (pushed in that stack,
          2026-08-09) — four destinations keep the bar light, and Reports is
          one hop from Home. A `role="search"` fifth tab was tried and rejected:
          this expo-router/RNS version renders it as a plain fifth tab, not
          iOS 26's separated magnifier. */}
      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
        <NativeTabs.Trigger.Label>{t`Settings`}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
