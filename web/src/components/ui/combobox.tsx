import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Check, ChevronDown, X } from "lucide-react";
import { useRef, forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import {
  signalOverlayPopupClass,
  signalSelectItemClass,
  signalSelectListClass,
} from "../signal-overlay-styles";
import { Button } from "./button";

/**
 * Signal Terminal Combobox — shadcn Base UI combobox with product tokens.
 * @see https://ui.shadcn.com/docs/components/base/combobox
 */

const Combobox = ComboboxPrimitive.Root;

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

function ComboboxTrigger({ className, children, ...props }: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-text-dim transition-colors",
        "hover:text-text data-popup-open:text-accent",
        className,
      )}
      {...props}
    >
      {children ?? (
        <ChevronDown
          size={12}
          strokeWidth={1.5}
          className={cn(
            "transition-transform duration-220 ease-out",
            "in-data-popup-open:rotate-180",
            "motion-reduce:transition-none",
          )}
          aria-hidden
        />
      )}
    </ComboboxPrimitive.Trigger>
  );
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      aria-label="Clear"
      render={
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-text-dim hover:text-text"
          tooltip={false}
        />
      }
      className={cn(className)}
      {...props}
    >
      <X size={12} strokeWidth={2} aria-hidden />
    </ComboboxPrimitive.Clear>
  );
}

function ComboboxInput({
  className,
  showTrigger = true,
  showClear = false,
  startAdornment,
  ...props
}: ComboboxPrimitive.Input.Props & {
  showTrigger?: boolean;
  showClear?: boolean;
  startAdornment?: ReactNode;
}) {
  return (
    <div
      data-slot="combobox-input-group"
      className={cn(
        "relative flex h-8 w-full min-w-0 items-center rounded-control border border-border bg-transparent",
        "transition-colors duration-150",
        "hover:border-border-strong",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-border-strong",
        className,
      )}
    >
      {startAdornment ? (
        <span className="pointer-events-none absolute left-2.5 flex text-text-dim" aria-hidden>
          {startAdornment}
        </span>
      ) : null}
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-[12px] text-text outline-none",
          "placeholder:text-text-dim",
          "disabled:cursor-not-allowed disabled:opacity-55",
          startAdornment ? "pl-7" : "pl-2.5",
          showTrigger || showClear ? "pr-7" : "pr-2.5",
        )}
        {...props}
      />
      {(showClear || showTrigger) && (
        <div className="absolute right-1 flex items-center">
          {showClear ? <ComboboxClear /> : null}
          {showTrigger ? <ComboboxTrigger className="size-6" /> : null}
        </div>
      )}
    </div>
  );
}

const ComboboxChips = forwardRef<HTMLDivElement, ComboboxPrimitive.Chips.Props>(
  function ComboboxChips({ className, ...props }, ref) {
    return (
      <ComboboxPrimitive.Chips
        ref={ref}
        data-slot="combobox-chips"
        className={cn(
          "flex min-h-8 w-full min-w-0 flex-wrap items-center gap-1 rounded-control border border-border bg-transparent px-1.5 py-1",
          "transition-colors duration-150",
          "hover:border-border-strong",
          "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-border-strong",
          className,
        )}
        {...props}
      />
    );
  },
);

function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: ComboboxPrimitive.Chip.Props & { showRemove?: boolean }) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-0.5 rounded-control border border-border bg-bg-hover px-1.5",
        "text-[10px] font-medium tracking-wide text-text-muted",
        className,
      )}
      {...props}
    >
      <span className="min-w-0 truncate">{children}</span>
      {showRemove ? (
        <ComboboxPrimitive.ChipRemove
          data-slot="combobox-chip-remove"
          aria-label="Remove"
          className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-sharp text-text-dim transition-colors hover:text-text"
        >
          <X size={10} strokeWidth={2.5} aria-hidden />
        </ComboboxPrimitive.ChipRemove>
      ) : null}
    </ComboboxPrimitive.Chip>
  );
}

function ComboboxChipsInput({
  className,
  startAdornment,
  ...props
}: ComboboxPrimitive.Input.Props & { startAdornment?: ReactNode }) {
  return (
    <span className="relative inline-flex min-w-16 flex-1 items-center">
      {startAdornment ? (
        <span className="pointer-events-none absolute left-0 flex text-text-dim" aria-hidden>
          {startAdornment}
        </span>
      ) : null}
      <ComboboxPrimitive.Input
        data-slot="combobox-chips-input"
        className={cn(
          "min-w-16 flex-1 bg-transparent text-[12px] text-text outline-none",
          "placeholder:text-text-dim",
          startAdornment ? "pl-5" : null,
          className,
        )}
        {...props}
      />
    </span>
  );
}

function ComboboxContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
  >) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-400"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            signalOverlayPopupClass,
            "relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width)",
            "min-w-[max(var(--anchor-width),9rem)] origin-(--transform-origin) overflow-hidden p-0",
            className,
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        signalSelectListClass,
        "max-h-72 overflow-y-auto overscroll-contain",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(signalSelectItemClass, "w-full cursor-pointer", className)}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator className="flex w-3.5 shrink-0 justify-center">
        <Check size={13} strokeWidth={2} className="text-accent" aria-hidden />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        // Root stays mounted for a11y live region; collapse padding when children are cleared.
        "px-3 py-6 text-center text-[12px] text-text-dim empty:p-0",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return (
    <ComboboxPrimitive.Group data-slot="combobox-group" className={cn(className)} {...props} />
  );
}

function ComboboxLabel({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn(
        "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-dim",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxCollection(props: ComboboxPrimitive.Collection.Props) {
  return <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />;
}

function ComboboxSeparator({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="combobox-separator"
      role="separator"
      className={cn("pointer-events-none my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function useComboboxAnchor() {
  return useRef<HTMLDivElement | null>(null);
}

export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxClear,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
};
