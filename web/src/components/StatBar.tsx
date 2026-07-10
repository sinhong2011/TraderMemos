import { cn } from "../lib/cn";
import { PILL_TONES, type PillTone } from "./Pill";

export function StatBar({
	label,
	value,
	right,
	pct,
	tone,
	onClick,
	active,
}: {
	label: string;
	value: string;
	right?: string;
	pct: number;
	tone: PillTone;
	onClick?: () => void;
	active?: boolean;
}) {
	const color = PILL_TONES[tone].color;
	const clamped = Math.max(0, Math.min(1, pct));
	const inner = (
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

	if (!onClick) return inner;

	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={cn(
				"cursor-pointer rounded-control border border-transparent px-2 py-1.5 text-left",
				"transition-colors duration-150 hover:bg-bg-hover",
				active && "border-border-strong bg-bg-hover",
			)}
		>
			{inner}
		</button>
	);
}
