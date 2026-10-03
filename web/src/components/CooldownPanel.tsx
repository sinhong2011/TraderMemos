import { Wind } from "lucide-react";
import { useEffect, useState } from "react";
import type { Cooldown, CooldownImpulse, CooldownReturnRule } from "@/lib/api/cooldown";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import {
  COOLDOWN_DURATIONS,
  DEFAULT_COOLDOWN_MINUTES,
  EXTEND_MINUTES,
  IMPULSES,
  MIN_REFLECTION,
  RETURN_RULES,
  formatCountdown,
  triggerSentence,
  useCooldownClock,
} from "@/lib/cooldown";
import {
  useActiveCooldown,
  useExtendCooldown,
  useReleaseCooldown,
  useStartCooldown,
} from "@/lib/hooks/useCooldown";
import { useSetups } from "@/lib/hooks/useSetups";
import { Modal } from "./Modal";
import { SegmentedControl } from "./SegmentedControl";
import { ToggleChip } from "./ToggleChip";
import { FormTextarea } from "./FormInput";
import { Field } from "./Field";
import { Button } from "./ui/button";
import { useToastManager } from "./Toast";

/**
 * Cooldown mode — three faces in one dialog (the web port of
 * `mobile/src/app/cooldown.tsx`; the reference is the "Trading Reset
 * Protocol" panel at `?a2panel=pause`).
 *
 * - **Start**: how long, and optionally what is pulling you in.
 * - **Counting**: the breathing circle and the clock; "+5 min" extends,
 *   "I need to trade now" goes to the gate early.
 * - **Gate**: impulse, the one setup allowed back in, the rule for the rest
 *   of the day, and — when early — a written reflection.
 *
 * The server owns the state, so whichever face the session is in renders.
 */
export function CooldownPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const active = useActiveCooldown();
  const session = active.data?.session ?? null;
  const clock = useCooldownClock(session);
  const [earlyGateFor, setEarlyGateFor] = useState<string | null>(null);
  const earlyGate = session != null && earlyGateFor === session.id;

  const title = !session
    ? "Take a cooldown"
    : clock.phase === "counting" && !earlyGate
      ? "Cooling down"
      : "Before you go back";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      className="max-w-[min(560px,94vw)]"
    >
      {active.isLoading && active.data === undefined ? (
        <p className="m-0 py-8 text-center text-xs text-muted-foreground">Loading…</p>
      ) : active.isError && active.data == null ? (
        <p className="m-0 py-8 text-center text-xs text-destructive">Could not reach the server.</p>
      ) : !session ? (
        <StartFace />
      ) : clock.phase === "counting" && !earlyGate ? (
        <CountingFace
          session={session}
          remaining={clock.remaining}
          onEarly={() => setEarlyGateFor(session.id)}
        />
      ) : (
        <GateFace
          session={session}
          early={clock.phase === "counting"}
          onBack={earlyGate ? () => setEarlyGateFor(null) : undefined}
          onReleased={() => onOpenChange(false)}
        />
      )}
    </Modal>
  );
}

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Something went wrong.";
}

function StartFace() {
  const toast = useToastManager();
  const start = useStartCooldown();
  const [minutes, setMinutes] = useState(DEFAULT_COOLDOWN_MINUTES);
  const [impulse, setImpulse] = useState<CooldownImpulse | "">("");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Wind size={26} strokeWidth={1.75} />
        </span>
        <p className="m-0 max-w-[40ch] text-[13px] leading-relaxed text-muted-foreground">
          Step away before the next trade decides for you. Logging trades stays locked until you
          answer the return gate.
        </p>
      </div>
      <Field label="How long?">
        <SegmentedControl
          ariaLabel="Cooldown length"
          size="md"
          options={COOLDOWN_DURATIONS.map((m) => ({ value: String(m), label: `${m} min` }))}
          value={String(minutes)}
          onChange={(v) => setMinutes(Number(v))}
        />
      </Field>
      <Field label="What's pulling you in?">
        <div className="flex flex-wrap gap-1.5">
          {IMPULSES.map((i) => (
            <ToggleChip
              key={i.value}
              tone="neg"
              selected={impulse === i.value}
              onToggle={() => setImpulse(impulse === i.value ? "" : i.value)}
            >
              {i.label}
            </ToggleChip>
          ))}
        </div>
      </Field>
      <Button
        type="button"
        disabled={start.isPending}
        onClick={() =>
          start.mutate(
            { duration_sec: minutes * 60, trigger: "manual", impulse },
            {
              onError: (err) =>
                toast.add({ title: "Could not start", description: errorText(err) }),
            },
          )
        }
      >
        Start {minutes} min
      </Button>
    </div>
  );
}

/** 4 s in, 2 s hold, 6 s out — the reference protocol's breath. */
const BREATH = { inMs: 4000, holdMs: 2000, outMs: 6000 } as const;
const BREATH_CYCLE = BREATH.inMs + BREATH.holdMs + BREATH.outMs;

function BreathingCircle() {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      const elapsed = (Date.now() - started) % BREATH_CYCLE;
      setPhase(
        elapsed < BREATH.inMs ? "in" : elapsed < BREATH.inMs + BREATH.holdMs ? "hold" : "out",
      );
    }, 250);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="relative flex size-44 items-center justify-center">
      {/* The ring scales on a 12 s CSS cycle (global.css `tm-breath`); the
          word inside follows the same clock in JS. */}
      <span className="tm-breath absolute size-32 rounded-full bg-primary/20" aria-hidden />
      <span className="relative flex size-24 items-center justify-center rounded-full bg-primary/25 text-[15px] font-semibold text-foreground">
        {phase === "in" ? "Breathe in" : phase === "hold" ? "Hold" : "Breathe out"}
      </span>
    </div>
  );
}

function CountingFace({
  session,
  remaining,
  onEarly,
}: {
  session: Cooldown;
  remaining: number;
  onEarly: () => void;
}) {
  const toast = useToastManager();
  const extend = useExtendCooldown();
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <BreathingCircle />
      <p
        className="m-0 text-[44px] leading-none font-semibold tabular-nums text-foreground"
        aria-label={`${formatCountdown(remaining)} remaining`}
      >
        {formatCountdown(remaining)}
      </p>
      <p className="m-0 text-[13px] text-muted-foreground">{triggerSentence(session.trigger)}</p>
      <p className="m-0 max-w-[40ch] rounded-md bg-muted px-3 py-2 text-center text-[13px] text-foreground">
        The next trade doesn't have to fix the last one.
      </p>
      <div className="flex items-center gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          disabled={extend.isPending}
          onClick={() =>
            extend.mutate(
              { id: session.id, minutes: EXTEND_MINUTES },
              {
                onError: (err) =>
                  toast.add({ title: "Could not extend", description: errorText(err) }),
              },
            )
          }
        >
          +{EXTEND_MINUTES} min
        </Button>
        <Button type="button" variant="ghost" className="text-destructive" onClick={onEarly}>
          I need to trade now
        </Button>
      </div>
    </div>
  );
}

function GateFace({
  session,
  early,
  onBack,
  onReleased,
}: {
  session: Cooldown;
  early: boolean;
  onBack?: () => void;
  onReleased: () => void;
}) {
  const toast = useToastManager();
  const release = useReleaseCooldown();
  const setups = useSetups().data ?? [];
  const [impulse, setImpulse] = useState<CooldownImpulse | "">(session.impulse);
  const [setupId, setSetupId] = useState("");
  const [rule, setRule] = useState<CooldownReturnRule>("none");
  const [reflection, setReflection] = useState("");
  const reflectionLength = reflection.trim().length;
  const ready = impulse !== "" && (!early || reflectionLength >= MIN_REFLECTION);

  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
        {early
          ? "Unlocking early is allowed — but write down why first. The typing is the point."
          : "The timer is done. Three honest answers and you're back."}
      </p>
      <Field label="What was pulling you in?">
        <div className="flex flex-wrap gap-1.5">
          {IMPULSES.map((i) => (
            <ToggleChip
              key={i.value}
              tone="neg"
              selected={impulse === i.value}
              onToggle={() => setImpulse(impulse === i.value ? "" : i.value)}
            >
              {i.label}
            </ToggleChip>
          ))}
        </div>
      </Field>
      <Field
        label="The one setup you're allowed"
        description={
          setups.length === 0
            ? "No playbook setups yet — add some and the gate will hold you to one."
            : undefined
        }
      >
        <div className="flex flex-wrap gap-1.5">
          <ToggleChip selected={setupId === ""} onToggle={() => setSetupId("")}>
            Any setup
          </ToggleChip>
          {setups.map((s) => (
            <ToggleChip key={s.id} selected={setupId === s.id} onToggle={() => setSetupId(s.id)}>
              {s.name}
            </ToggleChip>
          ))}
        </div>
      </Field>
      <Field label="Your rule for the rest of today">
        <div role="radiogroup" className="flex flex-col gap-1.5">
          {RETURN_RULES.map((option) => {
            const selected = option.value === rule;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setRule(option.value)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                  selected
                    ? "border-primary/45 bg-primary/8"
                    : "border-border bg-transparent hover:bg-accent",
                )}
              >
                <span className="flex flex-col">
                  <span className="text-[13px] font-medium text-foreground">{option.label}</span>
                  <span className="text-[12px] text-muted-foreground">{option.detail}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 rounded-full border-2",
                    selected ? "border-primary bg-primary" : "border-muted-foreground/50",
                  )}
                />
              </button>
            );
          })}
        </div>
      </Field>
      {early ? (
        <Field
          label="Why now?"
          description={`${reflectionLength}/${MIN_REFLECTION}`}
          htmlFor="cooldown-reflection"
        >
          <FormTextarea
            id="cooldown-reflection"
            rows={3}
            value={reflection}
            placeholder="What will be different about this trade?"
            onChange={(e) => setReflection(e.target.value)}
          />
        </Field>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack}>
            Keep cooling down
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={!ready || release.isPending}
          onClick={() =>
            release.mutate(
              {
                id: session.id,
                body: {
                  impulse,
                  setup_id: setupId || null,
                  return_rule: rule,
                  reflection: reflection.trim(),
                },
              },
              {
                onSuccess: onReleased,
                onError: (err) =>
                  toast.add({ title: "Could not unlock", description: errorText(err) }),
              },
            )
          }
        >
          Unlock
        </Button>
      </div>
    </div>
  );
}
