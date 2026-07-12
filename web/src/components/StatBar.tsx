import { cn } from "../lib/cn";
import type { PillTone } from "./Pill";

const TONE_VALUE: Record<PillTone, string> = {
	pos: "text-profit",
	neg: "text-loss",
	accent: "text-accent",
	amber: "text-signal",
	muted: "text-text",
};

export function StatBar({
	label,
	value,
	sub,
	tone = "muted",
	onClick,
	active,
}: {
	label: string;
	value: string;
	sub?: string;
	tone?: PillTone;
	onClick?: () => void;
	active?: boolean;
}) {
	const inner = (
		<>
			<span className="text-[10px] font-medium uppercase tracking-widest text-text-dim">
				{label}
			</span>
			<div className="mt-1 flex items-baseline gap-2">
				<span
					className={cn(
						"text-[15px] font-semibold leading-none tabular-nums",
						TONE_VALUE[tone],
					)}
				>
					{value}
				</span>
				{sub ? (
					<span className="text-[11px] tabular-nums text-text-dim">
						{sub}
					</span>
				) : null}
			</div>
		</>
	);

	const shellClass = cn(
		"flex w-full flex-col justify-center px-4 py-3",
		onClick && "transition-colors duration-150 hover:bg-bg-hover",
		active && "bg-accent-bg",
	);

	if (!onClick) {
		return <div className={shellClass}>{inner}</div>;
	}

	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={cn(
				shellClass,
				"relative cursor-pointer border-none bg-transparent text-left outline-none",
				"focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
				active &&
					"after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent after:shadow-[0_0_8px_var(--color-accent-glow)]",
			)}
		>
			{inner}
		</button>
	);
}
