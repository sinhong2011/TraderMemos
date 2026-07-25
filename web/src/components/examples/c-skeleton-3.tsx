import { Skeleton } from "@/components/ui/skeleton";

export function Pattern() {
  return (
    <div className="mx-auto w-full max-w-xs">
      {/* Skeleton pattern */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
}
