import { beforeEach, describe, expect, it } from "vite-plus/test";
import { APP_HOTKEYS } from "./hotkeys";
import { getHotkeyKeys, resolveKeys, sanitizeOverrides, useKeybindings } from "./keybindings";

describe("useKeybindings", () => {
  beforeEach(() => {
    useKeybindings.setState({ overrides: {} });
  });

  it("falls back to defaults until a command is rebound", () => {
    expect(getHotkeyKeys()["action-new-trade"]).toBe("c>t");
    useKeybindings.getState().setBinding("action-new-trade", "c>d");
    expect(getHotkeyKeys()["action-new-trade"]).toBe("c>d");
  });

  it("rejects an invalid binding and leaves the old one in place", () => {
    const err = useKeybindings.getState().setBinding("action-new-trade", "escape");
    expect(err).toMatch(/reserved/i);
    expect(getHotkeyKeys()["action-new-trade"]).toBe("c>t");
  });

  it("rejects a binding already used by another command, naming it", () => {
    const err = useKeybindings.getState().setBinding("action-new-trade", "g>h");
    expect(err).toBe("Already used by Home.");
    expect(getHotkeyKeys()["action-new-trade"]).toBe("c>t");
  });

  it("rejects a bare key that would shadow an existing sequence", () => {
    const err = useKeybindings.getState().setBinding("tool-size", "g");
    expect(err).toMatch(/block/i);
  });

  it("drops the override when a command is set back to its default", () => {
    const { setBinding } = useKeybindings.getState();
    setBinding("action-new-trade", "c>d");
    expect(useKeybindings.getState().overrides["action-new-trade"]).toBe("c>d");
    setBinding("action-new-trade", "c>t");
    expect(useKeybindings.getState().overrides["action-new-trade"]).toBeUndefined();
  });

  it("resets one binding and all bindings", () => {
    const { setBinding, resetBinding, resetAll } = useKeybindings.getState();
    setBinding("action-new-trade", "c>d");
    setBinding("tool-size", "mod+shift+j");
    resetBinding("action-new-trade");
    expect(getHotkeyKeys()["action-new-trade"]).toBe("c>t");
    expect(getHotkeyKeys()["tool-size"]).toBe("mod+shift+j");
    resetAll();
    expect(useKeybindings.getState().overrides).toEqual({});
  });
});

describe("sanitizeOverrides", () => {
  it("ignores junk, unknown ids, and invalid bindings", () => {
    expect(sanitizeOverrides(null)).toEqual({});
    expect(sanitizeOverrides({ "not-a-command": "g>x" })).toEqual({});
    expect(sanitizeOverrides({ "tool-size": "escape" })).toEqual({});
    expect(sanitizeOverrides({ "tool-size": 42 })).toEqual({});
  });

  it("normalizes and keeps valid bindings", () => {
    expect(sanitizeOverrides({ "nav-home": "mod+." })).toEqual({ "nav-home": "mod+period" });
  });

  it("drops an override equal to the default", () => {
    expect(sanitizeOverrides({ "action-new-trade": "c>t" })).toEqual({});
  });

  it("drops a stored binding that collides with another command's default", () => {
    expect(sanitizeOverrides({ "tool-size": "g>h" })).toEqual({});
  });

  it("keeps a stored pair that swaps two defaults", () => {
    // Checked against the fully-resolved map: neither half is a real conflict,
    // even though each collides with the other's *default*.
    const swapped = {
      "nav-home": APP_HOTKEYS["nav-trades"].keys,
      "nav-trades": APP_HOTKEYS["nav-home"].keys,
    };
    expect(sanitizeOverrides(swapped)).toEqual(swapped);
    const resolved = resolveKeys(sanitizeOverrides(swapped));
    expect(resolved["nav-home"]).toBe("g>t");
    expect(resolved["nav-trades"]).toBe("g>h");
  });
});
