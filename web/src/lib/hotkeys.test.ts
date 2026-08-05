import { describe, expect, it } from "vite-plus/test";
import {
  APP_HOTKEYS,
  findHotkeyConflict,
  formatHotkeyLabel,
  hotkeyStepFromEvent,
  parseHotkey,
  serializeHotkey,
  validateHotkey,
} from "./hotkeys";

describe("formatHotkeyLabel", () => {
  it("formats mod combinations for Apple", () => {
    expect(formatHotkeyLabel("mod+k", true)).toBe("⌘K");
    expect(formatHotkeyLabel("mod+comma", true)).toBe("⌘,");
    expect(formatHotkeyLabel("mod+shift+p", true)).toBe("⇧⌘P");
  });

  it("formats mod combinations for non-Apple", () => {
    expect(formatHotkeyLabel("mod+k", false)).toBe("Ctrl+K");
    expect(formatHotkeyLabel("mod+shift+p", false)).toBe("Ctrl+Shift+P");
  });

  it("formats sequences and shift chords", () => {
    expect(formatHotkeyLabel("g>d", true)).toBe("G D");
    expect(formatHotkeyLabel("shift+n", true)).toBe("⇧N");
    expect(formatHotkeyLabel("n", true)).toBe("N");
  });
});

describe("APP_HOTKEYS", () => {
  it("covers palette, navigation, actions, and position size", () => {
    expect(APP_HOTKEYS.palette.keys).toBe("mod+k");
    expect(APP_HOTKEYS["nav-home"].keys).toBe("g>h");
    expect(APP_HOTKEYS["nav-settings"].keys).toBe("mod+comma");
    expect(APP_HOTKEYS["action-new-trade"].keys).toBe("c>t");
    expect(APP_HOTKEYS["tool-size"].keys).toBe("mod+shift+p");
  });

  it("ships no bare single-letter defaults", () => {
    for (const binding of Object.values(APP_HOTKEYS)) {
      const steps = parseHotkey(binding.keys);
      const bareSingle = steps.length === 1 && !steps[0]!.mod && !steps[0]!.alt && !steps[0]!.shift;
      expect(bareSingle).toBe(false);
    }
  });

  it("has no internal conflicts", () => {
    const keys = Object.fromEntries(Object.entries(APP_HOTKEYS).map(([id, b]) => [id, b.keys]));
    for (const [id, k] of Object.entries(keys)) {
      expect(findHotkeyConflict(keys, id, k)).toBeNull();
    }
  });
});

describe("parseHotkey / serializeHotkey", () => {
  it("round-trips combos and sequences", () => {
    for (const keys of ["mod+k", "mod+shift+p", "g>h", "c>t", "mod+comma", "n"]) {
      expect(serializeHotkey(parseHotkey(keys))).toBe(keys);
    }
  });

  it("normalizes punctuation aliases", () => {
    expect(serializeHotkey(parseHotkey("mod+,"))).toBe("mod+comma");
    expect(parseHotkey("g>h")).toHaveLength(2);
  });
});

describe("validateHotkey", () => {
  const ok = (keys: string) => validateHotkey(parseHotkey(keys));

  it("accepts combos and modifier-free pairs", () => {
    expect(ok("mod+shift+j")).toBeNull();
    expect(ok("g>h")).toBeNull();
    expect(ok("n")).toBeNull();
  });

  it("rejects browser-reserved combos", () => {
    expect(ok("mod+w")).toMatch(/reserved/i);
    expect(ok("mod+shift+n")).toMatch(/reserved/i);
  });

  it("rejects bare keys the browser needs", () => {
    expect(ok("escape")).toMatch(/reserved/i);
    expect(ok("tab")).toMatch(/reserved/i);
    expect(ok("enter")).toMatch(/reserved/i);
  });

  it("rejects modifiers inside a sequence and over-long sequences", () => {
    expect(ok("mod+g>h")).toMatch(/modifiers/i);
    expect(ok("g>h>j")).toMatch(/two keys/i);
  });
});

describe("findHotkeyConflict", () => {
  const bindings = { a: "g>h", b: "mod+k", c: "n" };

  it("finds exact duplicates regardless of spelling", () => {
    expect(findHotkeyConflict(bindings, "x", "mod+k")).toEqual({ id: "b", reason: "duplicate" });
  });

  it("ignores the binding's own id", () => {
    expect(findHotkeyConflict(bindings, "b", "mod+k")).toBeNull();
  });

  it("catches a bare key that would shadow an existing sequence", () => {
    // `g` alone fires before `g` `h` can ever complete.
    expect(findHotkeyConflict(bindings, "x", "g")).toEqual({ id: "a", reason: "shadow" });
  });

  it("catches a sequence blocked by an existing bare key", () => {
    expect(findHotkeyConflict(bindings, "x", "n>t")).toEqual({ id: "c", reason: "shadowed" });
  });

  it("allows sequences that share a prefix", () => {
    expect(findHotkeyConflict(bindings, "x", "g>t")).toBeNull();
  });
});

describe("hotkeyStepFromEvent", () => {
  const ev = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

  it("reads the physical key so shift doesn't change the base", () => {
    expect(hotkeyStepFromEvent(ev({ key: "N", code: "KeyN", shiftKey: true }))).toEqual({
      mod: false,
      alt: false,
      shift: true,
      key: "n",
    });
  });

  it("maps punctuation and treats meta or ctrl as mod", () => {
    expect(hotkeyStepFromEvent(ev({ key: ",", code: "Comma", metaKey: true }))?.key).toBe("comma");
    expect(hotkeyStepFromEvent(ev({ key: "k", code: "KeyK", ctrlKey: true }))?.mod).toBe(true);
  });

  it("returns null while only a modifier is held", () => {
    expect(hotkeyStepFromEvent(ev({ key: "Shift", code: "ShiftLeft", shiftKey: true }))).toBeNull();
  });
});
