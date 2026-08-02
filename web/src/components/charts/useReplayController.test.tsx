import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useReplayController } from "./useReplayController";

describe("useReplayController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at the first bar and advances on the timer", () => {
    const { result } = renderHook(() => useReplayController(5));
    act(() => result.current.start());
    expect(result.current.active).toBe(true);
    expect(result.current.cursor).toBe(0);
    expect(result.current.playing).toBe(true);

    act(() => vi.advanceTimersByTime(300)); // default speed "2" = 300ms/bar
    expect(result.current.cursor).toBe(1);
    act(() => vi.advanceTimersByTime(600));
    expect(result.current.cursor).toBe(3);
  });

  it("auto-pauses on the last bar", () => {
    const { result } = renderHook(() => useReplayController(3));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.cursor).toBe(2);
    expect(result.current.playing).toBe(false);
  });

  it("toggle from the end restarts playback at the first bar", () => {
    const { result } = renderHook(() => useReplayController(3));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.toggle());
    expect(result.current.cursor).toBe(0);
    expect(result.current.playing).toBe(true);
  });

  it("stepping and seeking pause playback and clamp to range", () => {
    const { result } = renderHook(() => useReplayController(5));
    act(() => result.current.start());
    act(() => result.current.seek(99));
    expect(result.current.cursor).toBe(4);
    expect(result.current.playing).toBe(false);
    act(() => result.current.stepForward());
    expect(result.current.cursor).toBe(4);
    act(() => result.current.stepBack());
    expect(result.current.cursor).toBe(3);
    act(() => result.current.stepBack());
    act(() => result.current.stepBack());
    act(() => result.current.stepBack());
    act(() => result.current.stepBack());
    expect(result.current.cursor).toBe(0);
  });

  it("resets the cursor when the bar set changes", () => {
    const { result, rerender } = renderHook(({ count }) => useReplayController(count), {
      initialProps: { count: 5 },
    });
    act(() => result.current.start());
    act(() => result.current.seek(3));
    rerender({ count: 8 });
    expect(result.current.cursor).toBe(0);
    expect(result.current.playing).toBe(false);
    expect(result.current.active).toBe(true);
  });

  it("respects the selected speed", () => {
    const { result } = renderHook(() => useReplayController(10));
    act(() => result.current.start());
    act(() => result.current.setSpeed("10"));
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.cursor).toBe(5); // 60ms/bar at 10×
  });

  it("exit deactivates and rewinds", () => {
    const { result } = renderHook(() => useReplayController(5));
    act(() => result.current.start());
    act(() => result.current.seek(2));
    act(() => result.current.exit());
    expect(result.current.active).toBe(false);
    expect(result.current.cursor).toBe(0);
    expect(result.current.playing).toBe(false);
  });
});
