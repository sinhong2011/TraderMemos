/** Calendar heatmap wash — TradeZella-style teal/rose with magnitude levels. */
const PROFIT_WASH = "rgb(82, 202, 150)";
const LOSS_WASH = "rgb(235, 75, 104)";

/**
 * Soft P&L cell wash with multi-level opacity from magnitude.
 * Reference curve: ~$3→0.09, ~$12→0.11, ~$120→0.33, ~$234→0.40.
 */
export function pnlBgTint(
  pnl: number,
  {
    minOpacity = 0.08,
    maxOpacity = 0.4,
    /** Dollars at which opacity reaches max (reference ≈ 0.08 + |pnl|/500). */
    scale = 500,
  }: { minOpacity?: number; maxOpacity?: number; scale?: number } = {},
): string {
  if (pnl === 0) return "transparent";
  const opacity = Math.min(maxOpacity, minOpacity + Math.abs(pnl) / scale);
  const pct = Math.round(opacity * 100);
  if (pnl > 0) return `color-mix(in srgb, ${PROFIT_WASH} ${pct}%, transparent)`;
  return `color-mix(in srgb, ${LOSS_WASH} ${pct}%, transparent)`;
}

// Semantic P&L color by sign (green/red on dark, flat for zero).
export function pnlColor(v: number | null | undefined): string {
  if (v == null || v === 0) return "text-flat";
  return v > 0 ? "text-profit" : "text-destructive";
}

export function heroPnlClass(v: number | null | undefined): string {
  const base = "text-[32px] font-semibold leading-none tracking-[-0.03em]";
  if (v == null || v === 0) return `${base} text-flat`;
  return v > 0 ? `${base} text-profit` : `${base} text-destructive`;
}

const BENTO_TONE: Record<string, string> = {
  pos: "text-profit",
  neg: "text-destructive",
  accent: "text-primary",
  amber: "text-chart-3",
};

export function bentoToneClass(tone?: "pos" | "neg" | "accent" | "amber"): string {
  return tone ? (BENTO_TONE[tone] ?? "text-foreground") : "text-foreground";
}
