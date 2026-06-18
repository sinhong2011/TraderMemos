import type { ReactNode } from "react";

interface EmptyStateProps {
	title: string;
	hint?: string;
	icon?: ReactNode;
}

export function EmptyState({ title, hint, icon }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-16 px-8 text-center">
			{icon && (
				<div
					style={{ color: "var(--color-text-muted)" }}
					className="opacity-50"
				>
					{icon}
				</div>
			)}
			<p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
				{title}
			</p>
			{hint && (
				<p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
					{hint}
				</p>
			)}
		</div>
	);
}
