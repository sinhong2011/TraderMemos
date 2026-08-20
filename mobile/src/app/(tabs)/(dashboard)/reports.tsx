// See the note in trade-form.tsx: @expo/ui's SwiftUI pager swallows taps on RN
// views inside its pages, so section paging rides react-native-pager-view.
import PagerView from 'react-native-pager-view';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { useAccounts, useCash, useSystemInfo } from '@/api/hooks';
import { HeaderIconButton } from '@/components/header-icon-button';
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

/** Share link (#204) + sparkles → Year Wrapped (#198) beside the filter menu. */
function ReportsHeaderRight() {
  const router = useRouter();
  const accounts = useAccounts();
  const cash = useCash();
  const selectedId = useSelectedAccountId();
  // Public links only exist when the server enables them (web's shareEnabled).
  const shareEnabled = useSystemInfo().data?.features?.share_links === true;
  // An unreachable server is not a zero balance: `?? []` would have divided the
  // reports by a made-up denominator rather than leaving the unit inert.
  const denominator =
    accounts.data != null && cash.data != null
      ? netDeposits(accounts.data, selectedId, cash.data)
      : 0;
  return (
    <View className="flex-row items-center gap-2">
      {shareEnabled ? (
        <HeaderIconButton
          systemImage="square.and.arrow.up"
          label={t`Share link`}
          onPress={() => router.push('/share-reports-link')}
        />
      ) : null}
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
  // Sections mount on first visit, not up front: a chart rendered inside a
  // never-attached off-screen pager page measures 0×0 and draws stuck — empty
  // line charts, hairline bars, a radar collapsed to its centre dot. Once
  // visited a section stays mounted so its scroll position survives.
  const [visited, setVisited] = useState<ReadonlySet<ReportsSection>>(
    () => new Set<ReportsSection>(['overview']),
  );
  const pagerRef = useRef<PagerView>(null);

  const visit = (value: ReportsSection) =>
    setVisited((prev) => (prev.has(value) ? prev : new Set(prev).add(value)));

  const sections: { value: ReportsSection; label: string }[] = [
    { value: 'overview', label: t`Overview` },
    // "W/L", not "Win / Loss": five triggers share a 360dp phone's width, and
    // the long label wraps to two lines and crushes the whole strip.
    { value: 'winloss', label: t`W/L` },
    { value: 'detailed', label: t`Detailed` },
    { value: 'risk', label: t`Risk` },
    { value: 'behavior', label: t`Behavior` },
  ];

  // Pages need the *expanded* header height as their top padding: UIKit's
  // automatic inset adjustment does not reach a scroll view nested in the
  // pager (the same gap `usePagerBottomInset` covers at the bottom), so
  // `automatic` would leave every page under the transparent bar. Captured
  // once rather than read live: the hook's value shrinks as the large title
  // collapses, and a padding that shrank with it would drag the content up
  // mid-scroll. The screen always mounts at rest, so the first read is the
  // expanded height.
  const [headerHeight] = useState(useHeaderHeight());

  const selectSection = (value: ReportsSection) => {
    visit(value);
    setSection(value);
    pagerRef.current?.setPage(SECTION_VALUES.indexOf(value));
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t`Reports`,
          headerRight: () => <ReportsHeaderRight />,
        }}
      />
      <View className="flex-1 bg-background">
        {/* The switcher rides at the top of each page's scroll content rather
            than floating over it: a floating bar has to be positioned against
            the header, and under a transparent (blurred) header there is no
            fixed y to position it at. In-content it simply scrolls under the
            blur like every other row — the Trades list header pattern. */}
        <ReportsScrollProvider value={{ sections, section, onChange: selectSection, headerHeight }}>
          <PagerView
            ref={pagerRef}
            initialPage={0}
            style={FILL}
            onPageSelected={(event) => {
              const next = SECTION_VALUES[event.nativeEvent.position];
              visit(next);
              setSection(next);
            }}
          >
            <View key="overview" className="flex-1">
              {visited.has('overview') ? <OverviewSection /> : null}
            </View>
            <View key="winloss" className="flex-1">
              {visited.has('winloss') ? <WinLossSection /> : null}
            </View>
            <View key="detailed" className="flex-1">
              {visited.has('detailed') ? <DetailedSection /> : null}
            </View>
            <View key="risk" className="flex-1">
              {visited.has('risk') ? <RiskSection /> : null}
            </View>
            <View key="behavior" className="flex-1">
              {visited.has('behavior') ? <BehaviorSection /> : null}
            </View>
          </PagerView>
        </ReportsScrollProvider>
      </View>
    </>
  );
}

/** `PagerView` is a native component, not one Uniwind styles by class. */
const FILL = { flex: 1 } as const;
