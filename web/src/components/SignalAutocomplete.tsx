import { Autocomplete } from "@base-ui/react/autocomplete";
import { ChevronDown, Loader2, RefreshCw, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { signalInputClass } from "./signal-field-styles";
import {
  signalOverlayPopupClass,
  signalSelectItemClass,
  signalSelectListClass,
} from "./signal-overlay-styles";
import { Button } from "./ui/button";

export type SignalAutocompleteItem = {
  value: string;
  label?: ReactNode;
};

function toItems(items: readonly (string | SignalAutocompleteItem)[]): SignalAutocompleteItem[] {
  return items.map((item) =>
    typeof item === "string"
      ? { value: item, label: item }
      : { value: item.value, label: item.label ?? item.value },
  );
}

const autocompleteActionClass = cn(
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-control border-none",
  "bg-transparent text-text-dim transition-colors duration-150",
  "hover:bg-bg-hover hover:text-text",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
  "disabled:cursor-not-allowed disabled:opacity-45",
  "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45",
);

/**
 * Signal Terminal autocomplete (Base UI / ReUI pattern).
 * Free-form input with filtered suggestions; optional end action slot.
 */
export function SignalAutocomplete({
  value,
  onValueChange,
  items,
  placeholder = "Search…",
  emptyText = "No results found.",
  ariaLabel,
  id,
  disabled,
  className,
  inputClassName,
  showTrigger = true,
  showClear = false,
  endAction,
  autoHighlight = true,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: readonly (string | SignalAutocompleteItem)[];
  placeholder?: string;
  emptyText?: string;
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  /** Chevron that opens the suggestion list. */
  showTrigger?: boolean;
  /** X button that clears the input when it has a value. */
  showClear?: boolean;
  /** Extra control rendered to the right of the trigger (e.g. fetch). */
  endAction?: ReactNode;
  autoHighlight?: boolean | "always";
}) {
  const [open, setOpen] = useState(false);
  const normalized = toItems(items);
  const trailingCount = (showClear ? 1 : 0) + (showTrigger ? 1 : 0) + (endAction ? 1 : 0);
  const inputPad =
    trailingCount === 0
      ? undefined
      : trailingCount === 1
        ? "pr-10"
        : trailingCount === 2
          ? "pr-[4.25rem]"
          : "pr-[6rem]";

  return (
    <div className={cn("min-w-0", className)}>
      <Autocomplete.Root
        items={normalized}
        value={value}
        onValueChange={(next) => onValueChange(next)}
        open={open}
        onOpenChange={(next) => setOpen(next)}
        disabled={disabled}
        autoHighlight={autoHighlight}
        openOnInputClick
        itemToStringValue={(item) => item.value}
      >
        <div className="relative flex w-full min-w-0 items-center">
          <Autocomplete.Input
            id={id}
            aria-label={ariaLabel}
            placeholder={placeholder}
            spellCheck={false}
            className={cn(signalInputClass, inputPad, inputClassName)}
          />
          <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
            {showClear ? (
              <Autocomplete.Clear className={autocompleteActionClass} aria-label="Clear">
                <X size={13} strokeWidth={1.75} aria-hidden />
              </Autocomplete.Clear>
            ) : null}
            {showTrigger ? (
              <Autocomplete.Trigger
                className={autocompleteActionClass}
                aria-label="Toggle suggestions"
              >
                <ChevronDown
                  size={12}
                  strokeWidth={1.5}
                  className={cn(
                    "transition-transform duration-[220ms] ease-out",
                    open && "rotate-180 text-accent",
                    "motion-reduce:transition-none",
                  )}
                  aria-hidden
                />
              </Autocomplete.Trigger>
            ) : null}
            {endAction}
          </div>
        </div>

        <Autocomplete.Portal>
          <Autocomplete.Positioner side="bottom" align="start" sideOffset={6} className="z-[400]">
            <Autocomplete.Popup
              className={cn(
                signalOverlayPopupClass,
                "max-h-64 min-w-[max(var(--anchor-width),12rem)] overflow-auto",
              )}
            >
              <Autocomplete.Empty className="px-3 py-2.5 text-center text-[12px] text-text-muted">
                {emptyText}
              </Autocomplete.Empty>
              <Autocomplete.List className={signalSelectListClass}>
                {(item: SignalAutocompleteItem) => (
                  <Autocomplete.Item
                    key={item.value}
                    value={item}
                    className={signalSelectItemClass}
                  >
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
    </div>
  );
}

/**
 * Model field: type or pick from suggestions, with a fetch-models action on the right.
 */
export function ModelAutocomplete({
  value,
  onValueChange,
  models,
  onFetchModels,
  fetching = false,
  fetchLabel = "Fetch models",
  fetchDisabled,
  placeholder = "gpt-4o-mini",
  emptyText = "No models match.",
  ariaLabel,
  id,
  disabled,
  className,
  inputClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  /** Fetched / known model ids. */
  models?: readonly string[];
  onFetchModels?: () => void;
  fetching?: boolean;
  fetchLabel?: string;
  fetchDisabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  const items = models ?? [];

  return (
    <SignalAutocomplete
      value={value}
      onValueChange={onValueChange}
      items={items}
      placeholder={placeholder}
      emptyText={emptyText}
      ariaLabel={ariaLabel}
      id={id}
      disabled={disabled}
      className={className}
      inputClassName={inputClassName}
      showClear
      endAction={
        onFetchModels ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled || fetchDisabled || fetching}
            className={autocompleteActionClass}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFetchModels();
            }}
            aria-label={fetchLabel}
            title={fetchLabel}
          >
            {fetching ? (
              <Loader2 size={13} strokeWidth={1.75} className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw size={13} strokeWidth={1.75} aria-hidden />
            )}
          </Button>
        ) : undefined
      }
    />
  );
}
