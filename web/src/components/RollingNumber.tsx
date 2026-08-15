import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { isRollArmed } from "@/lib/rollingNumbers";

/** Matches `--animate-digit-in` / `--animate-digit-out` in global.css. */
const ROLL_MS = 420;

interface Roll {
  /** What is on screen now. */
  shown: string;
  /** What it replaced, kept only while the outgoing digits are still moving. */
  leaving: string | null;
}

/**
 * A formatted figure whose digits roll over when it changes — but only when
 * the change came from the user's own trade write (see `lib/rollingNumbers`).
 * Mounting, reloading, or re-scoping a filter swaps the text with no motion,
 * so a page never appears to count itself up on arrival.
 *
 * The value arrives already formatted, currency and separators included, and
 * is animated per character: whatever the caller's formatter produced is what
 * rolls, so this never has to know about locales or money.
 */
export function RollingNumber({ value, className }: { value: string; className?: string }) {
  const [roll, setRoll] = useState<Roll>({ shown: value, leaving: null });

  useEffect(() => {
    setRoll((current) => {
      if (current.shown === value) return current;
      return { shown: value, leaving: isRollArmed() ? current.shown : null };
    });
  }, [value]);

  // Drop the outgoing copy once it has finished leaving. Until then both live
  // in the same grid cell, which is what lets one rise as the other departs.
  useEffect(() => {
    if (roll.leaving == null) return;
    const timer = setTimeout(() => setRoll((current) => ({ ...current, leaving: null })), ROLL_MS);
    return () => clearTimeout(timer);
  }, [roll.leaving]);

  // Split by code point rather than by grapheme: the input is a formatted
  // number, so the only clusters it can hold are currency symbols, and a digit
  // has to be its own cell for any of this to animate.
  const chars = Array.from(roll.shown);
  const leaving = roll.leaving == null ? null : Array.from(roll.leaving);
  // Right-aligned comparison: a figure that gains a digit ("$9.99" → "$10.99")
  // shifts every character left, and index-for-index it would look like every
  // one of them changed. Counting from the units end keeps a digit paired with
  // the digit it actually replaced.
  const offset = leaving ? leaving.length - chars.length : 0;

  return (
    <span className={cn("inline-flex tabular-nums", className)}>
      {chars.map((char, index) => {
        const before = leaving?.[index + offset];
        const changed = before != null && before !== char;
        return (
          <span key={index} className={cn("relative inline-grid", changed && "overflow-hidden")}>
            {changed ? (
              <span
                aria-hidden
                data-roll="out"
                className="col-start-1 row-start-1 animate-digit-out motion-reduce:hidden"
              >
                {before}
              </span>
            ) : null}
            <span
              data-roll="in"
              className={cn(
                "col-start-1 row-start-1",
                changed && "animate-digit-in motion-reduce:animate-none",
              )}
            >
              {/* A space between groups would collapse in an inline-grid cell
                  and close the gap the formatter put there. */}
              {char === " " ? " " : char}
            </span>
          </span>
        );
      })}
    </span>
  );
}
