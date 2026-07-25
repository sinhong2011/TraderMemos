import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

/** Data-table body placeholder — Trades, session tables. */
export function TableSkeleton({
  rows = 6,
  columns = 3,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  const colWidths = ["flex-1", "w-24", "w-20", "w-16", "w-28"] as const;

  return (
    <div className={cn("flex w-full flex-col gap-3 p-4", className)} aria-hidden>
      <div className="flex gap-4 pb-1">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className={cn("h-4", colWidths[i] ?? "w-20")} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={`${r}-${c}`} className={cn("h-4", colWidths[c] ?? "w-20")} />
          ))}
        </div>
      ))}
    </div>
  );
}
