import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/cn";
import { fmtSignedMoney } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import type { ReplayPnl } from "./replayPnl";
import { REPLAY_SPEEDS, type ReplayController } from "./useReplayController";

function positionLabel(pnl: ReplayPnl, fillTotal: number): string {
  if (pnl.position > 0) return `Long ${pnl.position}`;
  if (pnl.position < 0) return `Short ${Math.abs(pnl.position)}`;
  // Zero position: distinguish "closed out" (all fills consumed) from flat
  // moments before entry or between round trips.
  return pnl.fillCount > 0 && pnl.fillCount >= fillTotal ? "Closed" : "Flat";
}

export function ReplayControls({
  controller,
  barCount,
  timeLabel,
  pnl,
  fillTotal,
  currency,
  priceMismatch = false,
}: {
  controller: ReplayController;
  barCount: number;
  timeLabel: string;
  pnl: ReplayPnl | null;
  fillTotal: number;
  currency: string;
  priceMismatch?: boolean;
}) {
  const { cursor, playing, speed } = controller;
  const net = pnl?.net ?? 0;

  return (
    <div className="flex flex-col gap-2">
      <Slider
        aria-label="Replay position"
        min={0}
        max={Math.max(barCount - 1, 1)}
        step={1}
        value={cursor}
        onValueChange={(v) => controller.seek(Array.isArray(v) ? (v[0] ?? 0) : v)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Step back"
            onClick={controller.stepBack}
          >
            <SkipBack size={14} strokeWidth={1.5} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={playing ? "Pause replay" : "Play replay"}
            onClick={controller.toggle}
          >
            {playing ? (
              <Pause size={14} strokeWidth={1.5} aria-hidden />
            ) : (
              <Play size={14} strokeWidth={1.5} aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Step forward"
            onClick={controller.stepForward}
          >
            <SkipForward size={14} strokeWidth={1.5} aria-hidden />
          </Button>
        </div>
        <SegmentedControl
          ariaLabel="Replay speed"
          size="xs"
          value={speed}
          onChange={(v) => controller.setSpeed(v as typeof speed)}
          options={REPLAY_SPEEDS}
        />
        <div className="ml-auto flex items-center gap-3 text-xs tabular-nums">
          <span className="text-muted-foreground">{timeLabel}</span>
          {pnl && (
            <>
              <span className="text-muted-foreground">{positionLabel(pnl, fillTotal)}</span>
              <span
                className={cn(
                  "font-medium",
                  net > 0 ? "text-profit" : net < 0 ? "text-loss" : "text-muted-foreground",
                )}
              >
                {fmtSignedMoney(net, currency, intlLocale())}
              </span>
            </>
          )}
        </div>
      </div>
      {priceMismatch && (
        <p className="text-right text-[11px] text-warning">
          Chart data disagrees with the recorded fill prices — in-flight replay P&amp;L is marked to
          the chart and may look off; the final figure comes from the fills.
        </p>
      )}
    </div>
  );
}
