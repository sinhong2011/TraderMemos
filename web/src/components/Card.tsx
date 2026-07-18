import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface CardProps {
  title?: ReactNode;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Stretch in flex column page layouts */
  fill?: boolean;
  /** Omit body padding — for tables and flush lists */
  flush?: boolean;
}

export function Card({
  title,
  description,
  action,
  children,
  className,
  fill = false,
  flush = false,
}: CardProps) {
  const hasHeader = title != null || description != null || action != null;

  return (
    <section
      className={cn("flex flex-col rounded-card bg-bg-panel", fill && "min-h-0 flex-1", className)}
    >
      {hasHeader ? (
        <header className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            {title != null ? (
              typeof title === "string" ? (
                <h2 className="text-[10px] font-semibold tracking-wide text-signal">{title}</h2>
              ) : (
                title
              )
            ) : null}
            {description ? (
              <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div
        className={cn(
          fill && "flex min-h-0 flex-1 flex-col",
          !flush && (hasHeader ? "px-4 pb-4" : "p-4"),
        )}
      >
        {children}
      </div>
    </section>
  );
}
