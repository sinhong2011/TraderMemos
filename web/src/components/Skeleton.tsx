import { cn } from "../lib/cn";

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ className = "", width, height }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-control", className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
