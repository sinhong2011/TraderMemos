import { Info, X } from "lucide-react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";

/** Convenience wrapper over the composable Dialog parts for the common titled-modal case. */
export function Modal({
  open,
  onOpenChange,
  title,
  headerActions,
  footer,
  children,
  className,
  overlayClassName,
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal>
      <DialogContent
        className={className}
        overlayClassName={overlayClassName}
        showCloseButton={false}
      >
        <DialogHeader className="relative">
          <DialogTitle className="pointer-events-none absolute inset-x-0 text-center">
            {title}
          </DialogTitle>
          <div className="relative z-[1] ml-auto flex items-center gap-2">
            {headerActions}
            <DialogClose
              aria-label="Close"
              className="flex cursor-pointer border-none bg-transparent p-1 text-text-muted transition-colors hover:text-text"
            >
              <X size={18} strokeWidth={1.5} />
            </DialogClose>
          </div>
        </DialogHeader>
        <DialogBody className={bodyClassName}>{children}</DialogBody>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export function ModalBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-control border border-border bg-accent-bg px-3.5 py-3 text-xs leading-relaxed text-text">
      <Info size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-accent" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
