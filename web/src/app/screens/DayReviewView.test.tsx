import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Trade } from "@/lib/api/types";
import { DayReviewView, type DayReviewViewProps } from "./DayReviewView";

const noop = () => vi.fn<() => void>();

const base: DayReviewViewProps = {
  date: "2026-10-02",
  trades: [],
  tradesLoading: false,
  tradesError: false,
  summaryLoading: false,
  notes: [],
  notesLoading: false,
  currency: "USD",
  onSelectTrade: vi.fn<(t: Trade) => void>(),
  onPrevDay: noop(),
  onNextDay: noop(),
  onOpenCalendar: noop(),
  onOpenNotes: noop(),
  onNewNote: noop(),
};

describe("DayReviewView", () => {
  it("marks today and offers no jump back to it", () => {
    render(<DayReviewView {...base} isToday onToday={noop()} />);
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
  });

  it("offers a jump back to today from any other day", () => {
    const onToday = noop();
    render(<DayReviewView {...base} onToday={onToday} />);
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(onToday).toHaveBeenCalledOnce();
  });

  it("renders the routine, desk and missed sections in session order", () => {
    render(
      <DayReviewView
        {...base}
        routine={<section>routine-slot</section>}
        desk={<section>desk-slot</section>}
        missed={<section>missed-slot</section>}
      />,
    );
    const text = document.body.textContent ?? "";
    const order = [
      "routine-slot",
      "desk-slot",
      "Session summary",
      "Trades (0)",
      "missed-slot",
      "Daily log",
    ];
    const positions = order.map((s) => text.indexOf(s));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("words an empty day instead of a dash", () => {
    render(<DayReviewView {...base} summary={undefined} />);
    expect(screen.getByText("No trades")).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();
  });
});
