"use no memo";

import { useNavigate } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import { useHotkeyBindings } from "./keybindings";
import { useToolRunner } from "./useToolRunner";
import { useUI } from "./ui";

const CAPTURE = { capture: true } as const;

function eventTarget(e: KeyboardEvent): HTMLElement | null {
  const path = typeof e.composedPath === "function" ? e.composedPath() : [];
  const top = path[0];
  if (top instanceof HTMLElement) return top;
  return e.target instanceof HTMLElement ? e.target : null;
}

/** True when the key event is typing into a real text field (not our empty palette). */
export function isTypingContext(e: KeyboardEvent): boolean {
  const el = eventTarget(e);
  if (!el) return false;

  // Empty command-palette search — treat chords as commands, not typing.
  if (el.hasAttribute("cmdk-input")) {
    return (el as HTMLInputElement).value.trim().length > 0;
  }

  if (el.isContentEditable) return true;

  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const input = el as HTMLInputElement;
    // Base UI Select / decoy fields — not real typing surfaces.
    if (input.getAttribute("aria-hidden") === "true") return false;
    if (input.id.endsWith("-hidden-input")) return false;
    if (input.readOnly || input.disabled) return false;

    const type = (input.type || "text").toLowerCase();
    // Allow hotkeys on non-text inputs (checkbox, button, etc.)
    return ![
      "button",
      "checkbox",
      "radio",
      "submit",
      "reset",
      "file",
      "image",
      "hidden",
      "range",
      "color",
    ].includes(type);
  }

  const role = el.getAttribute("role");
  return role === "textbox" || role === "searchbox" || role === "spinbutton";
}

function drawerOrModalOpen(): boolean {
  const { modal, positionSizeOpen } = useUI.getState();
  return modal !== null || positionSizeOpen;
}

/**
 * Global command shortcuts, resolved from the user's keybindings (Settings →
 * Shortcuts) with the built-in defaults as fallback. Listeners stay attached
 * and every gated command runs behind `guarded`, so shortcuts work on the page
 * and inside an empty palette but never while typing or over an open drawer.
 */
export function useAppHotkeys() {
  const navigate = useNavigate();
  const openModal = useUI((s) => s.openModal);
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const runTool = useToolRunner();
  const keys = useHotkeyBindings();

  const blockWhenTypingOrOverlay = (e: KeyboardEvent) => drawerOrModalOpen() || isTypingContext(e);

  /**
   * react-hotkeys-hook only consults `ignoreEventWhen` on the combo branch — its
   * sequence branch fires with no gate at all (v5.3.3), so `g` `h` would trigger
   * on the "gh" inside a word like "bought". Every gated command re-checks the
   * guard here, where it applies to sequences too.
   */
  const guarded = (run: () => void) => (e: KeyboardEvent) => {
    if (blockWhenTypingOrOverlay(e)) return;
    run();
  };

  // Palette — always available, including while typing
  useHotkeys(
    keys.palette.keys,
    () => setCommandOpen(!useUI.getState().commandOpen),
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
      eventListenerOptions: CAPTURE,
    },
    [setCommandOpen, keys.palette.keys],
  );

  const pageChord = {
    enableOnFormTags: true,
    preventDefault: true,
    eventListenerOptions: CAPTURE,
    ignoreEventWhen: blockWhenTypingOrOverlay,
  } as const;

  const go = (to: string, search?: Record<string, string>) =>
    guarded(() => {
      useUI.getState().setCommandOpen(false);
      void navigate(search ? { to, search } : { to });
    });

  // Navigation — skip while typing / overlays
  useHotkeys(keys["nav-home"].keys, go("/home"), pageChord, [navigate, keys["nav-home"].keys]);
  useHotkeys(keys["nav-trades"].keys, go("/trades"), pageChord, [
    navigate,
    keys["nav-trades"].keys,
  ]);
  useHotkeys(keys["nav-calendar"].keys, go("/calendar"), pageChord, [
    navigate,
    keys["nav-calendar"].keys,
  ]);
  useHotkeys(
    keys["nav-stats"].keys,
    go("/reports", {
      tab: "overview",
      side: "all",
      dur: "all",
      pnl: "net",
      unit: "abs",
      avg: "mean",
    }),
    pageChord,
    [navigate, keys["nav-stats"].keys],
  );
  useHotkeys(keys["nav-playbook"].keys, go("/playbook"), pageChord, [
    navigate,
    keys["nav-playbook"].keys,
  ]);
  useHotkeys(keys["nav-notes"].keys, go("/notes"), pageChord, [navigate, keys["nav-notes"].keys]);
  useHotkeys(keys["nav-calculator"].keys, go("/calculator"), pageChord, [
    navigate,
    keys["nav-calculator"].keys,
  ]);
  useHotkeys(keys["nav-import "].keys, go("/import"), pageChord, [
    navigate,
    keys["nav-import "].keys,
  ]);
  useHotkeys(keys["nav-settings"].keys, go("/settings"), pageChord, [
    navigate,
    keys["nav-settings"].keys,
  ]);

  // Create actions. `openModal` is a no-op toggle guard in the store, and the
  // guard already blocks these while a drawer is open, so a repeat press can
  // never close the drawer the user is filling in.
  const openFromHotkey = (modal: "new-trade" | "new-setup" | "new-note") =>
    guarded(() => {
      useUI.getState().setCommandOpen(false);
      openModal(modal);
    });

  useHotkeys(keys["action-new-trade"].keys, openFromHotkey("new-trade"), pageChord, [
    openModal,
    keys["action-new-trade"].keys,
  ]);
  useHotkeys(keys["action-new-note"].keys, openFromHotkey("new-note"), pageChord, [
    openModal,
    keys["action-new-note"].keys,
  ]);
  useHotkeys(keys["action-new-setup"].keys, openFromHotkey("new-setup"), pageChord, [
    openModal,
    keys["action-new-setup"].keys,
  ]);

  useHotkeys(
    keys["tool-size"].keys,
    guarded(() => {
      useUI.getState().setCommandOpen(false);
      runTool("size");
    }),
    pageChord,
    [runTool, keys["tool-size"].keys],
  );
}
