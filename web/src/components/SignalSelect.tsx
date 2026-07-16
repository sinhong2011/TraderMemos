import { Select } from "@base-ui/react";
import { Check, ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { signalControlTriggerClass } from "./signal-field-styles";
import {
  signalOverlayPopupClass,
  signalSelectItemClass,
  signalSelectListClass,
} from "./signal-overlay-styles";

export type SignalSelectOption = {
  value: string;
  label: ReactNode;
  /** Compact label for the closed trigger; falls back to string `label` or `value`. */
  shortLabel?: string;
  disabled?: boolean;
};

export function SignalSelect({
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
  options: readonly SignalSelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  /** Borderless trigger that blends into the surface until hovered. */
  ghost?: boolean;
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

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
      <Select.Root
        value={value}
        onValueChange={(val: string | null) => onValueChange(val ?? "")}
        open={open}
        onOpenChange={setOpen}
        disabled={disabled}
        modal={false}
      >
        <Select.Trigger
          id={id}
          aria-label={ariaLabel}
          className={cn(
            "flex min-w-0 cursor-pointer items-center gap-2",
            signalControlTriggerClass,
            "text-left",
            ghost
              ? cn("bg-transparent hover:bg-bg-hover", open && "bg-bg-hover")
              : open && "bg-bg-input-hover",
            "data-[disabled]:cursor-default data-[disabled]:opacity-55",
            triggerClassName,
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            <Select.Value>
              {(current) =>
                labelFor(current, true) ? (
                  labelFor(current, true)
                ) : (
                  <span className="text-text-dim">{placeholder}</span>
                )
              }
            </Select.Value>
          </span>
          <ChevronDown
            size={12}
            strokeWidth={1.5}
            className={cn(
              "shrink-0 text-text-dim transition-transform duration-[220ms] ease-out",
              open && "rotate-180 text-accent",
              "motion-reduce:transition-none",
            )}
            aria-hidden
          />
        </Select.Trigger>

        <Select.Portal>
          <Select.Positioner
            side="bottom"
            align="start"
            sideOffset={6}
            positionMethod="fixed"
            alignItemWithTrigger={false}
            className="z-[400]"
          >
            <Select.Popup
              className={cn(
                signalOverlayPopupClass,
                "max-h-64 min-w-[max(var(--anchor-width),9rem)] overflow-auto",
              )}
            >
              <Select.List className={signalSelectListClass}>
                {options.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className={signalSelectItemClass}
                  >
                    <Select.ItemText className="min-w-0 flex-1 truncate">
                      {option.label}
                    </Select.ItemText>
                    <Select.ItemIndicator className="flex w-3.5 shrink-0 justify-center">
                      <Check size={13} strokeWidth={2} className="text-accent" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
