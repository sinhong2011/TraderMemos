import type { ReactNode } from "react";
import { cn } from "../lib/cn";

interface ChartFrameProps {
	children: ReactNode;
	className?: string;
}

export const chartTheme = {
	axisColor: "#52525b",
	gridColor: "rgba(255,255,255,0.06)",
	tooltipBg: "#16161a",
	tooltipBorder: "rgba(255,255,255,0.14)",
	tooltipText: "#fafafa",
	cursorFill: "rgba(167, 139, 250, 0.08)",
	accentStroke: "#a78bfa",
} as const;

export function ChartFrame({ children, className = "" }: ChartFrameProps) {
	return (
		<div
			className={cn(
				"w-full rounded-sharp border border-border bg-bg-panel font-mono",
				className,
			)}
		>
			{children}
		</div>
	);
}
