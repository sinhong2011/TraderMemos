import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

/** Playbook / notes side lists with optional trailing action. */
export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col", className)} aria-hidden>
      <div className="flex items-center justify-between pb-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}
