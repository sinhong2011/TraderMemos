import { Timer } from "lucide-react";
import { formatCountdown, useCooldownClock, useCooldownLock } from "@/lib/cooldown";
import { useUI } from "@/lib/ui";

/**
 * App-wide "cooling down" capsule (the mobile banner's twin): floats above
 * the page while a session is open so the lock is never a surprise when the
 * trade drawer refuses to open. Clicking it opens the cooldown panel.
 */
export function CooldownBanner() {
  const { session } = useCooldownLock();
  const clock = useCooldownClock(session);
  const openCooldown = useUI((s) => s.openCooldown);
  if (!session) return null;
  return (
    <button
      type="button"
      onClick={openCooldown}
      className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground shadow-lg hover:bg-accent md:bottom-4"
    >
      <Timer size={14} strokeWidth={1.75} className="text-primary" />
      {clock.phase === "gate" ? "Cooldown over — answer the gate" : "Cooling down"}
      {clock.phase === "counting" ? (
        <span className="tabular-nums text-muted-foreground">
          {formatCountdown(clock.remaining)}
        </span>
      ) : null}
    </button>
  );
}
