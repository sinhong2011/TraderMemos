import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { ChevronDown, Loader2, RefreshCw, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Autocomplete as AutocompleteRoot,
  AutocompleteClear,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem as AutocompleteOption,
  AutocompletePopup,
  AutocompleteTrigger,
} from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
import { overlayItemClass, overlayListClass } from "@/components/overlay-styles";
import { cn } from "@/lib/cn";

export type AutocompleteItem = {
  value: string;
  label?: ReactNode;
};

function toItems(items: readonly (string | AutocompleteItem)[]): AutocompleteItem[] {
  return items.map((item) =>
    typeof item === "string"
      ? { value: item, label: item }
      : { value: item.value, label: item.label ?? item.value },
  );
}

const autocompleteActionClass = cn(
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-none",
  "bg-transparent text-muted-foreground transition-colors duration-150",
  "hover:bg-accent hover:text-foreground",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
  "disabled:cursor-not-allowed disabled:opacity-45",
  "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45",
);

/**
 * Product autocomplete — coss/Base UI autocomplete with form trailing actions.
 * Free-form input with filtered suggestions; optional end action slot.
 */
export function Autocomplete({
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
  items: readonly (string | AutocompleteItem)[];
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
        ? "*:data-[slot=autocomplete-input]:pe-10"
        : trailingCount === 2
          ? "*:data-[slot=autocomplete-input]:pe-[4.25rem]"
          : "*:data-[slot=autocomplete-input]:pe-[6rem]";

  return (
    <div className={cn("min-w-0", className)}>
      <AutocompleteRoot
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
          <AutocompleteInput
            id={id}
            aria-label={ariaLabel}
            placeholder={placeholder}
            spellCheck={false}
            showClear={false}
            showTrigger={false}
            className={cn(inputPad, inputClassName)}
          />
          <div className="absolute top-1/2 right-1 z-10 flex -translate-y-1/2 items-center gap-0.5">
            {showClear ? (
              <AutocompleteClear className={autocompleteActionClass} aria-label="Clear">
                <X size={13} strokeWidth={1.75} aria-hidden />
              </AutocompleteClear>
            ) : null}
            {showTrigger ? (
              <AutocompleteTrigger
                className={autocompleteActionClass}
                aria-label="Toggle suggestions"
              >
                <ChevronDown
                  size={12}
                  strokeWidth={1.5}
                  className={cn(
                    "transition-transform duration-[220ms] ease-out",
                    open && "rotate-180 text-primary",
                    "motion-reduce:transition-none",
                  )}
                  aria-hidden
                />
              </AutocompleteTrigger>
            ) : null}
            {endAction}
          </div>
        </div>

        <AutocompletePopup
          side="bottom"
          align="start"
          sideOffset={6}
          className="z-[400] max-h-64 min-w-[max(var(--anchor-width),12rem)]"
        >
          <AutocompleteEmpty className="px-3 py-2.5 text-center text-[12px] text-muted-foreground">
            {emptyText}
          </AutocompleteEmpty>
          <AutocompletePrimitive.List className={overlayListClass}>
            {(item: AutocompleteItem) => (
              <AutocompleteOption key={item.value} value={item} className={overlayItemClass}>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </AutocompleteOption>
            )}
          </AutocompletePrimitive.List>
        </AutocompletePopup>
      </AutocompleteRoot>
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
    <Autocomplete
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
