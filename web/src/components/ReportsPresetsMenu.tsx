import { Bookmark, Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useFilters } from "@/lib/filters";
import {
  captureReportsPreset,
  MAX_PRESET_NAME_LENGTH,
  MAX_PRESETS,
  useReportsPresets,
  useSaveReportsPresets,
  type ReportsSearchState,
  type ReportsViewPreset,
} from "@/lib/reportsPresets";
import { useReportsView } from "@/lib/reportsView";
import { filterChipClass } from "./field-styles";
import { Modal } from "./Modal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "./ui/menu";

/**
 * Saved view switcher — apply, save, update, and delete named snapshots of
 * the Reports view (visible cards + order, range/filters, control modes).
 */
export function ReportsPresetsMenu({
  search,
  onApply,
}: {
  search: ReportsSearchState;
  onApply: (preset: ReportsViewPreset) => void;
}) {
  const { presets } = useReportsPresets();
  const save = useSaveReportsPresets();
  const activePresetId = useReportsView((s) => s.activePresetId);
  const setActivePreset = useReportsView((s) => s.setActivePreset);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  const active = presets.find((p) => p.id === activePresetId);

  const captureCurrent = (presetName: string, id?: string): ReportsViewPreset => {
    const f = useFilters.getState();
    return captureReportsPreset({
      name: presetName,
      id,
      search,
      filters: {
        from: f.from,
        to: f.to,
        symbols: f.symbols,
        tagIds: f.tagIds,
        markets: f.markets,
        tradeStatus: f.tradeStatus,
      },
      cards: useReportsView.getState().cards,
    });
  };

  const saveNew = () => {
    const trimmed = name.trim();
    if (!trimmed || presets.length >= MAX_PRESETS) return;
    const preset = captureCurrent(trimmed);
    save.mutate([...presets, preset], {
      onSuccess: () => setActivePreset(preset.id),
    });
    setSaveOpen(false);
    setName("");
  };

  const updateActive = () => {
    if (!active) return;
    save.mutate(presets.map((p) => (p.id === active.id ? captureCurrent(p.name, p.id) : p)));
  };

  const deleteActive = () => {
    if (!active) return;
    save.mutate(
      presets.filter((p) => p.id !== active.id),
      { onSuccess: () => setActivePreset(undefined) },
    );
  };

  return (
    <>
      <Menu>
        <MenuTrigger
          aria-label="Saved views"
          className={cn(filterChipClass, "cursor-pointer", active && "bg-accent")}
        >
          <Bookmark size={14} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
          <span className="max-w-32 truncate">{active ? active.name : "Presets"}</span>
          <ChevronDown size={12} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
        </MenuTrigger>
        <MenuPopup align="end" className="w-56">
          {presets.length > 0 ? (
            presets.map((p) => (
              <MenuItem key={p.id} onClick={() => onApply(p)}>
                <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
                  {p.id === activePresetId && <Check size={14} strokeWidth={2} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
              </MenuItem>
            ))
          ) : (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No saved views yet — set up the view, then save it here.
            </p>
          )}
          <MenuSeparator />
          <MenuItem
            disabled={presets.length >= MAX_PRESETS}
            onClick={() => {
              setName("");
              setSaveOpen(true);
            }}
          >
            {presets.length >= MAX_PRESETS
              ? `Save (limit of ${MAX_PRESETS} reached)`
              : "Save current view…"}
          </MenuItem>
          {active && (
            <>
              <MenuItem onClick={updateActive}>Update “{active.name}”</MenuItem>
              <MenuItem variant="destructive" onClick={deleteActive}>
                Delete “{active.name}”
              </MenuItem>
            </>
          )}
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
            maxLength={MAX_PRESET_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning review"
            aria-label="Preset name"
          />
          <p className="text-xs text-muted-foreground">
            Saves the visible cards, their order, and the current date range and filters.
          </p>
        </form>
      </Modal>
    </>
  );
}
