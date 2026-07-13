import type { ReactNode } from "react";

interface ToolbarProps {
  children: ReactNode;
  className?: string;
}

export function Toolbar({ children, className = "" }: ToolbarProps) {
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 ${className}`}
      style={{
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-surface-panel)",
      }}
    >
      {children}
    </div>
  );
}
