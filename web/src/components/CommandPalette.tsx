import { Dialog } from "@base-ui/react";
import { Command } from "cmdk";
import { Filter, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { useFilters } from "../lib/filters";
import { APP_HOTKEYS } from "../lib/hotkeys";
import { type CommandGroup, useCommands } from "../lib/useCommands";
import { useUI } from "../lib/ui";
import { signalKbdClass, signalKbdMutedClass } from "./signal-field-styles";

const GROUP_ORDER: CommandGroup[] = ["Navigate", "Actions", "Tools"];

/** Split chord labels like `G D` into adjacent keycaps; keep `⌘K` as one chip. */
function CommandShortcut({
  children,
  tone = "muted",
}: {
  children: string;
  tone?: "signal" | "muted";
}) {
  const cls = tone === "signal" ? signalKbdClass : signalKbdMutedClass;
  const parts = children.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return <kbd className={cls}>{children}</kbd>;
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      {parts.map((part, i) => (
        <kbd key={`${part}-${i}`} className={cls}>
          {part}
        </kbd>
      ))}
    </span>
  );
}

export function CommandPalette() {
  const open = useUI((s) => s.commandOpen);
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const symbol = useFilters((s) => s.symbol);
  const setSymbol = useFilters((s) => s.setSymbol);
  const [query, setQuery] = useState("");
  const commands = useCommands(() => setCommandOpen(false));

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const symbolQuery = query.trim().toUpperCase();
  const canFilterSymbol = /^[A-Z0-9.-]{1,10}$/.test(symbolQuery);

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: commands.filter((item) => item.group === group),
  })).filter((section) => section.items.length > 0);

  return (
    <Dialog.Root open={open} onOpenChange={setCommandOpen} modal="trap-focus">
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[500] bg-overlay-scrim backdrop-blur-[2px]" />
        <div className="fixed inset-0 z-[510] flex items-start justify-center px-4 pt-[min(18vh,120px)] pointer-events-none">
          <Dialog.Popup
            className={cn(
              "pointer-events-auto w-full max-w-[560px] overflow-hidden",
              "rounded-overlay border border-border-strong bg-bg-panel shadow-[0_16px_48px_rgba(18,18,24,0.6)] outline-none",
            )}
          >
            <Command label="Command palette" loop className="flex flex-col">
              <div className="m-2 flex items-center gap-2 rounded-control bg-bg-input px-3">
                <Search
                  size={16}
                  strokeWidth={1.75}
                  className="shrink-0 text-text-dim"
                  aria-hidden
                />
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Pages, tools, or type a symbol…"
                  className={cn(
                    "h-11 w-full border-none bg-transparent text-[13px] text-text outline-none",
                    "placeholder:text-text-dim",
                  )}
                />
                <CommandShortcut tone="signal">esc</CommandShortcut>
              </div>
              <Command.List className="max-h-[min(420px,50vh)] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-xs text-text-dim">
                  No matching commands.
                </Command.Empty>
                {(canFilterSymbol || symbol) && (
                  <Command.Group
                    heading="Filters"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-text-muted"
                  >
                    {canFilterSymbol && (
                      <Command.Item
                        value={`filter symbol ${symbolQuery}`}
                        onSelect={() => {
                          setSymbol(symbolQuery);
                          setCommandOpen(false);
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2",
                          "text-[13px] text-text-muted outline-none",
                          "data-[selected=true]:bg-bg-hover data-[selected=true]:text-text",
                        )}
                      >
                        <Filter
                          size={16}
                          strokeWidth={1.75}
                          className="shrink-0 text-text-dim"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">
                          Filter symbol: {symbolQuery}
                        </span>
                      </Command.Item>
                    )}
                    {symbol && (
                      <Command.Item
                        value={`clear symbol ${symbol}`}
                        onSelect={() => {
                          setSymbol(undefined);
                          setCommandOpen(false);
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2",
                          "text-[13px] text-text-muted outline-none",
                          "data-[selected=true]:bg-bg-hover data-[selected=true]:text-text",
                        )}
                      >
                        <X
                          size={16}
                          strokeWidth={1.75}
                          className="shrink-0 text-text-dim"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">
                          Clear symbol filter ({symbol})
                        </span>
                      </Command.Item>
                    )}
                  </Command.Group>
                )}
                {grouped.map(({ group, items }) => (
                  <Command.Group
                    key={group}
                    heading={group}
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-text-muted"
                  >
                    {items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Command.Item
                          key={item.id}
                          value={`${item.label} ${item.keywords.join(" ")}`}
                          onSelect={item.run}
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2",
                            "text-[13px] text-text-muted outline-none",
                            "data-[selected=true]:bg-bg-hover data-[selected=true]:text-text",
                          )}
                        >
                          <Icon
                            size={16}
                            strokeWidth={1.75}
                            className="shrink-0 text-text-dim"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.shortcut ? (
                            <CommandShortcut>{item.shortcut}</CommandShortcut>
                          ) : null}
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                ))}
              </Command.List>
              <div className="flex items-center justify-between gap-3 px-3 py-2 text-[10px] text-text-dim">
                <span>Navigate with ↑↓ · Enter to run · shortcuts when empty</span>
                <CommandShortcut tone="signal">{APP_HOTKEYS.palette.label}</CommandShortcut>
              </div>
            </Command>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
