import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/cn";
import {
  signalOverlayPopupClass,
  signalSelectItemClass,
  signalSelectListClass,
} from "../signal-overlay-styles";

/**
 * Signal Terminal Select — shadcn Base UI select with product tokens.
 * @see https://ui.shadcn.com/docs/components/base/select
 */

const Select = SelectPrimitive.Root;

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" className={cn(className)} {...props} />;
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex min-w-0 flex-1 truncate text-left", className)}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  size = "default",
  variant = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default";
  /** Borderless trigger that blends into the surface until hovered. */
  variant?: "default" | "ghost";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      data-variant={variant}
      className={cn(
        "group/select-trigger flex w-full min-w-0 cursor-pointer items-center justify-between gap-2",
        "rounded-control border-none text-[13px] text-text whitespace-nowrap outline-none",
        "transition-[background-color,color] duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-55",
        "aria-invalid:outline-loss/40",
        "data-disabled:cursor-not-allowed data-disabled:opacity-55",
        "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        size === "default" && "h-10 px-3",
        size === "sm" && "h-8 px-2.5 text-[12px]",
        variant === "default" &&
          "bg-bg-input hover:bg-bg-input-hover data-popup-open:bg-bg-input-hover",
        variant === "ghost" && "bg-transparent hover:bg-bg-hover data-popup-open:bg-bg-hover",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="flex shrink-0">
        <ChevronDown
          size={12}
          strokeWidth={1.5}
          className={cn(
            "text-text-dim transition-transform duration-220 ease-out",
            "group-data-popup-open/select-trigger:rotate-180 group-data-popup-open/select-trigger:text-accent",
            "motion-reduce:transition-none",
          )}
          aria-hidden
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  positionMethod = "fixed",
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger" | "positionMethod"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        positionMethod={positionMethod}
        className="isolate z-400"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            signalOverlayPopupClass,
            "relative max-h-(--available-height) min-w-[max(var(--anchor-width),9rem)] w-(--anchor-width)",
            "origin-(--transform-origin) overflow-x-hidden overflow-y-auto",
            "data-[align-trigger=true]:animate-none",
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className={signalSelectListClass}>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(
        "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-dim",
        className,
      )}
      {...props}
    />
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(signalSelectItemClass, className)}
      {...props}
    >
      <SelectPrimitive.ItemText className="min-w-0 flex-1 truncate">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="flex w-3.5 shrink-0 justify-center">
        <Check size={13} strokeWidth={2} className="text-accent" aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({ className, ...props }: SelectPrimitive.ScrollUpArrow.Props) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 flex w-full cursor-default items-center justify-center bg-bg-panel py-1 text-text-dim",
        className,
      )}
      {...props}
    >
      <ChevronUp size={12} strokeWidth={1.5} aria-hidden />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({ className, ...props }: SelectPrimitive.ScrollDownArrow.Props) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 flex w-full cursor-default items-center justify-center bg-bg-panel py-1 text-text-dim",
        className,
      )}
      {...props}
    >
      <ChevronDown size={12} strokeWidth={1.5} aria-hidden />
    </SelectPrimitive.ScrollDownArrow>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
