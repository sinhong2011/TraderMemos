import { Minus, Plus } from "lucide-react";
import { signalLabelClass } from "../../signal-field-styles";
import { cn } from "../../../lib/cn";

export function CalcInputField({
	label,
	value,
	onValue,
	step = 1,
	min,
	prefix,
	suffix,
	hint,
	accent = "accent",
}: {
	label: string;
	value: number;
	onValue: (n: number) => void;
	step?: number;
	min?: number;
	prefix?: string;
	suffix?: string;
	hint?: string;
	accent?: "accent" | "profit" | "loss" | "signal";
}) {
	const accentRing =
		accent === "profit"
			? "focus-within:border-profit focus-within:shadow-[0_0_0_3px_rgba(74,222,128,0.15)]"
			: accent === "loss"
				? "focus-within:border-loss focus-within:shadow-[0_0_0_3px_rgba(251,113,133,0.15)]"
				: accent === "signal"
					? "focus-within:border-signal focus-within:shadow-[0_0_0_3px_rgba(228,255,26,0.1)]"
					: "focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--color-accent-bg)]";

	const bump = (delta: number) => {
		const next = Math.round((value + delta) * 1000) / 1000;
		if (min != null && next < min) return;
		onValue(next);
	};

	return (
		<div>
			<label className={signalLabelClass}>{label}</label>
			<div
				className={cn(
					"flex items-center rounded-control border border-border bg-bg-inset transition-[border-color,box-shadow] duration-150",
					accentRing,
				)}
			>
				<button
					type="button"
					aria-label="Decrease"
					onClick={() => bump(-step)}
					className="flex h-8 w-7 shrink-0 items-center justify-center text-text-dim transition-colors hover:text-text"
				>
					<Minus size={12} />
				</button>
				<div className="flex min-w-0 flex-1 items-center justify-center gap-0.5">
					{prefix ? (
						<span className="text-[11px] text-text-dim">{prefix}</span>
					) : null}
					<input
						type="text"
						inputMode="decimal"
						value={Number.isFinite(value) ? value : ""}
						onChange={(e) => {
							const n = Number.parseFloat(e.target.value);
							if (Number.isFinite(n)) onValue(n);
							else if (e.target.value === "") onValue(0);
						}}
						className="w-full min-w-0 bg-transparent py-1.5 text-center text-xs tabular-nums text-text outline-none"
					/>
					{suffix ? (
						<span className="text-[11px] text-text-dim">{suffix}</span>
					) : null}
				</div>
				<button
					type="button"
					aria-label="Increase"
					onClick={() => bump(step)}
					className="flex h-8 w-7 shrink-0 items-center justify-center text-text-dim transition-colors hover:text-text"
				>
					<Plus size={12} />
				</button>
			</div>
			{hint ? <p className="mt-1 text-[10px] text-text-dim">{hint}</p> : null}
		</div>
	);
}
