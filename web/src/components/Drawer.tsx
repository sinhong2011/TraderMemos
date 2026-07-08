import { Dialog } from "@base-ui-components/react";
import { Info, X } from "lucide-react";
import type { ReactNode } from "react";

export function Drawer({
	open,
	onOpenChange,
	title,
	footer,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	footer?: ReactNode;
	children: ReactNode;
}) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Backdrop
					style={{
						position: "fixed",
						inset: 0,
						background: "rgba(5, 8, 14, 0.6)",
						zIndex: 40,
					}}
				/>
				<Dialog.Popup
					style={{
						position: "fixed",
						top: 0,
						right: 0,
						bottom: 0,
						width: "min(680px, 94vw)",
						background: "var(--color-surface-panel)",
						borderLeft: "1px solid var(--color-border)",
						zIndex: 41,
						display: "flex",
						flexDirection: "column",
						outline: "none",
					}}
				>
					<div
						className="flex items-center justify-between px-5 py-4 shrink-0"
						style={{ borderBottom: "1px solid var(--color-border)" }}
					>
						<Dialog.Title
							style={{
								fontSize: 15,
								fontWeight: 600,
								color: "var(--color-text)",
								margin: 0,
							}}
						>
							{title}
						</Dialog.Title>
						<Dialog.Close
							aria-label="Close"
							style={{
								background: "none",
								border: "none",
								cursor: "pointer",
								color: "var(--color-text-muted)",
								padding: 4,
								display: "flex",
							}}
						>
							<X size={18} strokeWidth={1.5} />
						</Dialog.Close>
					</div>
					<div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
						{children}
					</div>
					{footer && (
						<div
							className="flex items-center justify-end gap-2 px-5 py-3 shrink-0"
							style={{ borderTop: "1px solid var(--color-border)" }}
						>
							{footer}
						</div>
					)}
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

export function DrawerBanner({ children }: { children: ReactNode }) {
	return (
		<div
			style={{
				display: "flex",
				gap: 10,
				padding: "12px 14px",
				background: "var(--tint-accent)",
				border: "1px solid var(--color-border)",
				borderRadius: "var(--radius-panel)",
				color: "var(--color-text)",
				fontSize: 12,
				lineHeight: 1.5,
			}}
		>
			<Info
				size={16}
				strokeWidth={1.5}
				style={{ color: "var(--color-accent)", flexShrink: 0, marginTop: 2 }}
			/>
			<div>{children}</div>
		</div>
	);
}
