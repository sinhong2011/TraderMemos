import { cn } from "../lib/cn";

/** Colored win/loss record: green W, red L. */
export function WinLossRecord({
  wins,
  losses,
  className,
  separator = "",
}: {
  wins: number;
  losses: number;
  className?: string;
  /** Between W and L when both present — "" → `2W1L`, `" / "` → `2W / 1L`. */
  separator?: string;
}) {
  if (wins <= 0 && losses <= 0) {
    return <span className={cn("tabular-nums text-text-dim", className)}>-</span>;
  }

  return (
    <span className={cn("tabular-nums", className)}>
      {wins > 0 && <span className="text-profit">{wins}W</span>}
      {wins > 0 && losses > 0 && <span className="text-text-dim">{separator}</span>}
      {losses > 0 && <span className="text-loss">{losses}L</span>}
    </span>
  );
}
