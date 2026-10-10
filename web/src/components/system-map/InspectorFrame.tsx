import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Right panel: sticky title, scroll body, optional footer actions. */
export function InspectorFrame({
  title,
  subtitle,
  icon,
  meta,
  children,
  footer,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Status chips under the title (clarity, progress). */
  meta?: ReactNode;
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
      <header className="flex shrink-0 items-start gap-3 px-4 pt-4 pb-3">
        {icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base leading-tight font-semibold text-foreground">
            {title}
          </h2>
          {subtitle ? <div className="mt-1 text-2xs text-muted-foreground">{subtitle}</div> : null}
          {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1 pb-5">
        <div className="flex flex-col gap-5">{children}</div>
      </div>
      {footer ? (
        <footer className="shrink-0 bg-muted/30 px-4 py-3">
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
    <section className="flex flex-col gap-2">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <h3 className="text-2xs font-semibold tracking-wide text-heading uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
