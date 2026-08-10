import { Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/i18n";
import { navLabel } from "@/lib/locale";
import { CREATE_ACTIONS } from "@/lib/navItems";
import { useHotkeyBindings } from "@/lib/keybindings";
import { useUI } from "@/lib/ui";
import { ShortcutKeys } from "./ShortcutKeys";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/**
 * Quick-add menu — one trigger for every CREATE_ACTIONS target.
 *
 * `fab` is the centre button in the mobile tab capsule; `rail` is the desktop
 * counterpart in the nav rail's bottom cluster; `header` is the flat icon
 * button sized for a HeaderBar trigger row. All three open the same panel.
 */
export function CreateMenu({ variant = "header" }: { variant?: "header" | "fab" | "rail" }) {
  const [open, setOpen] = useState(false);
  const openModal = useUI((s) => s.openModal);
  const { locale } = useLocale();
  const bindings = useHotkeyBindings();
  const label = (key: Parameters<typeof navLabel>[1]) => navLabel(locale, key);
  const isFab = variant === "fab";
  const isRail = variant === "rail";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label("create")}
        title={label("create")}
        className={
          isRail
            ? cn(
                // Same geometry and quiet chrome as RailLink and the Tools
                // trigger — no resting fill, so the rail reads as one column of
                // icons and only hover/open paints a surface.
                "group flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none",
                "pointer-coarse:size-11",
                "transition-[background-color,color] duration-150 ease-out",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                "motion-reduce:transition-none",
                open
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )
            : isFab
              ? cn(
                  "mx-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none",
                  "bg-primary text-primary-foreground shadow-md shadow-primary/25",
                  "transition-[background-color,box-shadow,scale] duration-200 ease-out",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  "active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
                  open && "shadow-primary/40",
                )
              : cn(
                  // Matches the sibling header triggers (date range, currency, account).
                  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none",
                  "pointer-coarse:size-11",
                  "transition-[background-color,color] duration-150 ease-out",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  "motion-reduce:transition-none",
                  open
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )
        }
      >
        {/*
         * The plus turns into a close mark, but the rotation has to stay on the
         * icon: the trigger is also the popover's positioning anchor, and
         * rotating a square button grows its bounding rect (44px → ~62px), so
         * the popup would slide as it opened chasing the anchor's moving edge.
         */}
        <Plus
          size={isFab ? 18 : isRail ? 20 : 16}
          strokeWidth={2}
          aria-hidden
          className={cn(
            "transition-transform duration-200 ease-out motion-reduce:transition-none",
            open && "rotate-45",
          )}
        />
      </PopoverTrigger>

      {/* The rail hugs the left edge, so its panel opens sideways — and from
          the bottom of the rail it has to grow upward, hence `end`. The tab-bar
          FAB opens upward; the header trigger drops down under its row. */}
      <PopoverContent
        side={isFab ? "top" : isRail ? "right" : "bottom"}
        align={isFab ? "center" : "end"}
        sideOffset={isFab ? 12 : isRail ? 8 : 6}
        className={cn(
          "group/popup w-[248px]",
          // The viewport owns the inner padding (p-4 by default) and sets its
          // own inline-padding var, so it has to be overridden on that element
          // or the rows float in a 16px moat.
          "[&_[data-slot=popover-viewport]]:p-1.5",
        )}
      >
        <p className="m-0 px-2.5 pt-1 pb-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          {label("create")}
        </p>
        <div className="flex flex-col gap-0.5">
          {CREATE_ACTIONS.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.modal}
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  openModal(action.modal);
                }}
                // Rows fade up behind the popup's own scale-in, 40ms apart.
                style={{ transitionDelay: `${index * 40}ms` }}
                className={cn(
                  "group/row h-10 w-full justify-start gap-2.5 rounded-md px-2 text-[13px] font-medium",
                  "transition-[translate,opacity,background-color] duration-200 ease-out",
                  "group-data-[starting-style]/popup:translate-y-1 group-data-[starting-style]/popup:opacity-0",
                  "motion-reduce:transition-none motion-reduce:group-data-[starting-style]/popup:translate-y-0",
                  "motion-reduce:group-data-[starting-style]/popup:opacity-100",
                )}
              >
                {/* No well, no tint: the icon inherits the row's own colour so
                    the list reads as plain menu items. */}
                <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
                  <Icon className="size-4 opacity-100" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1 truncate text-left">{label(action.labelKey)}</span>
                {/*
                 * Every row already has a binding — advertising it here is how
                 * people graduate from the menu to the keyboard. Hidden from
                 * assistive tech: the shortcut is not part of the row's name,
                 * and the keybindings screen lists them properly.
                 */}
                <span aria-hidden className="shrink-0">
                  <ShortcutKeys className="opacity-70 transition-opacity duration-150 ease-out group-hover/row:opacity-100 motion-reduce:transition-none">
                    {bindings[action.hotkeyId].label}
                  </ShortcutKeys>
                </span>
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
