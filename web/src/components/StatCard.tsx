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
   * original layout used by every existing call site. "center" centers label
   * and value without forcing a square aspect ratio.
   */
  align?: "left" | "center";
}

function accentColor(accent?: "pos" | "neg" | "none"): string {
  if (accent === "pos") return "var(--color-pos)";
  if (accent === "neg") return "var(--color-neg)";
  return "var(--color-text)";
}

function valueSizeClass(size: "lg" | "md" | "sm", centered: boolean): string {
  if (centered) {
    if (size === "lg") return "text-[22px] sm:text-[24px]";
    if (size === "sm") return "text-[14px] sm:text-[15px]";
    return "text-[17px] sm:text-xl";
  }
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
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col",
        centered
          ? "w-full items-center gap-2 p-3 text-center"
          : cn("gap-1 px-4", size === "sm" ? "py-2" : "py-3"),
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
        className={cn(
          "text-[10px] font-medium tracking-wide uppercase sm:text-xs",
          centered ? "self-center" : undefined,
        )}
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </span>

      <span
        className={cn(
          valueSizeClass(size, centered),
          "font-semibold leading-none tabular-nums",
          centered && "max-w-full truncate",
        )}
        style={{
          color: accentColor(accent),
          transition: "color var(--duration-fast)",
        }}
      >
        {value}
      </span>
      {hint ? (
        <span
          className={cn("text-xs", centered && "line-clamp-2 max-w-full text-[10px] leading-snug")}
          style={{ color: "var(--color-text-muted)" }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}
