import { describe, expect, it } from "vite-plus/test";
import { APP_HOTKEYS, formatHotkeyLabel } from "./hotkeys";

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
    expect(APP_HOTKEYS["action-new-trade"].keys).toBe("n");
    expect(APP_HOTKEYS["tool-size"].keys).toBe("mod+shift+p");
  });
});
