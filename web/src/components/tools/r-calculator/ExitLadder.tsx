import { EXIT_PRESETS, matchPreset } from "@/lib/r-calculator/exit";
import { useRCalculatorStore } from "@/lib/r-calculator/useRCalculatorStore";
import { cn } from "@/lib/cn";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Button } from "@/components/ui/button";
import { CalcInputField } from "./CalcInputField";

type StopKind = "breakeven" | "original" | "custom";

const PRESET_LABELS: Record<string, { label: string; sub: string }> = {
  aggressive: {
    label: "Aggressive",
    sub: "Sell 75% at 2R, trail the rest from breakeven",
  },
  conservative: {
    label: "Conservative",
    sub: "Sell 50% at 1R, 25% at 2R, trail from breakeven",
  },
};

export function ExitLadder() {
  const store = useRCalculatorStore();
  const session = store.sessions.find((s) => s.id === store.activeId);
  if (!session) return null;

  const plan = session.exitPlan;
  const activePreset = matchPreset(plan);
  const stopKind = plan.trailerStop.kind;
  const customR = plan.trailerStop.kind === "custom" ? plan.trailerStop.r : 1;
  const isOpt = session.instrument === "options";
  const unit = isOpt ? "ct" : "sh";
  const trailerShares = store.exitResult.trailerShares;

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-card p-4">
      <header className="flex items-center gap-2">
        <span className="h-4 w-0.5 rounded-full bg-profit" />
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Exit ladder
        </h3>
      </header>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Presets
        </span>
        <div className="grid grid-cols-2 gap-2">
          {EXIT_PRESETS.map((preset) => {
            const isActive = activePreset === preset.id;
            const meta = PRESET_LABELS[preset.id];
            return (
              <Button
                key={preset.id}
                type="button"
                variant="ghost"
                aria-pressed={isActive}
                onClick={() => store.applyExitPreset(preset.plan)}
                className={cn(
                  "h-auto flex-col items-start rounded-lg px-3 py-2.5 text-left",
                  isActive
                    ? "bg-profit/10 text-profit hover:bg-profit/10 hover:text-profit"
                    : "bg-accent text-muted-foreground",
                )}
              >
                <span className="text-xs font-semibold">{meta.label}</span>
                <p className="mt-0.5 text-[10px] leading-tight opacity-70">{meta.sub}</p>
              </Button>
            );
          })}
        </div>
      </div>

      {plan.tiers.map((tier, i) => (
        <div key={`tier-${i}-${tier.r}`} className="group flex gap-3">
          <div className="flex flex-col items-center pt-3">
            <span className="size-2 shrink-0 rounded-full bg-profit" />
            {i < plan.tiers.length - 1 ? <div className="mt-0.5 h-full w-px bg-profit/30" /> : null}
          </div>
          <div className="min-w-0 flex-1 pb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Target {i + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-label="Remove tier"
                onClick={() => store.removeTier(i)}
                className="h-auto px-0 text-[10px] text-muted-foreground opacity-0 hover:bg-transparent hover:text-destructive group-hover:opacity-100"
              >
                Remove
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CalcInputField
                label="Target"
                value={tier.r}
                onValue={(n) => store.setTier(i, { r: n })}
                step={0.5}
                min={0.5}
                suffix="R"
                accent="profit"
              />
              <CalcInputField
                label="Exit %"
                value={tier.pct}
                onValue={(n) => store.setTier(i, { pct: n })}
                step={5}
                min={0}
                suffix="%"
                accent="signal"
              />
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => store.addTier()}
        className="h-auto border-dashed py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
      >
        + Add tier
      </Button>

      <div className="pt-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Trailing stop
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {trailerShares} {unit} trail after tiers
          </span>
        </div>
        <SegmentedControl
          ariaLabel="Trailing stop"
          fullWidth
          value={stopKind}
          onChange={(v) => {
            const kind = v as StopKind;
            store.setTrailerStop(
              kind === "custom"
                ? { kind: "custom", r: customR }
                : kind === "original"
                  ? { kind: "original" }
                  : { kind: "breakeven" },
            );
          }}
          options={[
            { value: "breakeven", label: "Breakeven 0R" },
            { value: "original", label: "Original −1R" },
            { value: "custom", label: "Custom" },
          ]}
        />
        {stopKind === "custom" ? (
          <div className="mt-2">
            <CalcInputField
              label="Custom stop"
              value={customR}
              onValue={(n) => store.setTrailerStop({ kind: "custom", r: n })}
              step={0.5}
              suffix="R"
              accent="loss"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
