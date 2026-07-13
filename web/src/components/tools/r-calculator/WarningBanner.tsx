import type { Warning } from "../../../lib/r-calculator/calc";
import { msg } from "../../../lib/r-calculator/messages";
import { cn } from "../../../lib/cn";

export function WarningBanner({ warns }: { warns: Warning[] }) {
	if (warns.length === 0) return null;

	const serious = warns.filter((w) => w.tone !== "ok");
	const notes = warns.filter((w) => w.tone === "ok");

	return (
		<div className="flex flex-col gap-1.5" role="status" aria-live="polite">
			{serious.map((w) => (
				<div
					key={w.key}
					className={cn(
						"rounded-control px-3 py-2 text-[11px] leading-relaxed",
						w.tone === "danger" && "bg-loss/10 text-loss",
						w.tone === "caution" && "bg-signal/5 text-signal",
					)}
				>
					{msg(w.key)}
				</div>
			))}
			{notes.map((w) => (
				<p key={w.key} className="m-0 text-[11px] text-text-dim">
					{msg(w.key)}
				</p>
			))}
		</div>
	);
}
