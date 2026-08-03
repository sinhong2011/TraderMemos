import { TradeFilterMenu } from '@/components/trade-filter-menu';
import { t } from '@lingui/core/macro';
import {
  resetReportsControls,
  setReportsControls,
  useReportsControls,
  type AvgMode,
  type PnlMode,
  type ReportsDuration,
  type ReportsSide,
  type UnitMode,
} from '@/lib/reports-display';

/**
 * Nav-bar pull-down carrying every reports display control — the phone fold
 * of the web ReportsControlBar's five segmented controls. Data filters (side,
 * duration) sit above display modes (basis, unit, average); the icon fills
 * whenever anything departs from the defaults.
 */
export function ReportsFilterMenu({ pctEnabled }: { pctEnabled: boolean }) {
  const controls = useReportsControls();
  const active =
    controls.side !== 'all' ||
    controls.duration !== 'all' ||
    controls.pnlMode !== 'net' ||
    controls.unitMode !== 'abs' ||
    controls.avgMode !== 'mean';

  return (
    <TradeFilterMenu
      active={active}
      onReset={resetReportsControls}
      groups={[
        {
          key: 'side',
          title: t`Side`,
          icon: 'arrow.up.arrow.down',
          options: [
            { value: 'all', label: t`All sides` },
            { value: 'long', label: t`Long` },
            { value: 'short', label: t`Short` },
          ],
          value: controls.side,
          onChange: (v) => setReportsControls({ side: v as ReportsSide }),
        },
        {
          key: 'duration',
          title: t`Duration`,
          icon: 'clock',
          options: [
            { value: 'all', label: t`Any duration` },
            { value: 'scalp', label: t`Scalp` },
            { value: 'day', label: t`Day` },
            { value: 'swing', label: t`Swing` },
          ],
          value: controls.duration,
          onChange: (v) => setReportsControls({ duration: v as ReportsDuration }),
        },
        {
          key: 'pnl',
          title: t`P&L basis`,
          icon: 'dollarsign.circle',
          options: [
            { value: 'net', label: t`Net (after fees)` },
            { value: 'gross', label: t`Gross (before fees)` },
          ],
          value: controls.pnlMode,
          onChange: (v) => setReportsControls({ pnlMode: v as PnlMode }),
        },
        {
          key: 'unit',
          title: t`Unit`,
          icon: 'percent',
          options: [
            { value: 'abs', label: t`Dollars` },
            // The % basis needs a starting balance — surface why it's inert.
            { value: 'pct', label: pctEnabled ? t`% of balance` : t`% of balance (needs balance)` },
          ],
          value: controls.unitMode,
          onChange: (v) => setReportsControls({ unitMode: v as UnitMode }),
        },
        {
          key: 'avg',
          title: t`Average`,
          icon: 'chart.bar.doc.horizontal',
          options: [
            { value: 'mean', label: t`Mean` },
            { value: 'median', label: t`Median` },
          ],
          value: controls.avgMode,
          onChange: (v) => setReportsControls({ avgMode: v as AvgMode }),
        },
      ]}
    />
  );
}
