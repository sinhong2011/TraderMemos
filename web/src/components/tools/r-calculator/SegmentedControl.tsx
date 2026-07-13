import { cn } from "../../../lib/cn";

export interface Segment<T extends string> {
	value: T;
	label: string;
	sub?: string;
	glyph?: string;
	accent?: "profit" | "loss" | "signal" | "accent";
}

export function SegmentedControl<T extends string>({
	value,
	onChange,
	segments,
	ariaLabel,
	subtle = false,
}: {
	value: T;
	onChange: (v: T) => void;
	segments: Segment<T>[];
	ariaLabel: string;
	subtle?: boolean;
}) {
	const idx = segments.findIndex((s) => s.value === value);

	return (
		<div
			role="tablist"
			aria-label={ariaLabel}
			className={cn(
				"relative grid rounded-control p-0.5",
				subtle ? "bg-bg-inset" : "bg-bg-hover",
			)}
			style={{ gridTemplateColumns: `repeat(${segments.length}, 1fr)` }}
		>
			<div
				className="pointer-events-none absolute inset-y-0.5 rounded-[5px] bg-bg-panel shadow-sm transition-transform duration-200 ease-out"
				style={{
					width: `calc((100% - 4px) / ${segments.length})`,
					transform: `translateX(calc(${idx} * 100%))`,
				}}
			/>
			{segments.map((seg) => {
				const active = seg.value === value;
				const accentClass =
					seg.accent === "profit"
						? "text-profit"
						: seg.accent === "loss"
							? "text-loss"
							: seg.accent === "signal"
								? "text-signal"
								: active
									? "text-text"
									: "text-text-muted";
				return (
					<button
						key={seg.value}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(seg.value)}
						className={cn(
							"relative z-[1] flex flex-col items-center gap-0 rounded-[5px] px-2 py-1.5 transition-colors duration-150",
							active ? accentClass : "text-text-dim hover:text-text-muted",
						)}
					>
						<span className="flex items-center gap-1 text-[11px] font-semibold">
							{seg.glyph ? (
								<span className="text-[9px]">{seg.glyph}</span>
							) : null}
							{seg.label}
						</span>
						{seg.sub ? (
							<span className="text-[8px] font-medium uppercase tracking-widest opacity-60">
								{seg.sub}
							</span>
						) : null}
					</button>
				);
			})}
		</div>
	);
}
