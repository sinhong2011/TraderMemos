import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * One label/value stat, as a bordered tile with a confident number — the same
 * treatment the home page gives its metrics, so a stat reads the same wherever
 * it appears. The `border-border` hairline (rather than a second `bg-card`
 * fill) is what separates it from the card underneath, which already carries
 * the elevation.
 */
export function StatCell({
  label,
  children,
  hint,
  className,
  valueClassName,
}: {
  label: string;
  children: ReactNode;
  /** Quiet trailing qualifier, e.g. the fee share or a contract multiplier. */
  hint?: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-between gap-2 rounded-lg border border-border px-3 py-2.5",
        className,
      )}
    >
      <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        {label}
      </span>
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span
          className={cn(
            "truncate text-[20px] leading-none font-semibold tracking-[-0.02em] tabular-nums text-foreground",
            valueClassName,
          )}
        >
          {children}
        </span>
        {hint ? (
          <span className="shrink-0 text-[11px] leading-none tabular-nums text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Section heading inside a card. Muted rather than the old amber — `chart-3` is
 * a data-viz token, and DESIGN.md keeps chrome quiet.
 */
export const cardSectionLabelClass =
  "m-0 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase";
