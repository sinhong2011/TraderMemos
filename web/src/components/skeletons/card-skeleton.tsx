import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

/** Chart / content card placeholder. */
export function CardSkeleton({
  className,
  mediaClassName = "h-[200px]",
}: {
  className?: string;
  mediaClassName?: string;
}) {
  return (
    <div className={cn("flex w-full flex-col gap-3 rounded-xl bg-bg-panel p-4", className)}>
      <Skeleton className="h-4 w-2/3 max-w-48" />
      <Skeleton className="h-3 w-1/2 max-w-32" />
      <Skeleton className={cn("w-full rounded-md", mediaClassName)} />
    </div>
  );
}

/** Grid of chart/content cards. */
export function CardGridSkeleton({
  count = 2,
  className,
  mediaClassName,
}: {
  count?: number;
  className?: string;
  mediaClassName?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} mediaClassName={mediaClassName} />
      ))}
    </div>
  );
}
