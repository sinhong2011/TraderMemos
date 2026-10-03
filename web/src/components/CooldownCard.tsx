import {
  formatCountdown,
  triggerSentence,
  useCooldownClock,
  useCooldownLock,
} from "@/lib/cooldown";
import { useUI } from "@/lib/ui";
import { cn } from "@/lib/cn";
import { Card } from "./Card";
import { Button } from "./ui/button";

/**
 * The open cooldown on Home: the clock, how far along it is, and why it
 * started. Renders nothing when no session is open — like DailyLossCard,
 * the card exists to hold a line, not to advertise the feature (that lives
 * on the Trades toolbar).
 */
export function CooldownCard() {
  const { session } = useCooldownLock();
  const clock = useCooldownClock(session);
  const openCooldown = useUI((s) => s.openCooldown);
  if (!session) return null;

  const elapsed = Math.max(0, session.duration_sec - clock.remaining);
  const pct =
    session.duration_sec > 0 ? Math.min(100, (elapsed / session.duration_sec) * 100) : 100;
  const over = clock.phase === "gate";

  return (
    <Card
      title="Cooldown"
      action={
        <Button type="button" variant="soft" size="sm" onClick={openCooldown}>
          {over ? "Answer the gate" : "Open"}
        </Button>
      }
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xl font-semibold tabular-nums text-foreground">
            {over ? "Done" : formatCountdown(clock.remaining)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {over ? "Answer the return gate" : triggerSentence(session.trigger)}
          </span>
        </div>
        <span className="h-2 overflow-hidden rounded-full bg-muted/60">
          <span
            className={cn(
              "block h-full rounded-full transition-[width] duration-300",
              over ? "bg-profit" : "bg-primary/60",
            )}
            style={{ width: `${Math.max(pct, 3)}%` }}
          />
        </span>
      </div>
    </Card>
  );
}
