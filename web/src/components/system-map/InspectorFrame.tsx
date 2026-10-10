import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Draft-like right panel: sticky title, scroll body, optional footer actions. */
export function InspectorFrame({
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-card/95 shadow-lg/5 backdrop-blur-sm",
        className,
      )}
    >
      <header className="shrink-0 px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle ? <div className="mt-0.5 text-2xs text-muted-foreground">{subtitle}</div> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex flex-col gap-4">{children}</div>
      </div>
      {footer ? (
        <footer className="shrink-0 bg-background/40 px-4 py-3">
          <div className="flex flex-col gap-2">{footer}</div>
        </footer>
      ) : null}
    </section>
  );
}

export function InspectorSection({
  title,
  action,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}
