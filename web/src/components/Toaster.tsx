import { Toast as BaseToast } from "@base-ui/react";
import type { ReactNode } from "react";
import { ToastItem } from "./Toast";

function ToastList() {
  const { toasts } = BaseToast.useToastManager();
  return (
    <>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </>
  );
}

/**
 * Wrap the app shell in <Toaster> once; it provides the toast context and
 * renders the viewport. Use useToastManager() (re-exported from Toast.tsx)
 * inside any child to add toasts.
 */
export function Toaster({ children }: { children: ReactNode }) {
  return (
    <BaseToast.Provider>
      {children}
      <BaseToast.Viewport className="pointer-events-none fixed top-[max(1.5rem,env(safe-area-inset-top))] left-1/2 z-[9999] m-0 flex w-full max-w-[min(100%,24rem)] -translate-x-1/2 flex-col items-stretch gap-2 px-4">
        <ToastList />
      </BaseToast.Viewport>
    </BaseToast.Provider>
  );
}
