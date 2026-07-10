import type { ReactNode } from "react";
import { cn } from "../lib/cn";

interface PanelProps {
	title?: string;
	right?: ReactNode;
	children: ReactNode;
	className?: string;
}

export function Panel({ title, right, children, className = "" }: PanelProps) {
	return (
		<div
			className={cn(
				"flex flex-col rounded-sharp border border-border bg-bg-panel",
				className,
			)}
		>
			{(title || right) && (
				<div className="flex items-center justify-between border-b border-border px-4 py-2">
					{title && (
						<span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
							{title}
						</span>
					)}
					{right && <div className="ml-auto">{right}</div>}
				</div>
			)}
			<div className="flex-1">{children}</div>
		</div>
	);
}
