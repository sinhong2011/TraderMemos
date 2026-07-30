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
        borderBottom: "1px solid var(--border)",
        background: "var(--card)",
      }}
    >
      {children}
    </div>
  );
}
