interface StatCardProps {
  label: string;
  value: string;
  accent?: "pos" | "neg" | "none";
  hint?: string;
}

function accentColor(accent?: "pos" | "neg" | "none"): string {
  if (accent === "pos") return "var(--color-pos)";
  if (accent === "neg") return "var(--color-neg)";
  return "var(--color-text)";
}

export function StatCard({ label, value, accent, hint }: StatCardProps) {
  return (
    <div
      className="flex flex-col gap-1 px-4 py-3"
      style={{
        background: "var(--color-surface-panel)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-panel)",
      }}
    >
      <span
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-xl font-semibold leading-none"
        style={{
          fontFamily: "var(--font-mono)",
          color: accentColor(accent),
          transition: `color var(--duration-fast)`,
        }}
      >
        {value}
      </span>
      {hint && (
        <span
          className="text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
