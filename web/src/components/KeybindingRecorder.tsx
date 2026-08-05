import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/cn";
import {
  type AppHotkeyId,
  formatHotkeyLabel,
  hasModifier,
  type HotkeyStep,
  hotkeyStepFromEvent,
  serializeHotkey,
  validateHotkey,
} from "@/lib/hotkeys";
import { useHotkeyBindings, useIsCustomBinding, useKeybindings } from "@/lib/keybindings";

/**
 * How long to wait for a second key before committing a modifier-free press as
 * a one-key shortcut. Long enough to type `g` `h` at a natural pace, short
 * enough that binding a bare letter doesn't feel stuck.
 */
const SEQUENCE_WINDOW_MS = 800;

/**
 * Click-to-record shortcut editor for a single command.
 *
 * A press carrying modifiers commits immediately. A modifier-free press might
 * be the first half of a sequence, so it waits out `SEQUENCE_WINDOW_MS` for a
 * second key before committing on its own.
 */
export function KeybindingRecorder({ id }: { id: AppHotkeyId }) {
  const binding = useHotkeyBindings()[id];
  const isCustom = useIsCustomBinding(id);
  const setBinding = useKeybindings((s) => s.setBinding);
  const resetBinding = useKeybindings((s) => s.resetBinding);

  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState<HotkeyStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    setRecording(false);
    setPending([]);
  }, [clearTimer]);

  const commit = useCallback(
    (steps: HotkeyStep[]) => {
      const invalid = validateHotkey(steps);
      if (invalid) {
        setError(invalid);
        stop();
        return;
      }
      const conflict = setBinding(id, serializeHotkey(steps));
      setError(conflict);
      stop();
    },
    [id, setBinding, stop],
  );

  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Recording swallows everything so app shortcuts can't fire mid-capture.
      e.preventDefault();
      e.stopPropagation();

      const step = hotkeyStepFromEvent(e);
      if (!step) return; // bare modifier held — wait for the real key

      if (step.key === "escape" && !hasModifier(step)) {
        setError(null);
        stop();
        return;
      }

      clearTimer();

      // Second key of a sequence.
      if (pending.length === 1) {
        commit([...pending, step]);
        return;
      }

      // Modifiers make it unambiguous — nothing can follow.
      if (hasModifier(step)) {
        commit([step]);
        return;
      }

      setPending([step]);
      timer.current = setTimeout(() => commit([step]), SEQUENCE_WINDOW_MS);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, pending, commit, stop, clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  const preview = pending.length > 0 ? formatHotkeyLabel(serializeHotkey(pending)) : "Press keys…";

  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5 md:items-end">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Change shortcut, currently ${binding.label}`}
          onClick={() => {
            setError(null);
            setRecording(true);
          }}
          onBlur={stop}
          className={cn(
            "inline-flex h-8 min-w-24 items-center justify-center rounded-md border px-2.5 text-xs transition-colors",
            recording
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-foreground hover:bg-accent",
          )}
        >
          {recording ? (
            <span className="font-medium tabular-nums">{preview}</span>
          ) : (
            <Kbd className="bg-transparent text-foreground">{binding.label}</Kbd>
          )}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Reset to default"
          className={cn("size-8", isCustom ? "" : "invisible")}
          disabled={!isCustom}
          onClick={() => {
            setError(null);
            resetBinding(id);
          }}
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
      {recording ? (
        <p className="text-[11px] text-muted-foreground">Esc to cancel</p>
      ) : error ? (
        <p className="text-[11px] text-destructive md:text-right">{error}</p>
      ) : null}
    </div>
  );
}
