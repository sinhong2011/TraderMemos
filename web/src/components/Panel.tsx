import type { ReactNode } from "react";

interface PanelProps {
	title?: string;
	right?: ReactNode;
	children: ReactNode;
	className?: string;
}

export function Panel({ title, right, children, className = "" }: PanelProps) {
	return (
		<div
			className={`flex flex-col ${className}`}
			style={{
				background: "var(--color-surface-panel)",
				border: "1px solid var(--color-border)",
				borderRadius: "var(--radius-panel)",
			}}
		>
			{(title || right) && (
				<div
					className="flex items-center justify-between px-4 py-2"
					style={{
						borderBottom: "1px solid var(--color-border)",
					}}
				>
					{title && (
						<span
							className="text-xs font-semibold uppercase tracking-wide"
							style={{ color: "var(--color-text-muted)" }}
						>
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
