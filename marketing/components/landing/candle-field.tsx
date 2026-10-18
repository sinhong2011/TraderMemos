/*
 * The hero signature, shared with the web app's sign-in panel: a season of
 * daily candles in one ink. Up days solid, down days hollow, older days fading
 * left. The worst day of the drawdown carries its journal note — the product
 * is the sentence, not the bar. Rendered on the server; CSS staggers the rise.
 */
const W = 1600;
const H = 300;
const N = 104;
const STEP = W / N;
const BODY = STEP * 0.58;
const NOTE_AT = 64;

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
    const drift = i < 40 ? 0.55 : i <= NOTE_AT ? -1.15 : 1.1;
    const o = price;
    const c = i === NOTE_AT ? o - 7.5 : o + drift + (rnd() - 0.5) * 4.6;
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
const y = (v: number) => 12 + ((HI - v) / (HI - LO)) * (H * 0.66);

export function CandleField({
  noteMeta,
  noteLine1,
  noteLine2,
}: {
  noteMeta: string;
  noteLine1: string;
  noteLine2: string;
}) {
  const note = CANDLES[NOTE_AT]!;
  const noteX = NOTE_AT * STEP + STEP / 2;
  const lineTop = y(note.l) + 8;
  const lineBottom = lineTop + 34;
  const textX = noteX - 12;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none block size-full select-none"
      fill="none"
    >
      {CANDLES.map((k, i) => {
        const x = i * STEP + STEP / 2;
        const up = k.c >= k.o;
        const top = y(Math.max(k.o, k.c));
        const bottom = y(Math.min(k.o, k.c));
        // Older days recede gently; the band's edge mask handles the far ends.
        const opacity = 0.35 + 0.65 * (i / (N - 1));
        return (
          <g
            key={i}
            className="tm-candle"
            style={{ opacity, animationDelay: `${200 + i * 12}ms` }}
          >
            <line
              x1={x}
              x2={x}
              y1={y(k.h)}
              y2={y(k.l)}
              strokeWidth={1.25}
              className="stroke-tm-ink"
            />
            <rect
              x={x - BODY / 2}
              y={top}
              width={BODY}
              height={Math.max(bottom - top, 2)}
              rx={1}
              strokeWidth={up ? 0 : 1.25}
              className={up ? 'fill-tm-ink' : 'fill-fd-background stroke-tm-ink'}
            />
          </g>
        );
      })}

      <g className="tm-note max-sm:hidden">
        <path
          d={`M${noteX} ${lineTop} V${lineBottom} H${textX + 4}`}
          strokeWidth={1}
          strokeDasharray="2 3"
          className="stroke-fd-muted-foreground"
        />
        <text
          x={textX}
          y={lineBottom - 18}
          textAnchor="end"
          fontSize="10"
          className="fill-fd-muted-foreground font-mono uppercase tracking-[0.08em]"
        >
          {noteMeta} · <tspan className="fill-tm-loss">−1.4R</tspan>
        </text>
        <text x={textX} y={lineBottom - 2} textAnchor="end" fontSize="12.5" className="fill-fd-foreground">
          {noteLine1}
        </text>
        <text
          x={textX}
          y={lineBottom + 14}
          textAnchor="end"
          fontSize="12.5"
          className="fill-fd-muted-foreground"
        >
          {noteLine2}
        </text>
      </g>
    </svg>
  );
}
