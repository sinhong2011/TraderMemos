import { SearchIcon } from "lucide-react";
import { useMemo, useRef } from "react";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxTrigger,
  ComboboxValue,
} from "./ui/combobox";
import { SelectButton } from "./ui/select";

export type MultiSelectOption = {
  value: string;
  /** Shown in the popup, on the trigger, and used for search filtering. */
  label: string;
};

/**
 * Multi-select over the coss ui combobox: a select-shaped trigger summarises the
 * picks, the popup holds the search input and the checkable list. Convenience
 * wrapper for id-list call sites — primitives live in `ui/combobox` (base-ui).
 */
export function MultiSelectCombobox({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  ariaLabel,
  id,
  disabled,
  className,
}: {
  value: string[];
  onValueChange: (value: string[]) => void;
  options: readonly MultiSelectOption[];
  /** Trigger text when nothing is selected. */
  placeholder?: string;
  searchPlaceholder?: string;
  /** Shown in the popup when the query matches nothing. */
  emptyText?: string;
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  /** Applied to the trigger button. */
  className?: string;
}) {
  // `ComboboxPopup` defaults its anchor to the chips container, which this
  // trigger-shaped variant never renders — anchor to the trigger instead.
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  // Base UI matches items by identity, so selection has to reference the same
  // option objects the list renders — `isItemEqualToValue` covers re-created arrays.
  const items = useMemo(() => [...options], [options]);
  const selected = useMemo(
    () =>
      value
        .map((id) => items.find((option) => option.value === id))
        .filter((option): option is MultiSelectOption => Boolean(option)),
    [value, items],
  );

  return (
    <Combobox<MultiSelectOption, true>
      multiple
      items={items}
      value={selected}
      onValueChange={(next) => onValueChange(next.map((option) => option.value))}
      isItemEqualToValue={(a, b) => a.value === b.value}
      disabled={disabled}
    >
      <ComboboxTrigger
        render={<SelectButton className={className} />}
        ref={triggerRef}
        id={id}
        aria-label={ariaLabel}
      >
        <ComboboxValue>
          {(picked: MultiSelectOption[]) =>
            picked.length ? (
              picked.map((option) => option.label).join(", ")
            ) : (
              <span className="text-muted-foreground/72">{placeholder}</span>
            )
          }
        </ComboboxValue>
      </ComboboxTrigger>
      <ComboboxPopup anchor={triggerRef} aria-label={ariaLabel}>
        <div className="border-b p-2">
          <ComboboxInput
            className="rounded-md before:rounded-[calc(var(--radius-md)-1px)]"
            placeholder={searchPlaceholder}
            showTrigger={false}
            startAddon={<SearchIcon />}
          />
        </div>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(item: MultiSelectOption) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
