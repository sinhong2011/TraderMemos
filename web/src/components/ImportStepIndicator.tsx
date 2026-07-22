import { Check } from "lucide-react";
import { cn } from "../lib/cn";

const STEPS = [
  { step: 1 as const, label: "Upload" },
  { step: 2 as const, labelDefault: "Map columns", labelJournal: "Review" },
  { step: 3 as const, label: "Result" },
];

function stepLabel(item: (typeof STEPS)[number], format?: string): string {
  if (item.step === 2) {
    return format === "journal_trades" ? item.labelJournal : item.labelDefault;
  }
  return item.label;
}

export function ImportStepIndicator({ current, format }: { current: 1 | 2 | 3; format?: string }) {
  return (
    <nav aria-label="Import progress" className="mb-6">
      <ol className="flex w-full items-start rounded-sharp border border-border bg-bg px-3 py-4 sm:px-5">
        {STEPS.map((item, index) => {
          const isActive = item.step === current;
          const isDone = item.step < current;
          const label = stepLabel(item, format);

          return (
            <li
              key={item.step}
              className={cn(
                "flex min-w-0 items-start",
                index < STEPS.length - 1 ? "flex-1" : "shrink-0",
              )}
            >
              <div className="flex w-22 shrink-0 flex-col items-center gap-2 sm:w-24">
                <span
                  className={cn(
                    "relative flex size-7 items-center justify-center rounded-control border text-[11px] font-semibold tabular-nums",
                    "transition-[transform,background-color,border-color,box-shadow,color] duration-250 ease-out",
                    "motion-reduce:transition-none",
                    isActive &&
                      "scale-105 border-accent bg-accent-bg text-accent shadow-[0_0_0_1px_rgba(228,255,26,0.25),0_0_14px_rgba(228,255,26,0.12)]",
                    isDone && "border-accent/35 bg-accent/15 text-accent",
                    !isActive && !isDone && "border-border bg-bg-inset text-text-dim",
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isDone ? (
                    <Check
                      size={13}
                      strokeWidth={2.25}
                      className="opacity-100 transition-opacity duration-200 motion-reduce:transition-none"
                      aria-hidden
                    />
                  ) : (
                    item.step
                  )}
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-control ring-1 ring-accent/20 motion-reduce:hidden"
                    />
                  ) : null}
                </span>
                <span
                  className={cn(
                    "max-w-full truncate text-center text-[10px] uppercase tracking-widest",
                    "transition-colors duration-250 ease-out motion-reduce:transition-none",
                    isActive && "font-semibold text-text",
                    isDone && "text-accent/80",
                    !isActive && !isDone && "text-text-dim",
                  )}
                >
                  {label}
                </span>
              </div>

              {index < STEPS.length - 1 ? (
                <div aria-hidden className="mx-1 mt-3.5 flex min-w-6 flex-1 items-center sm:mx-2">
                  <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-border">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full bg-accent",
                        "transition-[width] duration-500 ease-out motion-reduce:transition-none",
                        isDone ? "w-full" : "w-0",
                      )}
                    />
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
