import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { pnlColor } from "./theme-tokens";

export const chartTheme = {
  axisColor: "#94949f",
  gridColor: "rgba(255,255,255,0.06)",
  cursorFill: "rgba(167, 139, 250, 0.08)",
  accentStroke: "#a78bfa",
} as const;

/**
 * Shared recharts `<Tooltip>` styling — spread onto every chart tooltip.
 * Uses the popover tokens so text tracks light/dark: the label is the quiet
 * caption (`muted-foreground`) and the value carries the emphasis.
 */
export const chartTooltipStyle: {
  contentStyle: CSSProperties;
  labelStyle: CSSProperties;
  itemStyle: CSSProperties;
} = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.45)",
    padding: "6px 10px",
    fontSize: 11,
    color: "var(--popover-foreground)",
  },
  labelStyle: {
    color: "var(--muted-foreground)",
    fontSize: 10,
    fontWeight: 500,
    marginBottom: 2,
  },
  itemStyle: {
    color: "var(--popover-foreground)",
    fontWeight: 500,
    paddingTop: 0,
    paddingBottom: 0,
  },
};

/**
 * Sign-colored tooltip value for money / P&L series — same green/red/flat
 * treatment P&L gets everywhere else. Return it from a recharts `formatter`,
 * which accepts a `ReactNode` as the value.
 */
export function pnlTooltipValue(value: number, text: string) {
  return <span className={cn("tabular-nums", pnlColor(value))}>{text}</span>;
}

interface ChartFrameProps {
  children: ReactNode;
  className?: string;
  /** Inset well on void pages — uses bg-muted instead of bg-card */
  inset?: boolean;
}

export function ChartFrame({ children, className = "", inset = false }: ChartFrameProps) {
  return (
    <div
      className={cn(
        "flex w-full min-h-0 flex-col rounded-md border border-border",
        inset ? "bg-muted" : "bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}
