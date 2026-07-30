import { Skeleton as UiSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

/** Compatibility wrapper — prefer `@/components/ui/skeleton` or `@/components/skeletons/*`. */
export function Skeleton({ className = "", width, height }: SkeletonProps) {
  return <UiSkeleton className={cn(className)} style={{ width, height }} aria-hidden="true" />;
}
