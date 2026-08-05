import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  APP_HOTKEYS,
  APP_HOTKEY_IDS,
  type AppHotkeyId,
  formatHotkeyLabel,
  type HotkeyBinding,
  findHotkeyConflict,
  isAppHotkeyId,
  parseHotkey,
  serializeHotkey,
  validateHotkey,
} from "./hotkeys";

export const KEYBINDINGS_STORAGE_KEY = "tm-keybindings";

/** Only commands the user has actually rebound are stored; the rest fall back to defaults. */
export type KeybindingOverrides = Partial<Record<AppHotkeyId, string>>;

interface KeybindingsState {
  overrides: KeybindingOverrides;
  /** Returns an error message when the binding is unusable, else null. */
  setBinding: (id: AppHotkeyId, keys: string) => string | null;
  resetBinding: (id: AppHotkeyId) => void;
  resetAll: () => void;
}

/** Default keys map, used for conflict checks and as the fallback for every id. */
export function defaultKeys(): Record<AppHotkeyId, string> {
  return Object.fromEntries(APP_HOTKEY_IDS.map((id) => [id, APP_HOTKEYS[id].keys])) as Record<
    AppHotkeyId,
    string
  >;
}

/** Resolve overrides over defaults into a plain `id → keys` map. */
export function resolveKeys(overrides: KeybindingOverrides): Record<AppHotkeyId, string> {
  const resolved = defaultKeys();
  for (const id of APP_HOTKEY_IDS) {
    const custom = overrides[id];
    if (custom) resolved[id] = custom;
  }
  return resolved;
}

/**
 * Drop stored entries that no longer make sense — an unknown command id (a
 * shortcut removed in a later build), a binding that fails validation, or one
 * that now collides with another stored binding. Anything dropped falls back to
 * its default rather than leaving the user with a shortcut that never fires.
 */
export function sanitizeOverrides(raw: unknown): KeybindingOverrides {
  if (!raw || typeof raw !== "object") return {};

  const clean: KeybindingOverrides = {};
  for (const [id, keys] of Object.entries(raw as Record<string, unknown>)) {
    if (!isAppHotkeyId(id) || typeof keys !== "string") continue;
    const steps = parseHotkey(keys);
    if (validateHotkey(steps) !== null) continue;
    const normalized = serializeHotkey(steps);
    // Already the default for this id — nothing to override.
    if (normalized === serializeHotkey(parseHotkey(APP_HOTKEYS[id].keys))) continue;
    clean[id] = normalized;
  }

  // Conflicts are resolved against the fully-resolved map, not incrementally:
  // a stored pair that swaps two defaults is internally consistent, and checking
  // one entry at a time against the untouched defaults would reject both.
  for (const id of APP_HOTKEY_IDS) {
    if (clean[id] === undefined) continue;
    const resolved = resolveKeys(clean);
    if (findHotkeyConflict(resolved, id, resolved[id]) !== null) delete clean[id];
  }
  return clean;
}

export const useKeybindings = create<KeybindingsState>()(
  persist(
    (set, get) => ({
      overrides: {},
      setBinding: (id, keys) => {
        const steps = parseHotkey(keys);
        const invalid = validateHotkey(steps);
        if (invalid) return invalid;

        const normalized = serializeHotkey(steps);
        const current = resolveKeys(get().overrides);
        const conflict = findHotkeyConflict(current, id, normalized);
        if (conflict) {
          const label = isAppHotkeyId(conflict.id) ? hotkeyCommandName(conflict.id) : conflict.id;
          return conflict.reason === "duplicate"
            ? `Already used by ${label}.`
            : `Conflicts with ${label} — one shortcut would block the other.`;
        }

        set((s) => {
          const next = { ...s.overrides };
          if (normalized === serializeHotkey(parseHotkey(APP_HOTKEYS[id].keys))) delete next[id];
          else next[id] = normalized;
          return { overrides: next };
        });
        return null;
      },
      resetBinding: (id) =>
        set((s) => {
          const next = { ...s.overrides };
          delete next[id];
          return { overrides: next };
        }),
      resetAll: () => set({ overrides: {} }),
    }),
    {
      name: KEYBINDINGS_STORAGE_KEY,
      partialize: (s) => ({ overrides: s.overrides }),
      merge: (persisted, current) => ({
        ...current,
        overrides: sanitizeOverrides((persisted as { overrides?: unknown } | undefined)?.overrides),
      }),
    },
  ),
);

/** Non-reactive read for event handlers. */
export function getHotkeyKeys(): Record<AppHotkeyId, string> {
  return resolveKeys(useKeybindings.getState().overrides);
}

/**
 * Resolved bindings with display labels. Subscribes to `overrides` only, which
 * keeps a stable reference between edits, so the memo below is safe.
 */
export function useHotkeyBindings(): Record<AppHotkeyId, HotkeyBinding> {
  const overrides = useKeybindings((s) => s.overrides);
  return useMemo(() => {
    const keys = resolveKeys(overrides);
    return Object.fromEntries(
      APP_HOTKEY_IDS.map((id) => [id, { keys: keys[id], label: formatHotkeyLabel(keys[id]) }]),
    ) as Record<AppHotkeyId, HotkeyBinding>;
  }, [overrides]);
}

/** Label for a single command's binding. */
export function useHotkeyLabel(id: AppHotkeyId): string {
  return useHotkeyBindings()[id].label;
}

/** Whether a command is currently on a non-default binding. */
export function useIsCustomBinding(id: AppHotkeyId): boolean {
  return useKeybindings((s) => s.overrides[id] !== undefined);
}

/** Human-readable command names for the settings list and conflict messages. */
const HOTKEY_COMMAND_NAMES: Record<AppHotkeyId, string> = {
  palette: "Command palette",
  "nav-home": "Home",
  "nav-trades": "Trades",
  "nav-calendar": "Calendar",
  "nav-stats": "Reports",
  "nav-playbook": "Playbook",
  "nav-notes": "Notes",
  "nav-calculator": "Calculator",
  "nav-import ": "Import",
  "nav-settings": "Settings",
  "action-new-trade": "New trade",
  "action-new-setup": "New setup",
  "action-new-note": "New note",
  "tool-size": "Position size",
};

export function hotkeyCommandName(id: AppHotkeyId): string {
  return HOTKEY_COMMAND_NAMES[id];
}

export interface HotkeyGroup {
  title: string;
  ids: AppHotkeyId[];
}

/** Display grouping for Settings → Shortcuts. */
export const HOTKEY_GROUPS: HotkeyGroup[] = [
  {
    title: "Navigation",
    ids: [
      "nav-home",
      "nav-trades",
      "nav-calendar",
      "nav-stats",
      "nav-playbook",
      "nav-notes",
      "nav-calculator",
      "nav-import ",
      "nav-settings",
    ],
  },
  { title: "Actions", ids: ["action-new-trade", "action-new-note", "action-new-setup"] },
  { title: "Tools", ids: ["palette", "tool-size"] },
];
