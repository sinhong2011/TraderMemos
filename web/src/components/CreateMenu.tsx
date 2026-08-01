import { Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/i18n";
import { navLabel } from "@/lib/locale";
import { CREATE_ACTIONS } from "@/lib/navItems";
import { useUI } from "@/lib/ui";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/**
 * Quick-add menu — one trigger for every CREATE_ACTIONS target.
 *
 * `fab` is the centre button in the mobile tab capsule; `floating` is the
 * desktop counterpart parked in the shell's bottom-right corner, where the
 * actions fan out as a speed dial instead of a menu panel. `header` is the
 * flat icon button sized for a HeaderBar trigger row.
 */
export function CreateMenu({ variant = "header" }: { variant?: "header" | "fab" | "floating" }) {
  const [open, setOpen] = useState(false);
  const openModal = useUI((s) => s.openModal);
  const { locale } = useLocale();
  const label = (key: Parameters<typeof navLabel>[1]) => navLabel(locale, key);
  const isFab = variant === "fab";
  const isFloating = variant === "floating";

  // Nearest the button first: the dial stacks upward, so the list is reversed
  // and the stagger counts back down to the row sitting on top of the FAB.
  const dialActions = [...CREATE_ACTIONS].reverse();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label("create")}
        title={label("create")}
        // Desktop-only affordance: hovering the corner button unfurls the dial,
        // and the close delay covers the pointer crossing the 14px gap. Touch
        // taps still open it, and the other variants stay click-only.
        openOnHover={isFloating}
        delay={140}
        closeDelay={160}
        className={
          isFloating
            ? cn(
                "flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none",
                "bg-primary text-primary-foreground shadow-lg shadow-primary/30",
                // The ring is a box-shadow, so it grows outward without nudging
                // layout — a soft halo that only colours in on hover/open.
                "ring-4 ring-primary/0",
                "animate-fab-in transition-[background-color,box-shadow,translate,scale] duration-200 ease-out",
                "hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 hover:ring-primary/20",
                "active:translate-y-0 active:scale-95",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                "motion-reduce:animate-none motion-reduce:transition-none",
                "motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
                open && "shadow-xl shadow-primary/40 ring-primary/20",
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
          size={isFab ? 18 : isFloating ? 20 : 16}
          strokeWidth={2}
          aria-hidden
          className={cn(
            "transition-transform duration-200 ease-out motion-reduce:transition-none",
            open && "rotate-45",
          )}
        />
      </PopoverTrigger>

      {isFloating ? (
        <PopoverContent
          side="top"
          align="end"
          sideOffset={14}
          className={cn(
            // No panel at all — the popup is only a positioned, focus-managed
            // container for the dial, so every surface class is stripped and
            // the viewport stops clipping (the rows' shadows live outside it).
            "group/dial w-auto border-none bg-transparent shadow-none before:hidden",
            "[&_[data-slot=popover-viewport]]:overflow-visible [&_[data-slot=popover-viewport]]:p-0",
          )}
        >
          {/* 2px of right padding centres the 44px rows on the 48px trigger. */}
          <div className="flex flex-col items-end gap-2.5 pr-0.5">
            {dialActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.modal}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    openModal(action.modal);
                  }}
                  // Counting back down the reversed list launches the row
                  // closest to the FAB first, so the stack unfurls outward.
                  style={{ transitionDelay: `${(dialActions.length - 1 - index) * 45}ms` }}
                  className={cn(
                    "group/row flex cursor-pointer items-center gap-2.5 outline-none",
                    "transition-[translate,scale,opacity] duration-300 ease-[cubic-bezier(0.34,1.4,0.5,1)]",
                    // Rows launch from the trigger: dropped onto it, shrunk, invisible.
                    "group-data-[starting-style]/dial:translate-y-5",
                    "group-data-[starting-style]/dial:scale-90 group-data-[starting-style]/dial:opacity-0",
                    "group-data-[ending-style]/dial:translate-y-3 group-data-[ending-style]/dial:opacity-0",
                    "motion-reduce:transition-none",
                    "motion-reduce:group-data-[starting-style]/dial:translate-y-0",
                    "motion-reduce:group-data-[starting-style]/dial:scale-100",
                    "motion-reduce:group-data-[starting-style]/dial:opacity-100",
                  )}
                >
                  {/*
                   * `invert` (zinc-700 dark / zinc-900 light) rather than
                   * `popover`: in dark mode popover sits 2% off the page
                   * background, so the dial dissolved into the void behind it
                   * and the shadows had nothing to catch. The lifted neutral
                   * reads in both themes and leaves primary to the FAB.
                   */}
                  <span
                    className={cn(
                      "rounded-md bg-invert px-2.5 py-1 text-[12px] font-medium text-invert-foreground",
                      "shadow-lg shadow-black/25",
                    )}
                  >
                    {label(action.labelKey)}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-full",
                      "bg-invert text-primary shadow-lg shadow-black/25",
                      "transition-[background-color,color,box-shadow,scale] duration-150 ease-out",
                      "group-hover/row:scale-105 group-hover/row:bg-primary",
                      "group-hover/row:text-primary-foreground group-hover/row:shadow-primary/30",
                      "group-focus-visible/row:ring-2 group-focus-visible/row:ring-ring",
                      "motion-reduce:transition-none motion-reduce:group-hover/row:scale-100",
                    )}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      ) : (
        <PopoverContent
          side={isFab ? "top" : "bottom"}
          align={isFab ? "center" : "end"}
          sideOffset={isFab ? 12 : 6}
          className={cn(
            "group/popup w-[232px]",
            // The viewport owns the inner padding (p-4 by default) and sets its
            // own inline-padding var, so it has to be overridden on that element
            // or the rows float in a 16px moat.
            "[&_[data-slot=popover-viewport]]:p-1.5",
          )}
        >
          <p className="m-0 flex items-center gap-1.5 px-2.5 pt-1 pb-2 text-[10px] font-semibold tracking-widest text-chart-3 uppercase">
            <Sparkles size={11} strokeWidth={2} aria-hidden />
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
                    "group/row h-12 w-full justify-start gap-3 rounded-md px-2 text-[13px] font-medium",
                    "transition-[translate,opacity,background-color] duration-200 ease-out",
                    "group-data-[starting-style]/popup:translate-y-1 group-data-[starting-style]/popup:opacity-0",
                    "motion-reduce:transition-none motion-reduce:group-data-[starting-style]/popup:translate-y-0",
                    "motion-reduce:group-data-[starting-style]/popup:opacity-100",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-md",
                      "bg-primary/10 text-primary transition-colors duration-150 ease-out",
                      "group-hover/row:bg-primary/16 group-data-pressed/row:bg-primary/16",
                      "motion-reduce:transition-none",
                    )}
                    aria-hidden
                  >
                    <Icon className="size-4 opacity-100" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">
                    {label(action.labelKey)}
                  </span>
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
