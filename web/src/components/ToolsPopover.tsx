import { Command, Wrench } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { APP_HOTKEYS } from "@/lib/hotkeys";
import { TOOL_GROUPS, type ToolItem, toolsInGroup } from "@/lib/tools";
import { useToolRunner } from "@/lib/useToolRunner";
import { useUI } from "@/lib/ui";
import { filterChipClass } from "./field-styles";
import { RailTooltip } from "./RailTooltip";
import { Button } from "./ui/button";
import { Kbd } from "./ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/** Tool row — icon, full name. The icon picks up brand colour as the row lights. */
function ToolRow({ tool, onRun }: { tool: ToolItem; onRun: (tool: ToolItem) => void }) {
  const Icon = tool.icon;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onRun(tool)}
      className="group/row h-8 w-full justify-start gap-2.5 rounded-md px-2 text-[13px] font-normal"
    >
      <Icon
        // `opacity-100` overrides the button's default icon dimming so the muted
        // token alone carries the weight — dimmed *and* muted read as disabled.
        className="size-4 shrink-0 text-muted-foreground opacity-100 transition-colors duration-150 ease-out group-hover/row:text-primary motion-reduce:transition-none"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-left">{tool.label}</span>
    </Button>
  );
}

export function ToolsPopover({ variant = "rail" }: { variant?: "rail" | "header" }) {
  const [open, setOpen] = useState(false);
  const runTool = useToolRunner();
  const openCommandPalette = useUI((s) => s.openCommandPalette);
  const isHeader = variant === "header";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title="Tools"
        aria-label="Tools"
        className={cn(
          "group relative flex cursor-pointer items-center justify-center rounded-md outline-none",
          "transition-[background-color,color,transform] duration-150 ease-out",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "motion-reduce:transition-none",
          // Beside the range and currency chips this needs the same chrome and
          // a word — an unlabelled icon read as a stray glyph in that row.
          isHeader ? filterChipClass : "size-9 pointer-coarse:size-11",
          open
            ? "bg-accent text-foreground"
            : !isHeader && "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Wrench
          size={isHeader ? 14 : 20}
          strokeWidth={1.75}
          className={cn(
            "transition-transform duration-150 ease-out group-hover:scale-105 motion-reduce:transition-none",
            isHeader && "shrink-0 text-muted-foreground",
          )}
        />
        {isHeader ? <span>Tools</span> : <RailTooltip label="Tools" />}
      </PopoverTrigger>
      <PopoverContent
        side={isHeader ? "bottom" : "right"}
        align="end"
        sideOffset={isHeader ? 6 : 8}
        className={cn(
          "w-[236px]",
          // The viewport owns the inner padding (p-4 by default) and sets its
          // own inline-padding var, so it has to be overridden on that element
          // or the rows float in a 16px moat.
          "[&_[data-slot=popover-viewport]]:p-1.5",
        )}
      >
        <p className="m-0 flex items-center gap-1.5 px-2.5 pt-1 pb-1.5 text-[10px] font-semibold tracking-widest text-chart-3 uppercase">
          <Wrench size={11} strokeWidth={2} aria-hidden />
          Tools
        </p>

        {TOOL_GROUPS.map((group) => (
          <section key={group.id} className="pb-0.5 last:pb-0">
            {/* Sentence case, muted: the one uppercase line above stays the popover's title. */}
            <p className="m-0 px-2 pt-1 pb-0.5 text-[11px] font-medium text-muted-foreground">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {toolsInGroup(group.id).map((tool) => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  onRun={(item) => {
                    setOpen(false);
                    runTool(item.id);
                  }}
                />
              ))}
            </div>
          </section>
        ))}

        {/* Hairline, not spacing: without it the palette reads as an eleventh tool. */}
        <div className="mt-1.5 border-t border-border pt-1.5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              openCommandPalette();
            }}
            className="group/row h-8 w-full justify-between gap-2 rounded-md px-2 text-[12px] font-normal text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-2.5">
              <Command className="size-4 shrink-0 opacity-100" strokeWidth={1.75} aria-hidden />
              All commands
            </span>
            <Kbd>{APP_HOTKEYS.palette.label}</Kbd>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
