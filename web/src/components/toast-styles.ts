import { AlertCircle, AlertTriangle, Check, Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type SignalToastVariant = "default" | "success" | "error" | "warning" | "info";

const VARIANT_META: Record<SignalToastVariant, { icon: LucideIcon; accent: string; well: string }> =
  {
    default: {
      icon: Info,
      accent: "text-text-muted",
      well: "bg-bg-input text-text-muted",
    },
    success: {
      icon: Check,
      accent: "text-profit",
      well: "bg-[var(--tint-pos)] text-profit",
    },
    error: {
      icon: AlertCircle,
      accent: "text-loss",
      well: "bg-[var(--tint-neg)] text-loss",
    },
    warning: {
      icon: AlertTriangle,
      accent: "text-signal",
      well: "bg-[var(--tint-signal)] text-signal",
    },
    info: {
      icon: Info,
      accent: "text-accent",
      well: "bg-accent-bg text-accent",
    },
  };

export function resolveToastVariant(
  type: string | undefined,
  title: ReactNode,
): SignalToastVariant {
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

/** Quiet panel toast — Signal Terminal: panel fill, no stripe / full-surface tint. */
export function toastRootClass(_variant: SignalToastVariant): string {
  return cn(
    "signal-toast pointer-events-auto flex min-w-[260px] max-w-[360px] items-start gap-3",
    "rounded-overlay border border-border bg-bg-panel p-3.5",
    "shadow-[0_12px_32px_rgba(18,18,24,0.55)] outline-none",
    "transition-[transform,opacity] duration-220 ease-out",
    "data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0",
    "data-[ending-style]:translate-y-1 data-[ending-style]:opacity-0",
    "data-[swipe-direction=right]:data-[ending-style]:translate-x-4",
    "motion-reduce:transition-none motion-reduce:data-[starting-style]:translate-y-0",
  );
}

export function toastIconWellClass(variant: SignalToastVariant): string {
  return cn(
    "flex size-8 shrink-0 items-center justify-center rounded-control",
    VARIANT_META[variant].well,
  );
}

export function toastIconClass(variant: SignalToastVariant): string {
  return VARIANT_META[variant].accent;
}

export function toastIcon(variant: SignalToastVariant): LucideIcon {
  return VARIANT_META[variant].icon;
}

export function toastDescriptionClass(_variant: SignalToastVariant): string {
  return "mt-1 text-[12px] leading-relaxed text-text-muted";
}
