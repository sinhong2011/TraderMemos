import { useEffect, useState } from "react";

export type ReplaySpeed = "1" | "2" | "5" | "10";

/** Milliseconds per bar at each speed. */
const SPEED_MS: Record<ReplaySpeed, number> = { "1": 600, "2": 300, "5": 120, "10": 60 };

export const REPLAY_SPEEDS = [
  { value: "1" as const, label: "1×" },
  { value: "2" as const, label: "2×" },
  { value: "5" as const, label: "5×" },
  { value: "10" as const, label: "10×" },
];

export interface ReplayController {
  active: boolean;
  cursor: number;
  playing: boolean;
  speed: ReplaySpeed;
  start: () => void;
  exit: () => void;
  toggle: () => void;
  stepBack: () => void;
  stepForward: () => void;
  seek: (index: number) => void;
  setSpeed: (speed: ReplaySpeed) => void;
}

/**
 * Bar-by-bar playback state for trade replay. The cursor indexes into the
 * bars array; playback advances it on a timer and auto-pauses on the last bar.
 * Cursor resets whenever the bar set changes (interval switch, refetch).
 */
export function useReplayController(barCount: number): ReplayController {
  const [active, setActive] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>("2");

  const lastIndex = Math.max(barCount - 1, 0);

  useEffect(() => {
    setCursor(0);
    setPlaying(false);
  }, [barCount]);

  useEffect(() => {
    if (!active || !playing || barCount === 0) return;
    const id = globalThis.setInterval(() => {
      setCursor((c) => Math.min(c + 1, lastIndex));
    }, SPEED_MS[speed]);
    return () => globalThis.clearInterval(id);
  }, [active, playing, speed, barCount, lastIndex]);

  useEffect(() => {
    if (playing && cursor >= lastIndex) setPlaying(false);
  }, [playing, cursor, lastIndex]);

  const clamp = (i: number) => Math.min(Math.max(i, 0), lastIndex);

  return {
    active,
    cursor,
    playing,
    speed,
    start: () => {
      setActive(true);
      setCursor(0);
      setPlaying(true);
    },
    exit: () => {
      setActive(false);
      setPlaying(false);
      setCursor(0);
    },
    toggle: () => {
      if (!playing && cursor >= lastIndex) setCursor(0);
      setPlaying((p) => !p);
    },
    stepBack: () => {
      setPlaying(false);
      setCursor((c) => clamp(c - 1));
    },
    stepForward: () => {
      setPlaying(false);
      setCursor((c) => clamp(c + 1));
    },
    seek: (index: number) => {
      setPlaying(false);
      setCursor(clamp(index));
    },
    setSpeed,
  };
}
