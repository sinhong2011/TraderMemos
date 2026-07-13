import { Toast as BaseToast } from "@base-ui-components/react";
import { X } from "lucide-react";
import {
  resolveToastVariant,
  toastDescriptionClass,
  toastIcon,
  toastIconClass,
  toastRootClass,
} from "./toast-styles";

type ToastObject = BaseToast.Root.ToastObject;

/**
 * A single toast entry rendered inside Toaster.
 */
export function ToastItem({ toast }: { toast: ToastObject }) {
  const variant = resolveToastVariant(toast.type, toast.title);
  const Icon = toastIcon(variant);

  return (
    <BaseToast.Root toast={toast} className={toastRootClass(variant)}>
      <Icon size={15} strokeWidth={1.5} className={toastIconClass(variant)} aria-hidden />
      <BaseToast.Content className="min-w-0 flex-1">
        <BaseToast.Title className="text-[13px] font-semibold leading-snug text-text">
          {toast.title}
        </BaseToast.Title>
        {toast.description ? (
          <BaseToast.Description className={toastDescriptionClass(variant)}>
            {toast.description}
          </BaseToast.Description>
        ) : null}
      </BaseToast.Content>
      <BaseToast.Close
        className="flex shrink-0 cursor-pointer items-center rounded-sharp border-none bg-transparent p-0.5 text-text-muted transition-colors duration-150 hover:bg-bg-hover hover:text-text"
        aria-label="Dismiss"
      >
        <X size={14} strokeWidth={1.5} />
      </BaseToast.Close>
    </BaseToast.Root>
  );
}

export const useToastManager = BaseToast.useToastManager;
