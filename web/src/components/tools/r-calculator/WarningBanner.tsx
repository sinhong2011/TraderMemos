import type { Warning } from "../../../lib/r-calculator/calc";
import { msg } from "../../../lib/r-calculator/messages";
import { cn } from "../../../lib/cn";

export function WarningBanner({ warns }: { warns: Warning[] }) {
	if (warns.length === 0) return null;

	return (
		<div className="flex flex-col gap-1.5" role="status" aria-live="polite">
			{warns.map((w) => (
				<div
					key={w.key}
					className={cn(
						"rounded-control px-3 py-2 text-[11px] leading-relaxed",
						w.tone === "danger" && "bg-loss/10 text-loss",
						w.tone === "caution" && "bg-signal/5 text-signal",
						w.tone === "ok" && "bg-profit/10 text-profit",
					)}
				>
					{msg(w.key)}
				</div>
			))}
		</div>
	);
}
