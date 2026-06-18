// Semantic P&L color by sign (direction A: green/red on dark, zinc for flat).
export function pnlColor(v: number | null | undefined): string {
	if (v == null || v === 0) return "text-zinc-400";
	return v > 0 ? "text-emerald-400" : "text-red-400";
}
