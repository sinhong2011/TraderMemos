// See the note in trade-form.tsx: @expo/ui's SwiftUI pager swallows taps on RN
// views inside its pages, so section paging rides react-native-pager-view.
import PagerView from 'react-native-pager-view';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useAccounts, useCash } from '@/api/hooks';
import { HeaderIconButton } from '@/components/header-icon-button';
import { PagerTabs } from '@/components/pager-tabs';
import { BehaviorSection } from '@/components/reports/behavior-section';
import { DetailedSection } from '@/components/reports/detailed-section';
import { OverviewSection } from '@/components/reports/overview-section';
import { RiskSection } from '@/components/reports/risk-section';
import { ReportsScrollProvider } from '@/components/reports/section-scaffold';
import { WinLossSection } from '@/components/reports/winloss-section';
import { ReportsFilterMenu } from '@/components/reports-filter-menu';
import { useSelectedAccountId } from '@/lib/account-store';
import { netDeposits } from '@/lib/cash';
import { t } from '@lingui/core/macro';

/**
 * Reports tab — the web analytics suite as swipeable pages behind a native
 * segmented control (the calendar's finger-tracked paging pattern). The bar
 * title only appears once a page scrolls under it; at rest the tab bar and
 * the segments already say where you are.
 */
export type ReportsSection = 'overview' | 'winloss' | 'detailed' | 'risk' | 'behavior';

const SECTION_VALUES: ReportsSection[] = ['overview', 'winloss', 'detailed', 'risk', 'behavior'];

/** Sparkles → Year Wrapped (#198) beside the existing display-filter menu. */
function ReportsHeaderRight() {
  const router = useRouter();
  const accounts = useAccounts();
  const cash = useCash();
  const selectedId = useSelectedAccountId();
  // An unreachable server is not a zero balance: `?? []` would have divided the
  // reports by a made-up denominator rather than leaving the unit inert.
  const denominator =
    accounts.data != null && cash.data != null
      ? netDeposits(accounts.data, selectedId, cash.data)
      : 0;
  return (
    <View style={styles.headerRight}>
      <HeaderIconButton
        systemImage="sparkles"
        label={t`Year Wrapped`}
        onPress={() => router.push('/(tabs)/(dashboard)/wrapped')}
      />
      <ReportsFilterMenu pctEnabled={denominator > 0} />
    </View>
  );
}

export default function ReportsScreen() {
  const [section, setSection] = useState<ReportsSection>('overview');
  const [scrolled, setScrolled] = useState(false);
  const pagerRef = useRef<PagerView>(null);

  // Measured rather than assumed: the switcher's height is also the top inset
  // every page scrolls under, and it changes with the text size.
  const [headerHeight, setHeaderHeight] = useState(0);
  // Held in state, not a ref: the interpolations read it during render, which
  // is exactly what a ref is not allowed to be used for.
  const [offset] = useState(() => new Animated.Value(0));

  // Each page keeps its own scroll position but they share one switcher, so a
  // page change brings it back rather than leaving it hidden by the last page.
  useEffect(() => {
    Animated.timing(offset, { toValue: 0, duration: 160, useNativeDriver: true }).start();
  }, [section, offset]);

  // `1` guards the first frame, before the switcher has been measured.
  const travel = offset.interpolate({
    inputRange: [0, Math.max(1, headerHeight)],
    outputRange: [0, -headerHeight],
    extrapolate: 'clamp',
  });
  const fade = offset.interpolate({
    inputRange: [0, Math.max(1, headerHeight)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const sections: { value: ReportsSection; label: string }[] = [
    { value: 'overview', label: t`Overview` },
    { value: 'winloss', label: t`Win / Loss` },
    { value: 'detailed', label: t`Detailed` },
    { value: 'risk', label: t`Risk` },
    { value: 'behavior', label: t`Behavior` },
  ];

  const selectSection = (value: ReportsSection) => {
    setSection(value);
    pagerRef.current?.setPage(SECTION_VALUES.indexOf(value));
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: scrolled ? t`Reports` : '',
          headerRight: () => <ReportsHeaderRight />,
        }}
      />
      <View style={styles.page}>
        {/* Floats over the pages and slides out with the content — the sections
            are long, and the switcher only matters between reads. */}
        <Animated.View
          style={[styles.segment, { opacity: fade, transform: [{ translateY: travel }] }]}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          <PagerTabs options={sections} value={section} onChange={selectSection} />
        </Animated.View>
        <ReportsScrollProvider value={{ offset, headerHeight }}>
          <PagerView
            ref={pagerRef}
            initialPage={0}
            style={styles.pager}
            onPageSelected={(event) => setSection(SECTION_VALUES[event.nativeEvent.position])}
          >
            <View key="overview" style={styles.fill}>
              <OverviewSection onScrolledChange={setScrolled} />
            </View>
            <View key="winloss" style={styles.fill}>
              <WinLossSection onScrolledChange={setScrolled} />
            </View>
            <View key="detailed" style={styles.fill}>
              <DetailedSection onScrolledChange={setScrolled} />
            </View>
            <View key="risk" style={styles.fill}>
              <RiskSection onScrolledChange={setScrolled} />
            </View>
            <View key="behavior" style={styles.fill}>
              <BehaviorSection onScrolledChange={setScrolled} />
            </View>
          </PagerView>
        </ReportsScrollProvider>
      </View>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  // Opaque and above the pages: the rows sliding under it have to disappear.
  segment: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  pager: { flex: 1 },
  fill: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
}));
