import { useEffect, useMemo, useState } from "react";
import type { BarInterval, MarketBar } from "@/lib/api/market";
import { INTERVAL_SEC } from "./barsToCandlestickData";
import { computeReplayPnl, replayCutoff, type ReplayFillInput, type ReplayPnl } from "./replayPnl";
import { SPEED_MS, type ReplaySpeed } from "./useReplayController";

export interface BacktestReplay {
  /** Bar under review. Stepping back rewinds it for context; orders fill only at the frontier. */
  cursor: number;
  /** Furthest bar revealed so far — the only place orders may fill. */
  frontier: number;
  atFrontier: boolean;
  atEnd: boolean;
  playing: boolean;
  speed: ReplaySpeed;
  /** Exclusive unix-second end of the cursor bar, for the chart's reveal cutoff. */
  cutoff: number | null;
  fills: ReplayFillInput[];
  pnl: ReplayPnl | null;
  toggle: () => void;
  stepForward: () => void;
  stepBack: () => void;
  /** Return the cursor to the frontier after reviewing earlier bars. */
  seekToFrontier: () => void;
  setSpeed: (speed: ReplaySpeed) => void;
  /** Fill an order at the frontier bar's close. No-op off the frontier. */
  placeOrder: (side: "buy" | "sell", quantity: number) => void;
  /** Flatten the open position at the frontier bar's close. */
  closePosition: () => void;
  reset: () => void;
}

/**
 * Blind bar-replay session: the cursor only ever advances one bar at a time
 * (no seek-ahead), synthetic fills accrue at bar closes, and P&L replays
 * through the same math the trade-detail replay uses.
 */
export function useBacktestReplay(
  bars: MarketBar[] | undefined,
  interval: BarInterval,
): BacktestReplay {
  const barCount = bars?.length ?? 0;
  // Reveal a warmup stretch so the first decision has context.
  const warmup =
    barCount > 0 ? Math.min(Math.max(10, Math.floor(barCount * 0.1)), barCount - 1) : 0;
  const lastIndex = Math.max(barCount - 1, 0);

  const [pos, setPos] = useState({ cursor: warmup, frontier: warmup });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>("2");
  const [fills, setFills] = useState<ReplayFillInput[]>([]);
  const { cursor, frontier } = pos;

  const advance = (p: { cursor: number; frontier: number }) => {
    const next = Math.min(p.cursor + 1, lastIndex);
    return { cursor: next, frontier: Math.max(p.frontier, next) };
  };

  // A new bar set is a new session.
  useEffect(() => {
    setPos({ cursor: warmup, frontier: warmup });
    setPlaying(false);
    setFills([]);
  }, [bars, warmup]);

  useEffect(() => {
    if (!playing || barCount === 0) return;
    const id = globalThis.setInterval(() => setPos(advance), SPEED_MS[speed]);
    return () => globalThis.clearInterval(id);
  }, [playing, speed, barCount, lastIndex]);

  useEffect(() => {
    if (playing && cursor >= lastIndex) setPlaying(false);
  }, [playing, cursor, lastIndex]);

  const pnl = useMemo(
    () => (bars && barCount > 0 ? computeReplayPnl(fills, bars, cursor, interval) : null),
    [bars, barCount, fills, cursor, interval],
  );

  const placeOrder = (side: "buy" | "sell", quantity: number) => {
    if (!bars || barCount === 0 || cursor !== frontier || quantity <= 0) return;
    const bar = bars[cursor];
    if (!bar) return;
    // One second before the bar's close moment, so the fill lands inside the
    // cursor bar for both the P&L cutoff and the chart marker.
    const executedSec = bar.time + INTERVAL_SEC[interval] - 1;
    const executedAt = new Date(executedSec * 1000).toISOString();
    setFills((prev) => {
      // Same-bar same-side orders merge into one fill: the price is identical
      // anyway, and distinct fills with equal (symbol, side, qty, price, time)
      // would silently dedupe server-side on save.
      const i = prev.findIndex((f) => f.executed_at === executedAt && f.side === side);
      if (i >= 0) {
        const merged = [...prev];
        merged[i] = { ...merged[i], quantity: merged[i].quantity + quantity };
        return merged;
      }
      return [
        ...prev,
        {
          side,
          quantity,
          price: bar.close,
          fees: 0,
          commission: 0,
          executed_at: executedAt,
          multiplier: 1,
        },
      ];
    });
  };

  return {
    cursor,
    frontier,
    atFrontier: cursor === frontier,
    atEnd: barCount > 0 && cursor >= lastIndex,
    playing,
    speed,
    cutoff: bars && barCount > 0 ? replayCutoff(bars, cursor, interval) : null,
    fills,
    pnl,
    toggle: () => {
      if (barCount === 0) return;
      if (!playing && cursor >= lastIndex) return;
      setPlaying((p) => !p);
    },
    stepForward: () => {
      setPlaying(false);
      setPos(advance);
    },
    stepBack: () => {
      setPlaying(false);
      setPos((p) => ({ ...p, cursor: Math.max(p.cursor - 1, 0) }));
    },
    seekToFrontier: () => {
      setPos((p) => ({ ...p, cursor: p.frontier }));
    },
    setSpeed,
    placeOrder,
    closePosition: () => {
      if (!pnl || pnl.position === 0) return;
      placeOrder(pnl.position > 0 ? "sell" : "buy", Math.abs(pnl.position));
    },
    reset: () => {
      setPos({ cursor: warmup, frontier: warmup });
      setPlaying(false);
      setFills([]);
    },
  };
}
