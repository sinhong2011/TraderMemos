import { useState } from "react";
import { money, rLabel, signedMoney } from "../../../lib/r-calculator/format";
import { useRCalculatorStore } from "../../../lib/r-calculator/useRCalculatorStore";
import { cn } from "../../../lib/cn";
import { Button } from "../../ui/button";

export function RAxis() {
  const store = useRCalculatorStore();
  const session = store.sessions.find((s) => s.id === store.activeId);
  const [active, setActive] = useState<string | null>(null);

  if (!session) return null;

  const { input, result, exitResult } = store;
  const long = input.direction === "long";
  const maxR = exitResult.maxAxisR;

  const top = (r: number) => ((maxR - r) / (maxR + 1)) * 100;
  const entryTop = top(0);
  const util = result.riskAmt > 0 ? Math.min(1, Math.max(0, result.realRisk / result.riskAmt)) : 0;
  const railScale = 0.4 + 0.6 * util;

  const exitPrice = (r: number) =>
    long ? input.entry + r * result.r1 : input.entry - r * result.r1;

  const bullish =
    session.instrument === "options" ? session.optionType === "call" : session.direction === "long";

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
      <div className="relative flex min-h-[240px] flex-1 items-stretch justify-center gap-2 py-2">
        {/* Left scale — adjacent to track */}
        <div className="relative w-12 shrink-0">
          <ScaleTick top="0%" text={rLabel(maxR)} tone="profit" />
          {exitResult.tiers.map((tier) => (
            <ScaleTick
              key={tier.r}
              top={`${top(tier.r)}%`}
              text={`${rLabel(tier.r)} · ${tier.pct}%`}
              tone="profit"
            />
          ))}
          <ScaleTick top={`${entryTop}%`} text="0" tone="muted" emphasize />
          <ScaleTick top="100%" text="−1R" tone="loss" />
        </div>

        {/* Center rail */}
        <div className="relative w-12 shrink-0">
          <div className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-border" />

          <div
            className="absolute top-0 left-1/2 h-full w-[18px] origin-center transition-transform duration-300"
            style={{
              marginLeft: "-9px",
              transform: `scaleX(${railScale})`,
            }}
          >
            <div
              className="absolute inset-x-0 top-0 origin-bottom overflow-hidden rounded-t-full"
              style={{
                height: `${entryTop}%`,
                background: "linear-gradient(to top, rgba(74,222,128,0.3), rgba(74,222,128,0.9))",
                boxShadow: "0 0 12px -2px rgba(74,222,128,0.4)",
              }}
            />
            <div
              className="absolute inset-x-0 origin-top overflow-hidden rounded-b-full"
              style={{
                top: `${entryTop}%`,
                height: `${100 - entryTop}%`,
                background:
                  "linear-gradient(to bottom, rgba(251,113,133,0.9), rgba(251,113,133,0.3))",
                boxShadow: "0 0 12px -2px rgba(251,113,133,0.4)",
              }}
            />
          </div>

          {exitResult.tiers.map((tier, i) => (
            <Button
              key={tier.r}
              type="button"
              variant="ghost"
              className={cn(
                "absolute left-1/2 z-20 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-0 bg-background p-0 ring-2 ring-profit hover:bg-background",
                active === `tier-${i}` && "scale-150",
              )}
              style={{ top: `${top(tier.r)}%` }}
              onMouseEnter={() => setActive(`tier-${i}`)}
              onMouseLeave={() => setActive(null)}
            />
          ))}

          <Button
            type="button"
            variant="ghost"
            className={cn(
              "absolute left-1/2 z-10 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-background p-0 text-[10px] font-bold ring-2 hover:bg-background",
              bullish ? "text-profit ring-profit" : "text-destructive ring-loss",
              active === "entry" && "scale-110",
            )}
            style={{ top: `${entryTop}%` }}
            onMouseEnter={() => setActive("entry")}
            onMouseLeave={() => setActive(null)}
          >
            {long ? "▲" : "▼"}
          </Button>
        </div>

        {/* Right prices — tight to track */}
        <div className="relative w-28 shrink-0 sm:w-32">
          <PriceLabel
            top="0%"
            tone="profit"
            caption={`Hold ${rLabel(exitResult.trailerTargetR)}`}
            price={money(
              exitResult.tiers.length ? exitPrice(exitResult.trailerTargetR) : result.target3,
            )}
            pl={signedMoney(exitResult.totalAtTarget)}
          />
          {exitResult.tiers.map((tier, i) => (
            <PriceLabel
              key={tier.r}
              top={`${top(tier.r)}%`}
              tone="profit"
              caption={`Target ${rLabel(tier.r)} · ${tier.pct}%`}
              price={money(tier.price)}
              pl={signedMoney(tier.profit)}
              active={active === `tier-${i}`}
            />
          ))}
          <PriceLabel
            top={`${entryTop}%`}
            tone="text"
            caption="Entry"
            price={money(input.entry)}
            emphasize
            active={active === "entry"}
          />
          <PriceLabel
            top="100%"
            tone="loss"
            caption="Stop −1R"
            price={money(result.stopPrice)}
            pl={result.realRisk > 0 ? signedMoney(-result.realRisk) : "—"}
            active={active === "stop"}
          />
        </div>
      </div>
    </div>
  );
}

function ScaleTick({
  top,
  text,
  tone,
  emphasize,
}: {
  top: string;
  text: string;
  tone: "profit" | "loss" | "muted";
  emphasize?: boolean;
}) {
  return (
    <span
      className={cn(
        "absolute right-0 -translate-y-1/2 whitespace-nowrap text-right text-[9px] tabular-nums",
        tone === "profit" && "text-profit",
        tone === "loss" && "text-destructive",
        tone === "muted" && "text-muted-foreground",
        emphasize && "font-semibold",
      )}
      style={{ top }}
    >
      {text}
    </span>
  );
}

function PriceLabel({
  top,
  tone,
  caption,
  price,
  pl,
  emphasize,
  active,
}: {
  top: string;
  tone: "profit" | "loss" | "text";
  caption: string;
  price: string;
  pl?: string;
  emphasize?: boolean;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute left-0 -translate-y-1/2 transition-opacity",
        active === false && "opacity-60",
      )}
      style={{ top }}
    >
      <p className="m-0 text-[9px] uppercase tracking-widest text-muted-foreground">{caption}</p>
      <p
        className={cn(
          "m-0 tabular-nums",
          emphasize ? "text-sm font-bold" : "text-xs font-semibold",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-destructive",
          tone === "text" && "text-foreground",
        )}
      >
        {price}
      </p>
      {pl ? (
        <p
          className={cn(
            "m-0 text-[10px] tabular-nums",
            tone === "profit" ? "text-profit/80" : "text-destructive/80",
          )}
        >
          {pl}
        </p>
      ) : null}
    </div>
  );
}
