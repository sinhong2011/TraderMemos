import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PanelProps {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  /** void = full-bleed page surface (bg-background); panel = elevated card (default) */
  surface?: "void" | "panel";
}

export function Panel({ title, right, children, className = "", surface = "panel" }: PanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col",
        surface === "panel" && "rounded-md border border-border bg-card",
        surface === "void" && "bg-background",
        className,
      )}
    >
      {(title || right) && (
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          {title && <span className="text-label font-semibold text-muted-foreground">{title}</span>}
          {right && <div className="ml-auto">{right}</div>}
        </div>
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
}
