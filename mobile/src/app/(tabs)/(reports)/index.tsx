import { useState } from 'react';

import { OverviewSection } from '@/components/reports/overview-section';
import { WinLossSection } from '@/components/reports/winloss-section';
import { t } from '@lingui/core/macro';

/**
 * Reports tab — the web analytics suite folded into sections behind a chip
 * switcher (the segmented control can't seat five labels at phone width).
 * Only the active section mounts, so each switch costs one query fan-out,
 * and TanStack's cache makes returning to a section instant.
 */
export type ReportsSection = 'overview' | 'winloss' | 'detailed' | 'risk' | 'behavior';

export default function ReportsScreen() {
  const [section, setSection] = useState<ReportsSection>('overview');

  const sections: { value: ReportsSection; label: string }[] = [
    { value: 'overview', label: t`Overview` },
    { value: 'winloss', label: t`Win / Loss` },
  ];

  switch (section) {
    case 'winloss':
      return <WinLossSection sections={sections} section={section} onSection={setSection} />;
    default:
      return <OverviewSection sections={sections} section={section} onSection={setSection} />;
  }
}
