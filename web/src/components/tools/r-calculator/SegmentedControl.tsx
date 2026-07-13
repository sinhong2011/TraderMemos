import { cn } from "../../../lib/cn";

export interface Segment<T extends string> {
	value: T;
	label: string;
	/** Short inline hint — same row, not stacked */
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
	return (
		<div
			role="tablist"
			aria-label={ariaLabel}
			className={cn(
				"flex w-full gap-0.5 rounded-control p-0.5",
				subtle ? "bg-bg-inset" : "bg-bg-elevated",
			)}
		>
			{segments.map((seg) => {
				const active = seg.value === value;
				const accentClass =
					seg.accent === "profit"
						? active
							? "bg-profit/10 text-profit"
							: "text-text-muted hover:text-profit/80"
						: seg.accent === "loss"
							? active
								? "bg-loss/10 text-loss"
								: "text-text-muted hover:text-loss/80"
							: seg.accent === "signal"
								? active
									? "bg-signal/10 text-signal"
									: "text-text-muted hover:text-text"
								: active
									? "bg-accent-bg text-accent"
									: "text-text-muted hover:text-text";

				return (
					<button
						key={seg.value}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(seg.value)}
						className={cn(
							"relative z-[1] flex min-h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-[5px] px-2.5 py-1 transition-colors duration-150",
							accentClass,
						)}
					>
						{seg.glyph ? (
							<span className="text-[9px] leading-none">{seg.glyph}</span>
						) : null}
						<span className="truncate text-[11px] font-semibold leading-none">
							{seg.label}
						</span>
						{seg.sub ? (
							<span
								className={cn(
									"hidden truncate text-[10px] font-medium leading-none sm:inline",
									active ? "opacity-70" : "text-text-dim",
								)}
							>
								{seg.sub}
							</span>
						) : null}
					</button>
				);
			})}
		</div>
	);
}
