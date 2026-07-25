import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PillTone = "pos" | "neg" | "accent" | "amber" | "muted";

const TONES: Record<PillTone, string> = {
  pos: "text-profit bg-profit/10",
  neg: "text-destructive bg-destructive/10",
  accent: "text-primary bg-primary/10",
  amber: "text-chart-3 bg-chart-3/10",
  muted: "text-muted-foreground bg-sidebar",
};

export function Pill({
  tone = "muted",
  children,
  title,
}: {
  tone?: PillTone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.02em]",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
