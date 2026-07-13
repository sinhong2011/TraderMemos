import { AlertCircle, AlertTriangle, Check, Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type SignalToastVariant = "default" | "success" | "error" | "warning" | "info";

const VARIANT_META: Record<SignalToastVariant, { icon: LucideIcon; accent: string; tint: string }> =
  {
    default: {
      icon: Info,
      accent: "text-text-dim",
      tint: "",
    },
    success: {
      icon: Check,
      accent: "text-profit",
      tint: "border-l-profit/80 bg-[var(--tint-pos)]",
    },
    error: {
      icon: AlertCircle,
      accent: "text-loss",
      tint: "border-l-loss/80 bg-[var(--tint-neg)]",
    },
    warning: {
      icon: AlertTriangle,
      accent: "text-signal",
      tint: "border-l-signal/80 bg-[var(--tint-amber)]",
    },
    info: {
      icon: Info,
      accent: "text-accent",
      tint: "border-l-accent/80 bg-accent-bg",
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
  if (/saved|created|deleted|removed|uploaded|added|complete|passed|finished/.test(text)) {
    return "success";
  }
  return "default";
}

export function toastRootClass(variant: SignalToastVariant): string {
  const { tint } = VARIANT_META[variant];
  return cn(
    "signal-toast pointer-events-auto flex min-w-[240px] max-w-[380px] items-start gap-2.5",
    "rounded-[var(--radius-overlay)] border border-border-strong bg-bg-panel p-3 shadow-hard",
    "border-l-[3px]",
    variant === "default" ? "border-l-border-strong" : tint,
  );
}

export function toastIconClass(variant: SignalToastVariant): string {
  return cn("mt-0.5 shrink-0", VARIANT_META[variant].accent);
}

export function toastIcon(variant: SignalToastVariant): LucideIcon {
  return VARIANT_META[variant].icon;
}

export function toastDescriptionClass(_variant: SignalToastVariant): string {
  return "text-[11px] leading-snug text-text-muted";
}
