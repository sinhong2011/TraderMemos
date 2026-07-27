import { EXIT_PRESETS, matchPreset } from "@/lib/r-calculator/exit";
import { useRCalculatorStore } from "@/lib/r-calculator/useRCalculatorStore";
import { cn } from "@/lib/cn";
import { Card } from "@/components/Card";
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

const groupLabelClass = "text-[13px] font-medium text-muted-foreground";

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
    <Card title="Exit ladder">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className={groupLabelClass}>Presets</span>
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
                      ? "bg-profit/12 text-profit hover:bg-profit/16 hover:text-profit"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="text-[13px] font-semibold">{meta.label}</span>
                  <p className="mt-0.5 text-xs leading-tight opacity-70">{meta.sub}</p>
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col">
          {plan.tiers.map((tier, i) => (
            <div key={`tier-${i}-${tier.r}`} className="group flex gap-3">
              <div className="flex flex-col items-center pt-3.5">
                <span className="size-2 shrink-0 rounded-full bg-profit" />
                {i < plan.tiers.length - 1 ? (
                  <div className="mt-0.5 h-full w-px bg-profit/30" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pb-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={groupLabelClass}>Target {i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label={`Remove target ${i + 1}`}
                    onClick={() => store.removeTier(i)}
                    className="h-auto px-0 text-xs text-muted-foreground opacity-0 hover:bg-transparent hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
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
                  />
                  <CalcInputField
                    label="Exit %"
                    value={tier.pct}
                    onValue={(n) => store.setTier(i, { pct: n })}
                    step={5}
                    min={0}
                    max={100}
                    suffix="%"
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => store.addTier()}
            className="border-dashed text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            Add tier
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className={groupLabelClass}>Trailing stop</span>
            <span className="text-xs tabular-nums text-muted-foreground">
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
            <CalcInputField
              label="Custom stop"
              value={customR}
              onValue={(n) => store.setTrailerStop({ kind: "custom", r: n })}
              step={0.5}
              suffix="R"
            />
          ) : null}
        </div>
      </div>
    </Card>
  );
}
