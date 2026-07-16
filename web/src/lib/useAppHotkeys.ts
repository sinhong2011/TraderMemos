"use no memo";

import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import { APP_HOTKEYS } from "./hotkeys";
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

function isPlainLetter(e: KeyboardEvent, letter: string): boolean {
  const lower = letter.toLowerCase();
  if (e.key.toLowerCase() === lower) return true;
  return e.code.toLowerCase() === `key${lower}`;
}

/**
 * Global command shortcuts. Listeners stay attached; we gate with
 * ignoreEventWhen so chords work both on the page and inside an empty palette.
 *
 * Single-letter actions (`n`, ⇧S, ⇧N) use a native capture listener so they
 * keep working when react-hotkeys-hook sequence state / code matching flakes
 * (common after chart focus or mixed mod chords).
 */
export function useAppHotkeys() {
  const navigate = useNavigate();
  const openModal = useUI((s) => s.openModal);
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const runTool = useToolRunner();

  const blockWhenTypingOrOverlay = (e: KeyboardEvent) => drawerOrModalOpen() || isTypingContext(e);

  // ⌘K / Ctrl+K — always available, including while typing
  useHotkeys(
    APP_HOTKEYS.palette.keys,
    () => setCommandOpen(!useUI.getState().commandOpen),
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
      eventListenerOptions: CAPTURE,
    },
    [setCommandOpen],
  );

  const pageChord = {
    enableOnFormTags: true,
    preventDefault: true,
    eventListenerOptions: CAPTURE,
    ignoreEventWhen: blockWhenTypingOrOverlay,
  } as const;

  // Navigation sequences (g then letter) — skip while typing / overlays
  useHotkeys(
    APP_HOTKEYS["nav-dashboard"].keys,
    () => {
      useUI.getState().setCommandOpen(false);
      navigate({ to: "/dashboard" });
    },
    pageChord,
    [navigate],
  );
  useHotkeys(
    APP_HOTKEYS["nav-trades"].keys,
    () => {
      useUI.getState().setCommandOpen(false);
      navigate({ to: "/trades" });
    },
    pageChord,
    [navigate],
  );
  useHotkeys(
    APP_HOTKEYS["nav-calendar"].keys,
    () => {
      useUI.getState().setCommandOpen(false);
      navigate({ to: "/calendar" });
    },
    pageChord,
    [navigate],
  );
  useHotkeys(
    APP_HOTKEYS["nav-stats"].keys,
    () => {
      useUI.getState().setCommandOpen(false);
      navigate({ to: "/reports" });
    },
    pageChord,
    [navigate],
  );
  useHotkeys(
    APP_HOTKEYS["nav-playbook"].keys,
    () => {
      useUI.getState().setCommandOpen(false);
      navigate({ to: "/playbook" });
    },
    pageChord,
    [navigate],
  );
  useHotkeys(
    APP_HOTKEYS["nav-calculator"].keys,
    () => {
      useUI.getState().setCommandOpen(false);
      navigate({ to: "/calculator" });
    },
    pageChord,
    [navigate],
  );
  useHotkeys(
    APP_HOTKEYS["nav-import"].keys,
    () => {
      useUI.getState().setCommandOpen(false);
      navigate({ to: "/import" });
    },
    pageChord,
    [navigate],
  );
  useHotkeys(
    APP_HOTKEYS["nav-settings"].keys,
    () => {
      useUI.getState().setCommandOpen(false);
      navigate({ to: "/settings" });
    },
    {
      enableOnFormTags: true,
      preventDefault: true,
      eventListenerOptions: CAPTURE,
      ignoreEventWhen: (e) => drawerOrModalOpen() || isTypingContext(e),
    },
    [navigate],
  );

  // Actions — native capture listener (more reliable than useHotkeys for bare letters)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat) return;
      if (drawerOrModalOpen() || isTypingContext(e)) return;

      if (!e.shiftKey && isPlainLetter(e, "n")) {
        e.preventDefault();
        e.stopPropagation();
        useUI.getState().setCommandOpen(false);
        openModal("new-trade");
        return;
      }

      if (e.shiftKey && isPlainLetter(e, "s")) {
        e.preventDefault();
        e.stopPropagation();
        useUI.getState().setCommandOpen(false);
        openModal("new-setup");
        return;
      }

      if (e.shiftKey && isPlainLetter(e, "n")) {
        e.preventDefault();
        e.stopPropagation();
        useUI.getState().setCommandOpen(false);
        openModal("new-note");
      }
    };

    document.addEventListener("keydown", onKeyDown, CAPTURE);
    return () => document.removeEventListener("keydown", onKeyDown, CAPTURE);
  }, [openModal]);

  useHotkeys(
    APP_HOTKEYS["tool-size"].keys,
    () => {
      useUI.getState().setCommandOpen(false);
      runTool("size");
    },
    {
      enableOnFormTags: true,
      preventDefault: true,
      eventListenerOptions: CAPTURE,
      ignoreEventWhen: blockWhenTypingOrOverlay,
    },
    [runTool],
  );
}
