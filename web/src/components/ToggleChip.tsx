import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ToggleChipTone = "accent" | "neg";

const SELECTED: Record<ToggleChipTone, string> = {
  accent: "border-primary/45 bg-primary/12 text-primary hover:bg-primary/16",
  neg: "border-destructive/45 bg-destructive/12 text-destructive hover:bg-destructive/16",
};

/**
 * Chip-shaped toggle for journal taxonomies (setups, session, emotion, tags).
 * Selection is carried by fill, border, and a leading check so the on/off state
 * survives at a glance — `Pill` alone is a static badge with no pressed state.
 */
export function ToggleChip({
  selected,
  onToggle,
  tone = "accent",
  disabled,
  title,
  children,
}: {
  selected: boolean;
  onToggle: () => void;
  tone?: ToggleChipTone;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      title={title}
      onClick={onToggle}
      className={cn(
        "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border px-2.5",
        "text-[11px] font-semibold tracking-[0.02em] outline-none",
        "transition-colors duration-150 ease-out motion-reduce:transition-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-64",
        selected
          ? SELECTED[tone]
          : "border-transparent bg-sidebar text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {selected ? <Check className="-ml-0.5" size={11} strokeWidth={3} aria-hidden /> : null}
      {children}
    </button>
  );
}
