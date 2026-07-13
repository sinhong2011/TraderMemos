import { Copy, Pencil, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/cn";

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
      <span className="mr-1 text-[10px] font-medium uppercase tracking-widest text-text-dim">
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
                className="min-w-[5rem] max-w-[10rem] rounded-control border border-accent/40 bg-bg-inset px-2 py-1 text-[11px] font-medium text-text outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-bg)]"
                aria-label="Rename position"
              />
            ) : (
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  startEdit(s.id, s.name);
                }}
                title={onRename ? "Double-click to rename" : undefined}
                className={cn(
                  "rounded-control px-2.5 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-accent/15 text-accent"
                    : "bg-bg-hover text-text-muted hover:text-text",
                )}
              >
                {s.name}
              </button>
            )}
            {active && !editing ? (
              <div className="ml-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {onRename ? (
                  <button
                    type="button"
                    aria-label="Rename"
                    onClick={() => startEdit(s.id, s.name)}
                    className="rounded p-0.5 text-text-dim hover:text-text"
                  >
                    <Pencil size={11} />
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label="Duplicate"
                  onClick={() => onDuplicate(s.id)}
                  className="rounded p-0.5 text-text-dim hover:text-text"
                >
                  <Copy size={11} />
                </button>
                {sessions.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={() => onRemove(s.id)}
                    className="rounded p-0.5 text-text-dim hover:text-loss"
                  >
                    <X size={11} />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 rounded-control bg-bg-hover px-2 py-1 text-[11px] text-text-dim transition-colors hover:text-text"
      >
        <Plus size={11} />
        Add
      </button>
    </div>
  );
}
