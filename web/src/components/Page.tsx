import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export function Page({
  children,
  className,
  fill = false,
}: {
  children: ReactNode;
  className?: string;
  /** Fill available main column height */
  fill?: boolean;
}) {
  return (
    <div
      className={cn("flex flex-col gap-4 bg-bg p-4 sm:p-6", fill && "min-h-full flex-1", className)}
    >
      {children}
    </div>
  );
}
