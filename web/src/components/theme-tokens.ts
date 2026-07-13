// Semantic P&L color by sign (green/red on dark, flat for zero).
export function pnlColor(v: number | null | undefined): string {
  if (v == null || v === 0) return "text-flat";
  return v > 0 ? "text-profit" : "text-loss";
}

export function heroPnlClass(v: number | null | undefined): string {
  const base = "text-[32px] font-semibold leading-none tracking-[-0.03em]";
  if (v == null || v === 0) return `${base} text-flat`;
  return v > 0 ? `${base} text-profit` : `${base} text-loss`;
}

const BENTO_TONE: Record<string, string> = {
  pos: "text-profit",
  neg: "text-loss",
  accent: "text-accent",
  amber: "text-signal",
};

export function bentoToneClass(tone?: "pos" | "neg" | "accent" | "amber"): string {
  return tone ? (BENTO_TONE[tone] ?? "text-text") : "text-text";
}
