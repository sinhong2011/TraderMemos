/** Cross-platform primary modifier (⌘ on Mac, Ctrl elsewhere). */
export const MOD = "mod";

export interface HotkeyBinding {
  /** react-hotkeys-hook key string, e.g. `mod+k` or `g>d`. */
  keys: string;
  /** Display label shown in the palette / chrome, e.g. `⌘K` or `G D`. */
  label: string;
}

function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return true;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

/**
 * Display glyph for a single base key. `key` is always a normalized base name
 * (see `normalizeHotkeyKey`), never a shifted character — `shift+comma` renders
 * as `⇧,` rather than `<`, because that is what the user pressed.
 */
function keyGlyph(key: string): string {
  const named: Record<string, string> = {
    escape: "esc",
    esc: "esc",
    enter: "↵",
    return: "↵",
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
    space: "Space",
    comma: ",",
    period: ".",
    slash: "/",
    semicolon: ";",
    quote: "'",
    backslash: "\\",
    backquote: "`",
    minus: "-",
    equal: "=",
    bracketleft: "[",
    bracketright: "]",
    tab: "⇥",
    backspace: "⌫",
    delete: "⌦",
  };
  return named[key] ?? key.toUpperCase();
}

/** Format a react-hotkeys-hook binding for UI badges. */
export function formatHotkeyLabel(keys: string, apple = isApplePlatform()): string {
  // Split alternate bindings on ", " only — a trailing "," is a literal key (e.g. mod+,).
  return keys
    .split(", ")
    .map((combo) => combo.trim())
    .filter(Boolean)
    .map((combo) => {
      if (combo.includes(">")) {
        return combo
          .split(">")
          .map((part) => keyGlyph(part.trim().toLowerCase()))
          .join(" ");
      }

      const parts = combo
        .toLowerCase()
        .split("+")
        .map((p) => p.trim());
      const key = parts[parts.length - 1] ?? "";
      const mods = parts.slice(0, -1);

      const glyphs: string[] = [];
      if (mods.includes("ctrl") || (mods.includes("mod") && !apple)) glyphs.push("Ctrl");
      if (mods.includes("alt")) glyphs.push(apple ? "⌥" : "Alt");
      if (mods.includes("shift")) glyphs.push(apple ? "⇧" : "Shift");
      if (mods.includes("meta") || (mods.includes("mod") && apple)) glyphs.push("⌘");

      // react-hotkeys-hook splits alternate bindings on `,`, so `,` arrives as `comma`.
      const keyLabel = keyGlyph(key === "," ? "comma" : key);

      if (!apple && glyphs.some((g) => g === "Ctrl" || g === "Alt" || g === "Shift")) {
        return [...glyphs, keyLabel].join("+");
      }
      return `${glyphs.join("")}${keyLabel}`;
    })
    .join(" / ");
}

/** Global app hotkeys keyed by command id (or `palette`). */
export const APP_HOTKEYS = {
  palette: { keys: "mod+k", label: formatHotkeyLabel("mod+k") },
  "nav-home": { keys: "g>h", label: formatHotkeyLabel("g>h") },
  "nav-trades": { keys: "g>t", label: formatHotkeyLabel("g>t") },
  "nav-calendar": { keys: "g>c", label: formatHotkeyLabel("g>c") },
  "nav-stats": { keys: "g>s", label: formatHotkeyLabel("g>s") },
  "nav-playbook": { keys: "g>p", label: formatHotkeyLabel("g>p") },
  "nav-notes": { keys: "g>n", label: formatHotkeyLabel("g>n") },
  "nav-calculator": { keys: "g>r", label: formatHotkeyLabel("g>r") },
  "nav-import ": { keys: "g>i", label: formatHotkeyLabel("g>i") },
  // `mod+,` is unsafe: the library delimiter is `,`, so use the `comma` alias.
  "nav-settings": { keys: "mod+comma", label: formatHotkeyLabel("mod+comma") },
  // `c` = create, second letter = what — mirrors the `g` navigation prefix.
  // Bare letters are deliberately not defaults: they collide with typing, and a
  // global listener that has to guess "is this a text field?" gets it wrong.
  "action-new-trade": { keys: "c>t", label: formatHotkeyLabel("c>t") },
  "action-new-setup": { keys: "c>s", label: formatHotkeyLabel("c>s") },
  "action-new-note": { keys: "c>n", label: formatHotkeyLabel("c>n") },
  "tool-size": { keys: "mod+shift+p", label: formatHotkeyLabel("mod+shift+p") },
} as const satisfies Record<string, HotkeyBinding>;

export type AppHotkeyId = keyof typeof APP_HOTKEYS;

export const APP_HOTKEY_IDS = Object.keys(APP_HOTKEYS) as AppHotkeyId[];

export function isAppHotkeyId(id: string): id is AppHotkeyId {
  return id in APP_HOTKEYS;
}

/* ------------------------------------------------------------------ *
 * Binding grammar
 *
 * A binding is one or two steps. One step may carry modifiers (`mod+shift+p`);
 * two steps are a typed sequence and must be modifier-free (`g>h`), because
 * react-hotkeys-hook matches sequences on bare keys only.
 * ------------------------------------------------------------------ */

export interface HotkeyStep {
  /** ⌘ on Apple, Ctrl elsewhere. */
  mod: boolean;
  alt: boolean;
  shift: boolean;
  /** Normalized base key, e.g. `k`, `7`, `comma`, `escape`. */
  key: string;
}

/** Base-key aliases, so `,` and `Comma` and `comma` all land on one name. */
const KEY_ALIASES: Record<string, string> = {
  ",": "comma",
  ".": "period",
  "/": "slash",
  ";": "semicolon",
  "'": "quote",
  "\\": "backslash",
  "`": "backquote",
  "-": "minus",
  "=": "equal",
  "[": "bracketleft",
  "]": "bracketright",
  " ": "space",
  spacebar: "space",
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  del: "delete",
  esc: "escape",
  return: "enter",
};

export function normalizeHotkeyKey(key: string): string {
  const lower = key.toLowerCase();
  return KEY_ALIASES[lower] ?? lower;
}

const MODIFIER_KEYS = new Set(["control", "ctrl", "meta", "command", "alt", "option", "shift"]);

const NON_ALNUM_CODES: Record<string, string> = {
  Comma: "comma",
  Period: "period",
  Slash: "slash",
  Semicolon: "semicolon",
  Quote: "quote",
  Backslash: "backslash",
  Backquote: "backquote",
  Minus: "minus",
  Equal: "equal",
  BracketLeft: "bracketleft",
  BracketRight: "bracketright",
  Space: "space",
  Enter: "enter",
  Escape: "escape",
  Tab: "tab",
  Backspace: "backspace",
  Delete: "delete",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * Base key for a keyboard event. Letters and digits come from `code` so that
 * `⇧n` reports `n` (not `N`) and `⇧,` reports `comma` (not `<`) — the binding
 * records which physical key was pressed alongside the modifier.
 */
export function hotkeyKeyFromEvent(e: KeyboardEvent): string | null {
  const code = e.code ?? "";
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F[0-9]{1,2}$/.test(code)) return code.toLowerCase();
  if (code && code in NON_ALNUM_CODES) return NON_ALNUM_CODES[code]!;

  const key = e.key ?? "";
  if (!key || MODIFIER_KEYS.has(key.toLowerCase())) return null;
  return normalizeHotkeyKey(key);
}

/** Read a keydown into a single binding step, or null for a bare modifier press. */
export function hotkeyStepFromEvent(e: KeyboardEvent): HotkeyStep | null {
  const key = hotkeyKeyFromEvent(e);
  if (key === null) return null;
  return {
    mod: e.metaKey || e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey,
    key,
  };
}

export function parseHotkey(keys: string): HotkeyStep[] {
  return keys
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const tokens = part
        .toLowerCase()
        .split("+")
        .map((t) => t.trim())
        .filter(Boolean);
      const raw = tokens[tokens.length - 1] ?? "";
      const mods = tokens.slice(0, -1);
      return {
        mod: mods.includes("mod") || mods.includes("meta") || mods.includes("ctrl"),
        alt: mods.includes("alt"),
        shift: mods.includes("shift"),
        key: normalizeHotkeyKey(raw),
      };
    });
}

export function serializeHotkey(steps: readonly HotkeyStep[]): string {
  return steps
    .map((s) => {
      const parts: string[] = [];
      if (s.mod) parts.push("mod");
      if (s.alt) parts.push("alt");
      if (s.shift) parts.push("shift");
      parts.push(s.key);
      return parts.join("+");
    })
    .join(">");
}

export function hasModifier(step: HotkeyStep): boolean {
  return step.mod || step.alt || step.shift;
}

/**
 * Combos the browser or OS takes before the page sees them. Binding these
 * produces a shortcut that silently never fires, so they are refused outright.
 */
const RESERVED_COMBOS = new Set([
  "mod+w",
  "mod+q",
  "mod+t",
  "mod+n",
  "mod+r",
  "mod+l",
  "mod+d",
  "mod+p",
  "mod+shift+n",
  "mod+shift+t",
  "mod+shift+w",
  "mod+shift+q",
  "mod+tab",
]);

/**
 * Keys that must keep their native meaning when pressed alone — rebinding these
 * bare would break closing dialogs, focus traversal, scrolling, or form submit.
 */
const PROTECTED_BARE_KEYS = new Set([
  "escape",
  "tab",
  "enter",
  "space",
  "backspace",
  "delete",
  "up",
  "down",
  "left",
  "right",
]);

/** `null` when the binding is usable, otherwise a message for the user. */
export function validateHotkey(steps: readonly HotkeyStep[]): string | null {
  if (steps.length === 0) return "Press a key combination.";
  if (steps.length > 2) return "A shortcut can be at most two keys.";
  if (steps.some((s) => !s.key)) return "Press a key combination.";

  if (steps.length === 2) {
    if (steps.some(hasModifier)) {
      return "Two-key shortcuts can't use modifiers — try a plain letter pair like G H.";
    }
    if (steps.some((s) => PROTECTED_BARE_KEYS.has(s.key))) {
      return `${keyGlyph(steps.find((s) => PROTECTED_BARE_KEYS.has(s.key))!.key)} can't be part of a two-key shortcut.`;
    }
    return null;
  }

  const [step] = steps as [HotkeyStep];
  if (!hasModifier(step) && PROTECTED_BARE_KEYS.has(step.key)) {
    return `${keyGlyph(step.key)} is reserved by the browser.`;
  }
  if (RESERVED_COMBOS.has(serializeHotkey(steps))) {
    return `${formatHotkeyLabel(serializeHotkey(steps))} is reserved by the browser.`;
  }
  return null;
}

export interface HotkeyConflict {
  /** The other command this binding collides with. */
  id: string;
  reason: "duplicate" | "shadow" | "shadowed";
}

/**
 * Find the first command whose binding collides with `keys`.
 *
 * Beyond exact duplicates this catches prefix shadowing: a one-step `g` fires
 * immediately and the `g` `h` sequence after it can never complete, so the two
 * cannot coexist in either order.
 */
export function findHotkeyConflict(
  bindings: Readonly<Record<string, string>>,
  id: string,
  keys: string,
): HotkeyConflict | null {
  const steps = parseHotkey(keys);
  if (steps.length === 0) return null;
  const normalized = serializeHotkey(steps);

  for (const [otherId, otherKeys] of Object.entries(bindings)) {
    if (otherId === id) continue;
    const otherSteps = parseHotkey(otherKeys);
    if (otherSteps.length === 0) continue;
    if (serializeHotkey(otherSteps) === normalized) return { id: otherId, reason: "duplicate" };

    const first = serializeHotkey([steps[0]!]);
    const otherFirst = serializeHotkey([otherSteps[0]!]);
    if (steps.length === 1 && otherSteps.length === 2 && first === otherFirst) {
      return { id: otherId, reason: "shadow" };
    }
    if (steps.length === 2 && otherSteps.length === 1 && first === otherFirst) {
      return { id: otherId, reason: "shadowed" };
    }
  }
  return null;
}
