import { Dialog } from "@base-ui-components/react";
import { Info, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export function Modal({
	open,
	onOpenChange,
	title,
	headerActions,
	footer,
	children,
	className,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	headerActions?: ReactNode;
	footer?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange} modal="trap-focus">
			<Dialog.Portal>
				<Dialog.Backdrop
					className="fixed inset-0 z-40 bg-[rgba(5,8,14,0.72)] backdrop-blur-[2px]"
				/>
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
					<Dialog.Popup
						className={cn(
							"pointer-events-auto flex max-h-[min(90vh,880px)] w-full max-w-[min(720px,94vw)] flex-col overflow-hidden",
							"border border-border-strong bg-bg-panel shadow-hard outline-none",
							"rounded-[var(--radius-overlay)]",
							className,
						)}
					>
						<div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
							<Dialog.Title className="m-0 text-[15px] font-semibold text-text">
								{title}
							</Dialog.Title>
							<div className="ml-auto flex items-center gap-2">
								{headerActions}
								<Dialog.Close
								aria-label="Close"
								className="flex cursor-pointer border-none bg-transparent p-1 text-text-muted transition-colors hover:text-text"
							>
								<X size={18} strokeWidth={1.5} />
							</Dialog.Close>
							</div>
						</div>
						<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-5">
							{children}
						</div>
						{footer && (
							<div className="flex w-full shrink-0 border-t border-border px-5 py-3">
								{footer}
							</div>
						)}
					</Dialog.Popup>
				</div>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

export function ModalBanner({ children }: { children: ReactNode }) {
	return (
		<div className="flex gap-2.5 rounded-panel border border-border bg-accent-bg px-3.5 py-3 text-xs leading-relaxed text-text">
			<Info
				size={16}
				strokeWidth={1.5}
				className="mt-0.5 shrink-0 text-accent"
				aria-hidden
			/>
			<div>{children}</div>
		</div>
	);
}
