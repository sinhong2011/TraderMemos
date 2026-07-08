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
		<div
			role="group"
			aria-label={ariaLabel}
			style={{
				display: "inline-flex",
				gap: 2,
				padding: 2,
				background: "var(--color-surface-raised)",
				borderRadius: "var(--radius-control)",
			}}
		>
			{options.map((o) => {
				const active = o.value === value;
				return (
					<button
						key={o.value}
						type="button"
						aria-pressed={active}
						onClick={() => onChange(o.value)}
						style={{
							padding: "3px 10px",
							fontSize: 11,
							fontWeight: 600,
							border: "none",
							borderRadius: 6,
							cursor: "pointer",
							color: active ? "var(--color-accent)" : "var(--color-text-muted)",
							background: active ? "var(--tint-accent)" : "transparent",
							transition: "color var(--duration-fast)",
						}}
					>
						{o.label}
					</button>
				);
			})}
		</div>
	);
}
