// See the note in trade-form.tsx: @expo/ui's SwiftUI pager swallows taps on RN
// views inside its pages, so section paging rides react-native-pager-view.
import PagerView from 'react-native-pager-view';
import { Stack } from 'expo-router/stack';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Segmented } from '@/components/segmented';
import { BehaviorSection } from '@/components/reports/behavior-section';
import { DetailedSection } from '@/components/reports/detailed-section';
import { OverviewSection } from '@/components/reports/overview-section';
import { RiskSection } from '@/components/reports/risk-section';
import { WinLossSection } from '@/components/reports/winloss-section';
import { t } from '@lingui/core/macro';

/**
 * Reports tab — the web analytics suite as swipeable pages behind a native
 * segmented control (the calendar's finger-tracked paging pattern). The bar
 * title only appears once a page scrolls under it; at rest the tab bar and
 * the segments already say where you are.
 */
export type ReportsSection = 'overview' | 'winloss' | 'detailed' | 'risk' | 'behavior';

const SECTION_VALUES: ReportsSection[] = ['overview', 'winloss', 'detailed', 'risk', 'behavior'];

export default function ReportsScreen() {
  const [section, setSection] = useState<ReportsSection>('overview');
  const [scrolled, setScrolled] = useState(false);
  const pagerRef = useRef<PagerView>(null);

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
      <Stack.Screen options={{ title: scrolled ? t`Reports` : '' }} />
      <View style={styles.page}>
        <View style={styles.segment}>
          <Segmented options={sections} value={section} onChange={selectSection} />
        </View>
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
      </View>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  segment: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    alignItems: 'center',
  },
  pager: { flex: 1 },
  fill: { flex: 1 },
}));
