import { Maximize2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CHART_RANGES, type ChartRange } from "@/lib/chartRange";
import { Card } from "./Card";
import { Modal } from "./Modal";
import { SegmentedControl } from "./SegmentedControl";

function modalChartHeight(): number {
  if (typeof globalThis.window === "undefined") return 480;
  return Math.min(Math.round(globalThis.window.innerHeight * 0.65), 560);
}

export interface ChartCardRenderProps {
  /** True inside the fullscreen dialog. */
  expanded: boolean;
  /** Chart height inside the dialog; undefined in the card body — keep the inline height. */
  height?: number;
}

export interface ChartCardProps {
  title: ReactNode;
  description?: string;
  /** Dialog title; required when `title` is not a plain string. */
  expandTitle?: string;
  /** Trailing range shown as pills; omit both range props for expand-only cards. */
  range?: ChartRange;
  onRangeChange?: (range: ChartRange) => void;
  /** Per-card controls (window size, granularity, …) rendered before the shared range/expand cluster. */
  controls?: ReactNode;
  children: (props: ChartCardRenderProps) => ReactNode;
  className?: string;
}

/**
 * Shared chrome for time-series report cards: every card carries the same two
 * top-right affordances — a trailing-range control and a fullscreen expand —
 * so learning one card teaches all of them. The render-prop child serves both
 * the card body and the expanded dialog.
 */
export function ChartCard({
  title,
  description,
  expandTitle,
  range,
  onRangeChange,
  controls,
  children,
  className,
}: ChartCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(480);

  useEffect(() => {
    if (!expanded) return;
    setExpandedHeight(modalChartHeight());
    function onResize() {
      setExpandedHeight(modalChartHeight());
    }
    globalThis.window.addEventListener("resize", onResize);
    return () => globalThis.window.removeEventListener("resize", onResize);
  }, [expanded]);

  const action = (
    // Side-by-side once there's room (sm+), stacked below that — matches the
    // Metric Evolution precedent so multi-control headers survive narrow cards.
    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
      {controls}
      <div className="flex items-center gap-1">
        {range != null && onRangeChange ? (
          <div className="max-w-full overflow-x-auto">
            <SegmentedControl
              ariaLabel="Chart range"
              value={range}
              onChange={(v) => onRangeChange(v as ChartRange)}
              options={CHART_RANGES}
            />
          </div>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          aria-label="Expand chart"
          onClick={() => setExpanded(true)}
        >
          <Maximize2 size={14} strokeWidth={1.5} aria-hidden />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Card title={title} description={description} action={action} className={className}>
        {children({ expanded: false })}
      </Card>
      <Modal
        open={expanded}
        onOpenChange={setExpanded}
        title={expandTitle ?? (typeof title === "string" ? title : "Chart")}
        className="z-[70] max-h-[min(92vh,920px)] max-w-[min(1100px,96vw)]"
        overlayClassName="z-[60]"
        bodyClassName="p-4"
      >
        {children({ expanded: true, height: expandedHeight })}
      </Modal>
    </>
  );
}
