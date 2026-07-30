import { AlertCircle, AlertTriangle, Check, Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

const VARIANT_META: Record<ToastVariant, { icon: LucideIcon; accent: string; well: string }> = {
  default: {
    icon: Info,
    accent: "text-muted-foreground",
    well: "bg-muted text-muted-foreground",
  },
  success: {
    icon: Check,
    accent: "text-profit",
    well: "bg-[color-mix(in oklch, var(--profit) 12%, transparent)] text-profit",
  },
  error: {
    icon: AlertCircle,
    accent: "text-destructive",
    well: "bg-[color-mix(in oklch, var(--loss) 12%, transparent)] text-destructive",
  },
  warning: {
    icon: AlertTriangle,
    well: "bg-warning/10 text-warning",
    accent: "text-warning",
  },
  info: {
    icon: Info,
    accent: "text-primary",
    well: "bg-primary/10 text-primary",
  },
};

export function resolveToastVariant(type: string | undefined, title: ReactNode): ToastVariant {
  if (
    type === "success" ||
    type === "error" ||
    type === "warning" ||
    type === "info" ||
    type === "default"
  ) {
    return type;
  }

  const text = String(title ?? "").toLowerCase();
  if (/could not|failed|invalid|expired|issues found|upload failed|not remove/.test(text)) {
    return "error";
  }
  if (/with errors/.test(text)) return "warning";
  if (/coming soon/.test(text)) return "info";
  if (
    /saved|created|deleted|removed|uploaded|added|complete|passed|finished|scanned|prefilled/.test(
      text,
    )
  ) {
    return "success";
  }
  return "default";
}

/** Quiet panel toast — shadcn: panel fill, no stripe / full-surface tint. */
export function toastRootClass(_variant: ToastVariant): string {
  return cn(
    "toast-panel pointer-events-auto flex min-w-[260px] max-w-[360px] items-start gap-3",
    "rounded-lg border border-border bg-card p-3.5",
    "shadow-md outline-none",
    "transition-[transform,opacity] duration-220 ease-out",
    "data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0",
    "data-[ending-style]:translate-y-1 data-[ending-style]:opacity-0",
    "data-[swipe-direction=right]:data-[ending-style]:translate-x-4",
    "motion-reduce:transition-none motion-reduce:data-[starting-style]:translate-y-0",
  );
}

export function toastIconWellClass(variant: ToastVariant): string {
  return cn(
    "flex size-8 shrink-0 items-center justify-center rounded-md",
    VARIANT_META[variant].well,
  );
}

export function toastIconClass(variant: ToastVariant): string {
  return VARIANT_META[variant].accent;
}

export function toastIcon(variant: ToastVariant): LucideIcon {
  return VARIANT_META[variant].icon;
}

export function toastDescriptionClass(_variant: ToastVariant): string {
  return "mt-1 text-[12px] leading-relaxed text-muted-foreground";
}
