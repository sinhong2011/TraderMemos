import type { ReactNode } from "react";

interface ChartFrameProps {
	children: ReactNode;
	className?: string;
}

/**
 * Dark theme constants for Recharts - import these where you compose charts.
 * ChartFrame wraps children in a dark-themed container.
 */
export const chartTheme = {
	axisColor: "#8b93a7",
	gridColor: "#262e3d",
	tooltipBg: "#1e2430",
	tooltipBorder: "#262e3d",
	tooltipText: "#e6e9ef",
	cursorFill: "rgba(110, 168, 254, 0.08)",
} as const;

export function ChartFrame({ children, className = "" }: ChartFrameProps) {
	return (
		<div
			className={`w-full ${className}`}
			style={{
				background: "var(--color-surface-panel)",
				border: "1px solid var(--color-border)",
				borderRadius: "var(--radius-panel)",
				fontFamily: "var(--font-mono)",
			}}
		>
			{children}
		</div>
	);
}
