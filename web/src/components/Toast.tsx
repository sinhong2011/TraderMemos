import { Toast as BaseToast } from "@base-ui-components/react";
import { X } from "lucide-react";

type ToastObject = BaseToast.Root.ToastObject;

/**
 * A single toast entry rendered inside Toaster.
 */
export function ToastItem({ toast }: { toast: ToastObject }) {
  return (
    <BaseToast.Root
      toast={toast}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "10px 12px",
        background: "var(--color-surface-panel)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-panel)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        minWidth: "240px",
        maxWidth: "380px",
        fontFamily: "var(--font-ui)",
      }}
    >
      <BaseToast.Content style={{ flex: 1 }}>
        <BaseToast.Title
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--color-text)",
            marginBottom: "2px",
          }}
        />
        <BaseToast.Description
          style={{
            fontSize: "12px",
            color: "var(--color-text-muted)",
          }}
        />
      </BaseToast.Content>
      <BaseToast.Close
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-text-muted)",
          padding: "2px",
          display: "flex",
          alignItems: "center",
        }}
        aria-label="Dismiss"
      >
        <X size={14} strokeWidth={1.5} />
      </BaseToast.Close>
    </BaseToast.Root>
  );
}

// Re-export useToastManager for convenience
export const useToastManager = BaseToast.useToastManager;
