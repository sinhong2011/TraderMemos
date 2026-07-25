import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export type OptionsSelectOption = {
  value: string;
  label: ReactNode;
  /** Compact label for the closed trigger; falls back to string `label` or `value`. */
  shortLabel?: ReactNode;
  disabled?: boolean;
};

/**
 * Convenience select for options-driven call sites.
 * Composition primitives live in `ui/select` (shadcn Base UI).
 */
export function OptionsSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  ariaLabel,
  id,
  disabled,
  ghost = false,
  className,
  triggerClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly OptionsSelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  /** Borderless trigger that blends into the surface until hovered. */
  ghost?: boolean;
  className?: string;
  triggerClassName?: string;
}) {
  const items = options.map((option) => ({
    label: option.label,
    value: option.value,
  }));

  const labelFor = (current: string | null, compact = false) => {
    const option = options.find((o) => o.value === (current ?? value));
    if (!option) return undefined;
    if (compact) {
      if (option.shortLabel) return option.shortLabel;
      return typeof option.label === "string" ? option.label : option.value;
    }
    return option.label;
  };

  return (
    <div className={cn("min-w-0", className)}>
      <Select
        value={value}
        onValueChange={(val) => onValueChange(val ?? "")}
        disabled={disabled}
        modal={false}
        items={items}
      >
        <SelectTrigger
          id={id}
          aria-label={ariaLabel}
          variant={ghost ? "ghost" : "default"}
          className={triggerClassName}
        >
          <SelectValue placeholder={<span className="text-muted-foreground">{placeholder}</span>}>
            {(current) =>
              labelFor(current, true) ? (
                labelFor(current, true)
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
