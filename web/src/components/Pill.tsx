import type { ReactNode } from "react";

export type PillTone = "pos" | "neg" | "accent" | "amber" | "muted";

const TONES: Record<PillTone, { color: string; bg: string }> = {
	pos: { color: "var(--color-pos)", bg: "var(--tint-pos)" },
	neg: { color: "var(--color-neg)", bg: "var(--tint-neg)" },
	accent: { color: "var(--color-accent)", bg: "var(--tint-accent)" },
	amber: { color: "var(--color-amber)", bg: "var(--tint-amber)" },
	muted: {
		color: "var(--color-text-muted)",
		bg: "var(--color-surface-raised)",
	},
};

export function Pill({
	tone = "muted",
	children,
	title,
}: {
	tone?: PillTone;
	children: ReactNode;
	title?: string;
}) {
	const t = TONES[tone];
	return (
		<span
			title={title}
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 4,
				padding: "3px 10px",
				borderRadius: 999,
				fontSize: 11,
				fontWeight: 600,
				letterSpacing: "0.02em",
				color: t.color,
				background: t.bg,
				whiteSpace: "nowrap",
			}}
		>
			{children}
		</span>
	);
}

export const PILL_TONES = TONES;
