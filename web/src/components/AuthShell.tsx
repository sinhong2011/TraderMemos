import type { ReactNode } from "react";
import { AppLogo } from "@/components/AppLogo";
import { cn } from "@/lib/cn";

/**
 * A season of daily candles in one ink — the brand's candlestick-T, multiplied.
 * Up days are solid, down days hollow; older days fade toward the left edge the
 * way memory does. The worst day of the drawdown carries its journal note on a
 * hairline: the point of the product is the sentence, not the bar.
 */
const W = 720;
const H = 440;
const N = 64;
const STEP = W / N;
const BODY = STEP * 0.62;
const NOTE_AT = 41;

type Candle = { o: number; c: number; h: number; l: number };

/** Seeded walk: a slow climb, a drawdown that bottoms on the noted day, a run-up. */
function buildCandles(): Candle[] {
  let seed = 20261015;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const out: Candle[] = [];
  let price = 100;
  for (let i = 0; i < N; i++) {
    const drift = i < 24 ? 0.45 : i <= NOTE_AT ? -1.05 : 1.5;
    const o = price;
    const c = i === NOTE_AT ? o - 7 : o + drift + (rnd() - 0.5) * 4.6;
    const h = Math.max(o, c) + 0.4 + rnd() * 2;
    const l = Math.min(o, c) - 0.4 - rnd() * 2;
    out.push({ o, c, h, l });
    price = c;
  }
  return out;
}

const CANDLES = buildCandles();
const LO = Math.min(...CANDLES.map((k) => k.l));
const HI = Math.max(...CANDLES.map((k) => k.h));
// Leave the bottom third clear for the note under the trough.
const y = (v: number) => 30 + ((HI - v) / (HI - LO)) * (H * 0.62);

function CandleField() {
  const note = CANDLES[NOTE_AT]!;
  const noteX = NOTE_AT * STEP + STEP / 2;
  const lineTop = y(note.l) + 8;
  const lineBottom = lineTop + 46;
  const textX = noteX - 12;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMaxYMax slice"
      className="pointer-events-none block size-full select-none"
      fill="none"
    >
      {CANDLES.map((k, i) => {
        const x = i * STEP + STEP / 2;
        const up = k.c >= k.o;
        const top = y(Math.max(k.o, k.c));
        const bottom = y(Math.min(k.o, k.c));
        // Older days recede: faint at the left edge, full ink on the latest day.
        const opacity = i === N - 1 ? 1 : 0.16 + 0.8 * (i / (N - 1)) ** 1.5;
        return (
          <g
            key={i}
            style={{ opacity, animationDelay: `${150 + i * 14}ms` }}
            className="motion-safe:animate-[auth-candle-in_480ms_cubic-bezier(0.22,1,0.36,1)_both]"
          >
            <line
              x1={x}
              x2={x}
              y1={y(k.h)}
              y2={y(k.l)}
              strokeWidth={1.25}
              className="stroke-chart-accent"
            />
            <rect
              x={x - BODY / 2}
              y={top}
              width={BODY}
              height={Math.max(bottom - top, 2)}
              rx={1}
              strokeWidth={up ? 0 : 1.25}
              className={up ? "fill-chart-accent" : "fill-sidebar stroke-chart-accent"}
            />
          </g>
        );
      })}

      <g className="motion-safe:animate-[auth-memo-in_500ms_ease-out_both] motion-safe:[animation-delay:1200ms]">
        <path
          d={`M${noteX} ${lineTop} V${lineBottom} H${textX + 4}`}
          strokeWidth={1}
          strokeDasharray="2 3"
          className="stroke-muted-foreground"
        />
        <text
          x={textX}
          y={lineBottom - 22}
          textAnchor="end"
          className="fill-muted-foreground text-2xs font-medium tracking-[0.08em] uppercase tabular-nums"
        >
          Oct 15 · NVDA · <tspan className="fill-loss">−1.4R</tspan>
        </text>
        <text x={textX} y={lineBottom - 3} textAnchor="end" className="fill-foreground text-[15px]">
          “Chased the open. Cut it at the stop.”
        </text>
        <text
          x={textX}
          y={lineBottom + 17}
          textAnchor="end"
          className="fill-muted-foreground text-[15px]"
        >
          Next time, wait for the retest.
        </text>
      </g>
    </svg>
  );
}

/** Split auth frame — brand story panel on the left, quiet form column on the right. */
export function AuthShell({
  children,
  formClassName,
}: {
  children: ReactNode;
  formClassName?: string;
}) {
  return (
    <div className="min-h-svh w-full bg-canvas lg:grid lg:grid-cols-[1.1fr_minmax(0,1fr)]">
      <div className="relative hidden flex-col overflow-hidden bg-sidebar lg:flex">
        <div className="relative z-10 flex flex-col gap-[clamp(2.5rem,9vh,6rem)] p-10 xl:p-14 2xl:p-16">
          <div className="flex items-center gap-2.5">
            <AppLogo size={30} />
            <p className="text-base font-semibold tracking-tight text-foreground">TraderMemos</p>
          </div>
          <div className="flex max-w-[30rem] flex-col gap-3 2xl:max-w-[38rem]">
            <h2 className="text-balance text-4xl font-semibold tracking-tight text-foreground xl:text-[2.75rem] xl:leading-[1.1] 2xl:text-[3.25rem]">
              Every trade, written down.
            </h2>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground 2xl:text-base">
              Log the trade, write the lesson, and come back to both — a journal that runs on your
              own server.
            </p>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-[58%]">
          <CandleField />
        </div>

        <p className="absolute bottom-10 left-10 z-10 text-xs text-muted-foreground xl:left-14">
          Self-hosted. Your trades never leave your server.
        </p>
      </div>

      <main className="relative flex min-h-svh flex-col items-center justify-center px-4 py-10 sm:px-8 lg:min-h-0">
        <div className="relative mb-8 flex flex-col items-center gap-2.5 lg:hidden">
          <AppLogo size={36} />
          <p className="text-base font-semibold tracking-tight text-foreground">TraderMemos</p>
        </div>
        <section
          data-auth-surface
          className={cn(
            "relative flex w-full max-w-[22.5rem] min-w-0 flex-col gap-6",
            "motion-safe:animate-[auth-memo-in_450ms_ease-out_both] motion-safe:[animation-delay:120ms]",
            formClassName,
          )}
        >
          {children}
        </section>
      </main>
    </div>
  );
}
