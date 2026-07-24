import { Copy, Pencil, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/cn";
import { Button } from "../../ui/button";

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
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Positions
      </span>
      {sessions.map((s) => {
        const active = s.id === activeId;
        const editing = editingId === s.id;

        return (
          <div key={s.id} className="group relative flex items-center">
            {editing ? (
              <input
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
                className="min-w-[5rem] max-w-[10rem] rounded-md border-none bg-muted px-2 py-1 text-[11px] font-medium text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label="Rename position"
              />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onSelect(s.id)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  startEdit(s.id, s.name);
                }}
                title={onRename ? "Double-click to rename" : undefined}
                className={cn(
                  "h-auto px-2.5 py-1",
                  active
                    ? "bg-accent/15 text-primary hover:bg-primary/15 hover:text-primary"
                    : "bg-accent text-muted-foreground",
                )}
              >
                {s.name}
              </Button>
            )}
            {active && !editing ? (
              <div className="ml-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {onRename ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Rename"
                    onClick={() => startEdit(s.id, s.name)}
                    className="size-auto rounded p-0.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
                  >
                    <Pencil size={11} />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Duplicate"
                  onClick={() => onDuplicate(s.id)}
                  className="size-auto rounded p-0.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
                >
                  <Copy size={11} />
                </Button>
                {sessions.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Delete"
                    onClick={() => onRemove(s.id)}
                    className="size-auto rounded p-0.5 text-muted-foreground hover:bg-transparent hover:text-destructive"
                  >
                    <X size={11} />
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onAdd}
        className="h-auto gap-1 bg-accent px-2 py-1 text-muted-foreground"
      >
        <Plus size={11} />
        Add
      </Button>
    </div>
  );
}
