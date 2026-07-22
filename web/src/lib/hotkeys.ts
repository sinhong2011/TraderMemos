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
          .map((part) => part.trim().toUpperCase())
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

      const keyLabel =
        key === "escape" || key === "esc"
          ? "esc"
          : key === "enter" || key === "return"
            ? "↵"
            : key === "up"
              ? "↑"
              : key === "down"
                ? "↓"
                : key === "left"
                  ? "←"
                  : key === "right"
                    ? "→"
                    : // react-hotkeys-hook splits alternate bindings on `,`, so use `comma`
                      key === "," || key === "comma"
                      ? ","
                      : key.toUpperCase();

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
  "nav-dashboard": { keys: "g>d", label: formatHotkeyLabel("g>d") },
  "nav-trades": { keys: "g>t", label: formatHotkeyLabel("g>t") },
  "nav-calendar": { keys: "g>c", label: formatHotkeyLabel("g>c") },
  "nav-stats": { keys: "g>s", label: formatHotkeyLabel("g>s") },
  "nav-playbook": { keys: "g>p", label: formatHotkeyLabel("g>p") },
  "nav-calculator": { keys: "g>r", label: formatHotkeyLabel("g>r") },
  "nav-import": { keys: "g>i", label: formatHotkeyLabel("g>i") },
  // `mod+,` is unsafe: the library delimiter is `,`, so use the `comma` alias.
  "nav-settings": { keys: "mod+comma", label: formatHotkeyLabel("mod+comma") },
  "action-new-trade": { keys: "n", label: formatHotkeyLabel("n") },
  "action-new-setup": { keys: "shift+s", label: formatHotkeyLabel("shift+s") },
  "action-new-note": { keys: "shift+n", label: formatHotkeyLabel("shift+n") },
  "tool-size": { keys: "mod+shift+p", label: formatHotkeyLabel("mod+shift+p") },
} as const satisfies Record<string, HotkeyBinding>;

export type AppHotkeyId = keyof typeof APP_HOTKEYS;
