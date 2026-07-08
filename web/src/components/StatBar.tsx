import { PILL_TONES, type PillTone } from "./Pill";

export function StatBar({
	label,
	value,
	right,
	pct,
	tone,
}: {
	label: string;
	value: string;
	right?: string;
	pct: number;
	tone: PillTone;
}) {
	const color = PILL_TONES[tone].color;
	const clamped = Math.max(0, Math.min(1, pct));
	return (
		<div className="flex flex-col gap-1" style={{ minWidth: 110 }}>
			<div className="flex items-baseline justify-between gap-3">
				<span
					className="text-[11px] font-semibold uppercase tracking-wide"
					style={{ color }}
				>
					{label}: <span style={{ color: "var(--color-text)" }}>{value}</span>
				</span>
				{right && (
					<span
						className="text-[11px] tabular-nums"
						style={{ color: "var(--color-text-muted)" }}
					>
						{right}
					</span>
				)}
			</div>
			<div
				style={{
					height: 3,
					borderRadius: 2,
					background: "var(--color-surface-raised)",
				}}
			>
				<div
					data-testid="statbar-fill"
					style={{
						width: `${clamped * 100}%`,
						height: "100%",
						borderRadius: 2,
						background: color,
					}}
				/>
			</div>
		</div>
	);
}
