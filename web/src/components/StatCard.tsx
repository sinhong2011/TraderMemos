import { cn } from "../lib/cn";

interface StatCardProps {
  label: string;
  value: string;
  accent?: "pos" | "neg" | "none";
  hint?: string;
  /**
   * "panel" (default) is a self-contained bordered card, for use in loosely
   * spaced (gap-3+) grids. "bento" is an elevated, borderless cell (one rung
   * up the surface ladder from its typical parent Card) for use in
   * real-gap (gap-3) bento grids, where cells should read as distinct raised
   * compartments instead of blending into the parent panel behind them.
   */
  variant?: "panel" | "bento";
  /**
   * Value type scale. "md" (default) is the original 20px size used by every
   * StatCard outside the Statistics card's tiered layout — do not change its
   * output class, other call sites depend on it staying "text-xl". "lg" and
   * "sm" exist only for that tiered layout's Performance / Behavior & Costs
   * rows.
   */
  size?: "lg" | "md" | "sm";
  /**
   * Content alignment within the cell. "left" (default) preserves the
   * original layout used by every existing call site. "center" is only for
   * the Statistics card's tiered bento layout — do not change the default,
   * other call sites depend on left alignment.
   */
  align?: "left" | "center";
}

function accentColor(accent?: "pos" | "neg" | "none"): string {
  if (accent === "pos") return "var(--color-pos)";
  if (accent === "neg") return "var(--color-neg)";
  return "var(--color-text)";
}

function valueSizeClass(size: "lg" | "md" | "sm"): string {
  if (size === "lg") return "text-[26px]";
  if (size === "sm") return "text-[15px]";
  return "text-xl";
}

export function StatCard({
  label,
  value,
  accent,
  hint,
  variant = "panel",
  size = "md",
  align = "left",
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 px-4",
        size === "sm" ? "py-2" : "py-3",
        align === "center" && "items-center text-center",
      )}
      style={
        variant === "bento"
          ? {
              background: "var(--color-surface-bento)",
              borderRadius: "var(--radius-panel)",
            }
          : {
              background: "var(--color-surface-panel)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-panel)",
            }
      }
    >
      <span
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </span>
      <span
        className={cn(valueSizeClass(size), "font-semibold leading-none")}
        style={{
          color: accentColor(accent),
          transition: "color var(--duration-fast)",
        }}
      >
        {value}
      </span>
      {hint && (
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}
