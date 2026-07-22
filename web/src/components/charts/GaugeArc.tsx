import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface GaugeArcProps {
  value: number;
  children?: ReactNode;
  className?: string;
  gradientId?: string;
}

// Semicircle path from left (6,50) to right (94,50), radius 44, opening upward.
const ARC_PATH = "M 6 50 A 44 44 0 0 1 94 50";

/** Arc-fill gauge: a 180° track that fills left→right to `value` (0..1). */
export function GaugeArc({ value, children, className, gradientId = "gauge-grad" }: GaugeArcProps) {
  const v = Math.max(0, Math.min(1, value));
  const dashOffset = 100 * (1 - v);
  return (
    <div className={cn("relative w-full", className)}>
      <svg viewBox="0 0 100 54" className="w-full" role="presentation">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-loss)" />
            <stop offset="50%" stopColor="var(--color-signal)" />
            <stop offset="100%" stopColor="var(--color-profit)" />
          </linearGradient>
        </defs>
        <path
          d={ARC_PATH}
          fill="none"
          stroke="var(--color-bg-inset)"
          strokeWidth={8}
          strokeLinecap="round"
          pathLength={100}
        />
        <path
          data-testid="gauge-fill"
          d={ARC_PATH}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={8}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 300ms ease" }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 top-1/2 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
