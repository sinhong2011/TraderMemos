// Semantic P&L color by sign (direction A: green/red on dark, zinc for flat).
export function pnlColor(v: number | null | undefined): string {
	if (v == null || v === 0) return "text-zinc-400";
	return v > 0 ? "text-emerald-400" : "text-red-400";
}

export function heroPnlClass(v: number | null | undefined): string {
	const base =
		"font-mono text-[32px] font-semibold leading-none tracking-[-0.03em]";
	if (v == null || v === 0) return `${base} text-flat`;
	return v > 0
		? `${base} text-profit hero-glow-profit`
		: `${base} text-loss hero-glow-loss`;
}

const BENTO_TONE: Record<string, string> = {
	pos: "text-profit",
	neg: "text-loss",
	accent: "text-accent",
	amber: "text-signal",
};

export function bentoToneClass(
	tone?: "pos" | "neg" | "accent" | "amber",
): string {
	return tone ? (BENTO_TONE[tone] ?? "text-text") : "text-text";
}
