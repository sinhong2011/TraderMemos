import type { PnlMode, UnitMode } from "./ReportsDisplayContext";
import { SegmentedControl } from "./SegmentedControl";

export type ReportsSide = "all" | "long" | "short";
export type ReportsDuration = "all" | "scalp" | "day" | "swing";

export interface ReportsControlBarProps {
  side: ReportsSide;
  duration: ReportsDuration;
  onSideChange: (s: ReportsSide) => void;
  onDurationChange: (d: ReportsDuration) => void;
  pnlMode: PnlMode;
  unitMode: UnitMode;
  onPnlModeChange: (m: PnlMode) => void;
  onUnitModeChange: (m: UnitMode) => void;
  pctEnabled: boolean;
}

const SIDE_OPTS = [
  { value: "all", label: "All" },
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
];

const DURATION_OPTS = [
  { value: "all", label: "All" },
  { value: "scalp", label: "Scalp" },
  { value: "day", label: "Day" },
  { value: "swing", label: "Swing" },
];

const PNL_OPTS = [
  { value: "net", label: "Net" },
  { value: "gross", label: "Gross" },
];

const UNIT_OPTS = [
  { value: "abs", label: "$" },
  { value: "pct", label: "%" },
];

export function ReportsControlBar({
  side,
  duration,
  onSideChange,
  onDurationChange,
  pnlMode,
  unitMode,
  onPnlModeChange,
  onUnitModeChange,
  pctEnabled,
}: ReportsControlBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        ariaLabel="Side"
        size="xs"
        options={SIDE_OPTS}
        value={side}
        onChange={(v) => onSideChange(v as ReportsSide)}
      />
      <SegmentedControl
        ariaLabel="Duration"
        size="xs"
        options={DURATION_OPTS}
        value={duration}
        onChange={(v) => onDurationChange(v as ReportsDuration)}
      />
      <SegmentedControl
        ariaLabel="P&L basis"
        size="xs"
        options={PNL_OPTS}
        value={pnlMode}
        onChange={(v) => onPnlModeChange(v as PnlMode)}
      />
      <div title={pctEnabled ? undefined : "Set an account starting balance to view %"}>
        <SegmentedControl
          ariaLabel="Unit"
          size="xs"
          options={UNIT_OPTS}
          value={unitMode}
          onChange={(v) => onUnitModeChange(v as UnitMode)}
        />
      </div>
    </div>
  );
}
