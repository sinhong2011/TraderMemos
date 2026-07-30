import { Copy, Pencil, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

/** Icon actions on the selected tab — pinned so they stay inside the 28px row. */
const tabActionClass =
  "size-5 shrink-0 rounded p-0 text-muted-foreground hover:bg-transparent hover:text-foreground sm:size-5";

export function SessionRail({
  sessions,
  activeId,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
  onRename,
}: {
  sessions: { id: string; name: string }[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onRename?: (id: string, name: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const startEdit = (id: string, name: string) => {
    if (!onRename) return;
    setEditingId(id);
    setDraft(name);
  };

  const commitEdit = (id: string, fallback: string) => {
    const next = draft.trim() || fallback;
    onRename?.(id, next);
    setEditingId(null);
    setDraft("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Track mirrors SegmentedControl so the rail reads as tabs, not loose chips. */}
      <div
        role="tablist"
        aria-label="Positions"
        className={cn(
          "flex flex-wrap items-center gap-0.5 rounded-lg border border-input bg-muted p-0.5 shadow-xs/5",
          "dark:bg-input/32",
        )}
      >
        {sessions.map((s) => {
          const active = s.id === activeId;
          const editing = editingId === s.id;

          if (editing) {
            return (
              <input
                key={s.id}
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commitEdit(s.id, s.name)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitEdit(s.id, s.name);
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  }
                }}
                className="h-7 min-w-[6rem] max-w-[10rem] rounded-md border-none bg-background px-2 text-[12px] font-medium text-foreground shadow-xs/5 outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring dark:bg-input"
                aria-label="Rename position"
              />
            );
          }

          return (
            <div
              key={s.id}
              className={cn(
                "flex items-center rounded-md transition-colors",
                active && "bg-background shadow-xs/5 dark:bg-input",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(s.id)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  startEdit(s.id, s.name);
                }}
                title={onRename ? "Double-click to rename" : undefined}
                className={cn(
                  "h-7 max-w-[12rem] truncate rounded-md px-2.5 text-[12px] font-medium outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "pr-1.5 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.name}
              </button>
              {active ? (
                <span className="flex items-center gap-0.5 pr-1">
                  {onRename ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Rename ${s.name}`}
                      onClick={() => startEdit(s.id, s.name)}
                      className={tabActionClass}
                    >
                      <Pencil size={11} />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Duplicate ${s.name}`}
                    onClick={() => onDuplicate(s.id)}
                    className={tabActionClass}
                  >
                    <Copy size={11} />
                  </Button>
                  {sessions.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Delete ${s.name}`}
                      onClick={() => onRemove(s.id)}
                      className={cn(tabActionClass, "hover:text-destructive")}
                    >
                      <X size={11} />
                    </Button>
                  ) : null}
                </span>
              ) : null}
            </div>
          );
        })}
        <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onAdd}
          className="h-7 gap-1 rounded-md px-2 text-[12px] font-medium text-muted-foreground hover:bg-background hover:text-foreground sm:h-7 sm:text-[12px] dark:hover:bg-input"
        >
          <Plus size={12} />
          Add
        </Button>
      </div>
    </div>
  );
}
