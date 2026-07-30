import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

/** Notes / coach copy / paragraph blocks. */
export function TextBlockSkeleton({
  lines = 5,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["w-full", "w-full", "w-3/4", "w-full", "w-5/6", "w-2/3"];
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", widths[i % widths.length])} />
      ))}
    </div>
  );
}
