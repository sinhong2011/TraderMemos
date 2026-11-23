import { Bookmark, Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  captureTradesView,
  MAX_VIEW_NAME_LENGTH,
  MAX_VIEWS,
  resolveTradesView,
  useSaveTradesViews,
  useTradesViews,
  useTradesViewSession,
  viewMatches,
  type TradesSavedView,
  type TradesViewState,
} from "@/lib/tradeViews";
import { Modal } from "./Modal";
import { UNDO_TOAST_MS, useToastManager } from "./Toast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "./ui/menu";

/**
 * Saved views for the trade log — named snapshots of the filters, date range,
 * sort and hidden columns, synced with the account preferences so a view made
 * on the laptop is there on the phone.
 *
 * The check mark is derived (does the page show exactly what the view
 * restores?) rather than remembered, so editing a filter by hand drops it.
 * The last applied view is remembered only to offer "Update" once the page
 * has drifted from it.
 */
export function TradesViewsMenu({
  state,
  onApply,
  className,
  iconOnly = false,
}: {
  state: TradesViewState;
  onApply: (state: TradesViewState) => void;
  className?: string;
  iconOnly?: boolean;
}) {
  const { views } = useTradesViews();
  const save = useSaveTradesViews();
  const toast = useToastManager();
  const lastAppliedId = useTradesViewSession((s) => s.lastAppliedId);
  const setLastApplied = useTradesViewSession((s) => s.setLastApplied);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  const matching = views.find((v) => viewMatches(v, state));
  const lastApplied = views.find((v) => v.id === lastAppliedId);
  // The view the page grew out of, now edited — the one "Update" overwrites.
  const drifted = lastApplied && lastApplied.id !== matching?.id ? lastApplied : undefined;
  const label = matching?.name ?? drifted?.name ?? "Views";
  const atLimit = views.length >= MAX_VIEWS;

  function failed() {
    toast.add({ title: "Could not save views", description: "Try again in a moment" });
  }

  function apply(view: TradesSavedView) {
    setLastApplied(view.id);
    onApply(resolveTradesView(view));
  }

  function saveNew() {
    const trimmed = name.trim();
    if (!trimmed || atLimit) return;
    const view = captureTradesView({ name: trimmed, state });
    save.mutate([...views, view], {
      onSuccess: () => {
        setLastApplied(view.id);
        toast.add({ title: "View saved", description: view.name });
      },
      onError: failed,
    });
    setSaveOpen(false);
    setName("");
  }

  function update(target: TradesSavedView) {
    const next = captureTradesView({ name: target.name, id: target.id, state });
    save.mutate(
      views.map((v) => (v.id === target.id ? next : v)),
      {
        onSuccess: () => toast.add({ title: "View updated", description: target.name }),
        onError: failed,
      },
    );
  }

  function remove(target: TradesSavedView) {
    const before = views;
    save.mutate(
      views.filter((v) => v.id !== target.id),
      {
        onSuccess: () => {
          if (lastAppliedId === target.id) setLastApplied(undefined);
          const toastId: string = toast.add({
            title: "View deleted",
            description: target.name,
            // Long enough to read the result and reach Undo.
            timeout: UNDO_TOAST_MS,
            actionProps: {
              children: "Undo",
              onClick: () => {
                toast.close(toastId);
                save.mutate(before, {
                  onSuccess: () => toast.add({ title: "View restored", description: target.name }),
                  onError: failed,
                });
              },
            },
          });
        },
        onError: failed,
      },
    );
  }

  const target = matching ?? drifted;

  return (
    <>
      <Menu>
        <MenuTrigger
          aria-label={`Saved views${matching ? `: ${matching.name}` : ""}`}
          className={cn(
            "inline-flex cursor-pointer items-center rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Bookmark
            size={14}
            strokeWidth={1.75}
            className={cn("shrink-0", matching ? "text-primary" : "text-muted-foreground")}
            aria-hidden
          />
          {iconOnly ? null : (
            <>
              <span className="max-w-36 truncate">{label}</span>
              {drifted && !matching ? (
                <span className="text-2xs text-muted-foreground">edited</span>
              ) : null}
              <ChevronDown
                size={12}
                strokeWidth={1.75}
                className="shrink-0 text-muted-foreground"
                aria-hidden
              />
            </>
          )}
        </MenuTrigger>
        <MenuPopup align="start" className="w-60">
          {views.length > 0 ? (
            views.map((v) => (
              <MenuItem key={v.id} onClick={() => apply(v)}>
                <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
                  {v.id === matching?.id ? <Check size={14} strokeWidth={2} /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{v.name}</span>
              </MenuItem>
            ))
          ) : (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No saved views yet. Set filters, sort and columns, then save them here.
            </p>
          )}
          <MenuSeparator />
          <MenuItem
            disabled={atLimit}
            onClick={() => {
              setName("");
              setSaveOpen(true);
            }}
          >
            {atLimit ? `Save (limit of ${MAX_VIEWS} reached)` : "Save current view…"}
          </MenuItem>
          {drifted ? (
            <MenuItem onClick={() => update(drifted)}>Update “{drifted.name}”</MenuItem>
          ) : null}
          {target ? (
            <MenuItem variant="destructive" onClick={() => remove(target)}>
              Delete “{target.name}”
            </MenuItem>
          ) : null}
        </MenuPopup>
      </Menu>

      <Modal
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save view"
        className="max-w-sm"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveNew} disabled={!name.trim()}>
              Save
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveNew();
          }}
          className="flex flex-col gap-2"
        >
          <Input
            autoFocus
            value={name}
            maxLength={MAX_VIEW_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. A+ futures this month"
            aria-label="View name"
          />
          <p className="text-xs text-muted-foreground">
            Saves the date range, filters, sort order and hidden columns.
          </p>
        </form>
      </Modal>
    </>
  );
}
