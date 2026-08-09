import { Dialog } from "@base-ui/react";
import { Command } from "cmdk";
import { Filter, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useFilters } from "@/lib/filters";
import { useHotkeyLabel } from "@/lib/keybindings";
import { type CommandGroup, useCommands } from "@/lib/useCommands";
import { useUI } from "@/lib/ui";
import { ShortcutKeys } from "./ShortcutKeys";

const GROUP_ORDER: CommandGroup[] = ["Navigate", "Actions", "Tools"];

export function CommandPalette() {
  const paletteLabel = useHotkeyLabel("palette");
  const open = useUI((s) => s.commandOpen);
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const symbols = useFilters((s) => s.symbols);
  const setSymbol = useFilters((s) => s.setSymbol);
  const setSymbols = useFilters((s) => s.setSymbols);
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
        <Dialog.Backdrop className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-[2px]" />
        <div className="fixed inset-0 z-[510] flex items-start justify-center px-4 pt-[min(18vh,120px)] pointer-events-none">
          <Dialog.Popup
            className={cn(
              "pointer-events-auto w-full max-w-[560px] overflow-hidden",
              "rounded-lg border border-border bg-card shadow-lg outline-none",
            )}
          >
            <Command label="Command palette" loop className="flex flex-col">
              <div className="m-2 flex items-center gap-2 rounded-md border border-border bg-muted px-3">
                <Search
                  size={16}
                  strokeWidth={1.75}
                  className="shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Pages, tools, or type a symbol…"
                  className={cn(
                    "h-11 w-full border-none bg-transparent text-[13px] text-foreground outline-none",
                    "placeholder:text-muted-foreground",
                  )}
                />
                <ShortcutKeys>esc</ShortcutKeys>
              </div>
              <Command.List className="max-h-[min(420px,50vh)] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No matching commands.
                </Command.Empty>
                {(canFilterSymbol || (symbols?.length ?? 0) > 0) && (
                  <Command.Group
                    heading="Filters"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {canFilterSymbol && (
                      <Command.Item
                        value={`filter symbol ${symbolQuery}`}
                        onSelect={() => {
                          setSymbol(symbolQuery);
                          setCommandOpen(false);
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2",
                          "text-[13px] text-muted-foreground outline-none",
                          "data-[selected=true]:bg-accent data-[selected=true]:text-foreground",
                        )}
                      >
                        <Filter
                          size={16}
                          strokeWidth={1.75}
                          className="shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">
                          Filter symbol: {symbolQuery}
                        </span>
                      </Command.Item>
                    )}
                    {symbols?.length ? (
                      <Command.Item
                        value={`clear symbol ${symbols.join(" ")}`}
                        onSelect={() => {
                          setSymbols(undefined);
                          setCommandOpen(false);
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2",
                          "text-[13px] text-muted-foreground outline-none",
                          "data-[selected=true]:bg-accent data-[selected=true]:text-foreground",
                        )}
                      >
                        <X
                          size={16}
                          strokeWidth={1.75}
                          className="shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">
                          Clear symbol filter ({symbols.join(", ")})
                        </span>
                      </Command.Item>
                    ) : null}
                  </Command.Group>
                )}
                {grouped.map(({ group, items }) => (
                  <Command.Group
                    key={group}
                    heading={group}
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Command.Item
                          key={item.id}
                          value={`${item.label} ${item.keywords.join(" ")}`}
                          onSelect={item.run}
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2",
                            "text-[13px] text-muted-foreground outline-none",
                            "data-[selected=true]:bg-accent data-[selected=true]:text-foreground",
                          )}
                        >
                          <Icon
                            size={16}
                            strokeWidth={1.75}
                            className="shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.shortcut ? <ShortcutKeys>{item.shortcut}</ShortcutKeys> : null}
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                ))}
              </Command.List>
              <div className="flex items-center justify-between gap-3 px-3 py-2 text-[10px] text-muted-foreground">
                <span>Navigate with ↑↓ · Enter to run · shortcuts when empty</span>
                <ShortcutKeys>{paletteLabel}</ShortcutKeys>
              </div>
            </Command>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
