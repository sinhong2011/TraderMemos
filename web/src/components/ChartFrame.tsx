import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const chartTheme = {
	axisColor: "#52525b",
	gridColor: "rgba(255,255,255,0.06)",
	tooltipBg: "#16161a",
	tooltipBorder: "rgba(255,255,255,0.14)",
	tooltipText: "#fafafa",
	cursorFill: "rgba(167, 139, 250, 0.08)",
	accentStroke: "#a78bfa",
} as const;

interface ChartFrameProps {
	children: ReactNode;
	className?: string;
	/** Inset well on void pages — uses bg-bg-inset instead of bg-bg-panel */
	inset?: boolean;
}

export function ChartFrame({
	children,
	className = "",
	inset = false,
}: ChartFrameProps) {
	return (
		<div
			className={cn(
				"w-full rounded-sharp border border-border",
				inset ? "bg-bg-inset" : "bg-bg-panel",
				className,
			)}
		>
			{children}
		</div>
	);
}
