import { ChevronDown, Layers, Tag as TagIcon, Trash2, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import type { Tag, Trade } from "@/lib/api/types";
import { useBulkTradeEdit, type BulkResult, type BulkTradeOp } from "@/lib/bulkTrades";
import { cn } from "@/lib/cn";
import { useSetups } from "@/lib/hooks/useSetups";
import { useTags } from "@/lib/hooks/useTags";
import { FormInput } from "./FormInput";
import { Modal } from "./Modal";
import { UNDO_TOAST_MS, useToastManager } from "./Toast";
import { Button } from "./ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "./ui/menu";

function plural(n: number, word = "trade") {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function summary(result: BulkResult, verb: string, noun = "trade"): string {
  const parts = [`${verb} ${plural(result.changed.length, noun)}`];
  if (result.skipped.length) parts.push(`${result.skipped.length} unchanged`);
  if (result.failed.length) parts.push(`${result.failed.length} failed`);
  return parts.join(" · ");
}

const barButton =
  "h-8 gap-1.5 rounded-md px-2.5 text-[13px] text-popover-foreground hover:bg-accent aria-expanded:bg-accent";

function TagDot({ color }: { color?: string }) {
  return (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full bg-muted-foreground"
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

function TagMenu({
  label,
  icon,
  tags,
  empty,
  onPick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  tags: Tag[];
  empty: string;
  onPick: (tag: Tag) => void;
  disabled: boolean;
}) {
  const regular = tags.filter((t) => t.kind !== "mistake");
  const mistakes = tags.filter((t) => t.kind === "mistake");
  const group = (title: string, list: Tag[]) =>
    list.length > 0 ? (
      <MenuGroup>
        <MenuGroupLabel>{title}</MenuGroupLabel>
        {list.map((t) => (
          <MenuItem key={t.id} onClick={() => onPick(t)}>
            <TagDot color={t.color || undefined} />
            <span className="min-w-0 flex-1 truncate">{t.name}</span>
          </MenuItem>
        ))}
      </MenuGroup>
    ) : null;
  return (
    <Menu>
      <MenuTrigger
        disabled={disabled}
        render={<Button type="button" variant="ghost" size="sm" className={barButton} />}
      >
        {icon}
        {label}
        <ChevronDown size={12} strokeWidth={1.75} className="text-muted-foreground" aria-hidden />
      </MenuTrigger>
      <MenuPopup side="top" align="start" className="max-h-72 w-56">
        {tags.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{empty}</p>
        ) : (
          <>
            {group("Tags", regular)}
            {regular.length > 0 && mistakes.length > 0 ? <MenuSeparator /> : null}
            {group("Mistakes", mistakes)}
          </>
        )}
      </MenuPopup>
    </Menu>
  );
}

/**
 * Floating action bar for the trades selected in the log. Each action is one
 * request per trade (no batch endpoint); tag edits offer Undo, since the bar
 * knows every row's previous tag list.
 */
export function BulkTradeBar({
  selected,
  totalMatching,
  onSelectAllMatching,
  onClear,
}: {
  selected: Trade[];
  totalMatching: number;
  onSelectAllMatching: () => void;
  onClear: () => void;
}) {
  const toast = useToastManager();
  const bulk = useBulkTradeEdit();
  const tagsQ = useTags();
  const setupsQ = useSetups();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const confirmId = useId();

  const count = selected.length;
  const busy = bulk.isPending;
  const allTags = tagsQ.data ?? [];
  const presentTagIds = new Set(selected.flatMap((t) => t.tags.map((tag) => tag.id)));
  const removableTags = allTags.filter((t) => presentTagIds.has(t.id));
  const setups = setupsQ.data ?? [];

  async function run(op: BulkTradeOp, onDone: (r: BulkResult) => void) {
    try {
      const result = await bulk.mutateAsync({ trades: selected, op });
      onDone(result);
    } catch {
      toast.add({ title: "Bulk edit failed", description: "Try again in a moment" });
    }
  }

  function tagEdit(kind: "add-tags" | "remove-tags", tag: Tag) {
    // Snapshot before the edit so Undo restores each row's own list.
    const before = Object.fromEntries(selected.map((t) => [t.id, t.tags.map((x) => x.id)]));
    void run({ kind, tagIds: [tag.id] }, (result) => {
      const restore: Record<string, string[]> = {};
      for (const t of result.changed) restore[t.id] = before[t.id];
      const undoable = result.changed;
      const toastId: string = toast.add({
        title: kind === "add-tags" ? `Tagged “${tag.name}”` : `Removed “${tag.name}”`,
        description: summary(result, kind === "add-tags" ? "Tagged" : "Updated"),
        // Long enough to read the result and reach Undo.
        timeout: UNDO_TOAST_MS,
        actionProps:
          undoable.length > 0
            ? {
                children: "Undo",
                onClick: () => {
                  // One shot: close the toast so a second click can't re-run it.
                  toast.close(toastId);
                  bulk
                    .mutateAsync({
                      trades: undoable,
                      op: { kind: "set-tags", tagIdsByTrade: restore },
                    })
                    .then(
                      (undo) =>
                        toast.add({
                          title: "Undone",
                          description: summary(undo, "Restored"),
                        }),
                      () => toast.add({ title: "Undo failed", description: "Try again" }),
                    );
                },
              }
            : undefined,
      });
    });
  }

  function setSetup(setupId: string | null, name: string) {
    void run({ kind: "set-setup", setupId }, (result) => {
      toast.add({
        title: setupId ? `Setup set to “${name}”` : "Setup cleared",
        description: summary(result, "Updated"),
      });
    });
  }

  function closeDelete(next: boolean) {
    setDeleteOpen(next);
    if (!next) setTyped("");
  }

  function confirmDelete() {
    void run({ kind: "delete" }, (result) => {
      closeDelete(false);
      toast.add({ title: "Trades removed", description: summary(result, "Removed") });
      if (result.failed.length === 0) onClear();
    });
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label={`Bulk actions for ${plural(count)}`}
        className={cn(
          "fixed bottom-16 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-1",
          "rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg/5",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-150",
        )}
      >
        <span className="px-2 text-[13px] font-medium tabular-nums" aria-live="polite">
          {count} selected
        </span>
        {count < totalMatching ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(barButton, "text-primary")}
            onClick={onSelectAllMatching}
          >
            Select all {totalMatching}
          </Button>
        ) : null}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <TagMenu
          label="Add tag"
          icon={<TagIcon size={14} strokeWidth={1.75} aria-hidden />}
          tags={allTags}
          empty="No tags yet — create them in Settings → Tags."
          onPick={(t) => tagEdit("add-tags", t)}
          disabled={busy}
        />
        <TagMenu
          label="Remove tag"
          icon={<TagIcon size={14} strokeWidth={1.75} aria-hidden />}
          tags={removableTags}
          empty="The selected trades have no tags."
          onPick={(t) => tagEdit("remove-tags", t)}
          disabled={busy}
        />
        <Menu>
          <MenuTrigger
            disabled={busy}
            render={<Button type="button" variant="ghost" size="sm" className={barButton} />}
          >
            <Layers size={14} strokeWidth={1.75} aria-hidden />
            Set setup
            <ChevronDown
              size={12}
              strokeWidth={1.75}
              className="text-muted-foreground"
              aria-hidden
            />
          </MenuTrigger>
          <MenuPopup side="top" align="start" className="max-h-72 w-56">
            {setups.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No setups yet — add them in the Playbook.
              </p>
            ) : (
              setups.map((s) => (
                <MenuItem key={s.id} onClick={() => setSetup(s.id, s.name)}>
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                </MenuItem>
              ))
            )}
            <MenuSeparator />
            <MenuItem onClick={() => setSetup(null, "")}>Clear setup</MenuItem>
          </MenuPopup>
        </Menu>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          className={cn(barButton, "text-loss hover:text-loss")}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 size={14} strokeWidth={1.75} aria-hidden />
          Delete
        </Button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear selection"
          className="text-muted-foreground"
          onClick={onClear}
        >
          <X size={14} strokeWidth={1.75} aria-hidden />
        </Button>
      </div>

      <Modal
        open={deleteOpen}
        onOpenChange={closeDelete}
        title={`Remove ${plural(count)}?`}
        className="max-w-[min(360px,94vw)]"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => closeDelete(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={typed.trim() !== String(count) || busy}
              onClick={confirmDelete}
              className="border-transparent bg-destructive/15 hover:bg-destructive/25"
            >
              {busy ? "Removing…" : `Remove ${plural(count)}`}
            </Button>
          </>
        }
      >
        <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
          Permanently deletes these trades and all of their fills. This cannot be undone.
        </p>
        <div>
          <label htmlFor={confirmId} className="mb-1.5 block text-2xs text-muted-foreground">
            Type <span className="font-medium text-foreground">{count}</span> to confirm
          </label>
          <FormInput
            id={confirmId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoComplete="off"
            inputMode="numeric"
            aria-label={`Type ${count} to confirm`}
          />
        </div>
      </Modal>
    </>
  );
}
