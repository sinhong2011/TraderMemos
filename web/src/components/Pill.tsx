import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type PillTone = "pos" | "neg" | "accent" | "amber" | "muted";

const TONES: Record<PillTone, string> = {
  pos: "text-profit bg-tint-pos",
  neg: "text-loss bg-tint-neg",
  accent: "text-accent bg-tint-accent",
  amber: "text-signal bg-tint-signal",
  muted: "text-text-muted bg-bg-elevated",
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
        "inline-flex items-center gap-1 whitespace-nowrap rounded-control px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.02em]",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
