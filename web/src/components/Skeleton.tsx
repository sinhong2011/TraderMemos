interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ className = "", width, height }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer rounded-[var(--radius-control)] ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
