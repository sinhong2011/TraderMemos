import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  hint?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function EmptyState({ title, hint, icon, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      {icon && (
        <div className="opacity-50" style={{ color: "var(--color-text-muted)" }}>
          {icon}
        </div>
      )}
      <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
        {title}
      </p>
      {hint && (
        <p className="max-w-sm text-xs" style={{ color: "var(--color-text-muted)" }}>
          {hint}
        </p>
      )}
      {actions ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
