import { Wind } from "lucide-react";
import {
  formatCountdown,
  triggerSentence,
  useCooldownClock,
  useCooldownLock,
} from "@/lib/cooldown";
import { useUI } from "@/lib/ui";
import { Button } from "./ui/button";

/**
 * The lock on the Trades page while a cooldown is open: the list blurs
 * behind a veil and the only action is the cooldown itself. Reading the
 * rest of the journal stays free — the lock is on acting, not looking.
 * Renders nothing when no session is open.
 */
export function CooldownVeil() {
  const { session } = useCooldownLock();
  const clock = useCooldownClock(session);
  const openCooldown = useUI((s) => s.openCooldown);
  if (!session) return null;
  return (
    <div
      role="status"
      className="absolute inset-0 z-[2] flex items-center justify-center bg-background/70 backdrop-blur-[3px]"
    >
      <div className="flex max-w-[380px] flex-col items-center gap-3 rounded-lg bg-card px-6 py-5 text-center shadow-lg">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Wind size={22} strokeWidth={1.75} />
        </span>
        <p className="m-0 text-[28px] leading-none font-semibold tabular-nums text-foreground">
          {clock.phase === "gate" ? "Done" : formatCountdown(clock.remaining)}
        </p>
        <p className="m-0 text-[13px] text-muted-foreground">
          {clock.phase === "gate"
            ? "Cooldown over — answer the return gate to unlock trade entry."
            : `${triggerSentence(session.trigger)} Trade entry is locked until the gate is answered.`}
        </p>
        <Button type="button" onClick={openCooldown}>
          {clock.phase === "gate" ? "Answer the gate" : "Open cooldown"}
        </Button>
      </div>
    </div>
  );
}
