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
      <BaseToast.Viewport className="pointer-events-none fixed bottom-6 right-6 z-[9999] m-0 flex flex-col gap-2 p-0">
        <ToastList />
      </BaseToast.Viewport>
    </BaseToast.Provider>
  );
}
