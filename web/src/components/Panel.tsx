import type { ReactNode } from "react";
import { cn } from "../lib/cn";

interface PanelProps {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  /** void = full-bleed page surface (bg-bg); panel = elevated card (default) */
  surface?: "void" | "panel";
}

export function Panel({ title, right, children, className = "", surface = "panel" }: PanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col",
        surface === "panel" && "rounded-sharp border border-border bg-bg-panel",
        surface === "void" && "bg-bg",
        className,
      )}
    >
      {(title || right) && (
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          {title && <span className="text-label font-semibold text-text-muted">{title}</span>}
          {right && <div className="ml-auto">{right}</div>}
        </div>
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
}
