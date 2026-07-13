import { cn } from "../lib/cn";

export interface SegmentOption {
	value: string;
	label: string;
}

export function SegmentedControl({
	options,
	value,
	onChange,
	ariaLabel,
}: {
	options: SegmentOption[];
	value: string;
	onChange: (v: string) => void;
	ariaLabel?: string;
}) {
	return (
		<fieldset
			aria-label={ariaLabel}
			className="m-0 inline-flex gap-0.5 rounded-control border-none bg-bg-elevated p-0.5"
		>
			{options.map((o) => {
				const active = o.value === value;
				return (
					<button
						key={o.value}
						type="button"
						aria-pressed={active}
						onClick={() => onChange(o.value)}
						className={cn(
							"cursor-pointer rounded-control border-none px-2.5 py-0.5 text-[11px] font-semibold transition-colors duration-150",
							active
								? "bg-accent-bg text-accent"
								: "bg-transparent text-text-muted",
						)}
					>
						{o.label}
					</button>
				);
			})}
		</fieldset>
	);
}
