import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

/** Settings / form sections while data loads. */
export function FormSkeleton({ fields = 3, className }: { fields?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-6", className)} aria-hidden>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-28" />
    </div>
  );
}
