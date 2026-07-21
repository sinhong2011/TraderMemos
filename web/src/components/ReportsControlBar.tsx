import { SegmentedControl } from "./SegmentedControl";

export type ReportsSide = "all" | "long" | "short";
export type ReportsDuration = "all" | "scalp" | "day" | "swing";

export interface ReportsControlBarProps {
  side: ReportsSide;
  duration: ReportsDuration;
  onSideChange: (s: ReportsSide) => void;
  onDurationChange: (d: ReportsDuration) => void;
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

export function ReportsControlBar({
  side,
  duration,
  onSideChange,
  onDurationChange,
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
    </div>
  );
}
