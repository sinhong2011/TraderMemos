import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Check } from "lucide-react";
import { cn } from "../../lib/cn";
import {
  signalOverlayPopupClass,
  signalSelectItemClass,
  signalSelectListClass,
} from "../signal-overlay-styles";

/**
 * Signal Terminal Dropdown Menu — shadcn Base UI menu with product tokens.
 * @see https://ui.shadcn.com/docs/components/base/dropdown-menu
 */

function DropdownMenu({ modal = false, ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" modal={modal} {...props} />;
}

function DropdownMenuTrigger({ className, ...props }: MenuPrimitive.Trigger.Props) {
  return (
    <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" className={cn(className)} {...props} />
  );
}

function DropdownMenuContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  children,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className="isolate z-[400]"
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            signalOverlayPopupClass,
            "min-w-[10rem] overflow-hidden bg-bg-hover p-0 shadow-[0_16px_40px_rgba(18,18,24,0.65)]",
            className,
          )}
          {...props}
        >
          <MenuPrimitive.Viewport className={signalSelectListClass}>
            {children}
          </MenuPrimitive.Viewport>
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({ className, ...props }: MenuPrimitive.Group.Props) {
  return (
    <MenuPrimitive.Group data-slot="dropdown-menu-group" className={cn(className)} {...props} />
  );
}

function DropdownMenuLabel({ className, ...props }: MenuPrimitive.GroupLabel.Props) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-dim",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  inset,
  ...props
}: MenuPrimitive.Item.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset || undefined}
      className={cn(
        signalSelectItemClass,
        "min-h-8 gap-2 py-1.5 pl-2 data-[selected]:bg-transparent data-[selected]:font-normal data-[selected]:text-text",
        "data-[highlighted]:bg-white/[0.06]",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      checked={checked}
      className={cn(
        signalSelectItemClass,
        "min-h-8 gap-2 py-1.5 pl-2 data-[selected]:bg-transparent data-[selected]:font-normal data-[selected]:text-text",
        "data-[highlighted]:bg-white/[0.06]",
        className,
      )}
      {...props}
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <MenuPrimitive.CheckboxItemIndicator>
          <Check size={12} strokeWidth={2.5} className="text-accent" aria-hidden />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
