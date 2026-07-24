import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface DonutSegment {
  value: number;
  color: string;
}

export interface DonutRingProps {
  segments: DonutSegment[];
  children?: ReactNode;
  className?: string;
  strokeWidth?: number;
}

/** Donut chart: chained stroke-dasharray arcs on a shared circle, hole content centered. */
export function DonutRing({ segments, children, className, strokeWidth = 12 }: DonutRingProps) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  let acc = 0;
  return (
    <div className={cn("relative w-full", className)}>
      <svg viewBox="0 0 100 100" className="w-full -rotate-90" role="presentation">
        <circle
          cx={50}
          cy={50}
          r={40}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
          pathLength={100}
        />
        {total > 0 &&
          segments.map((seg, i) => {
            const len = (Math.max(0, seg.value) / total) * 100;
            const offset = -acc;
            acc += len;
            if (len === 0) return null;
            return (
              <circle
                key={i}
                data-testid="donut-seg"
                cx={50}
                cy={50}
                r={40}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                pathLength={100}
                strokeDasharray={`${len} ${100 - len}`}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dasharray 300ms ease" }}
              />
            );
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
